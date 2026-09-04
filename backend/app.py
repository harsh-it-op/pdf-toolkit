"""PDFForge API. Phase 1: upload + merge + split + compress with real progress."""
from __future__ import annotations

import asyncio
import json
import os
import uuid
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import redis.asyncio as redis
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

import pdf_ops
import rag
from jobs import JobQueue, JobStore

from storage import Storage,LocalStorage, S3Storage
from validation import (
    FileSizeError,
    InvalidPDFError,
    Limits,
    PDFError,
    check_pdf_magic,
    validate_upload,
)

# --- config from env ---------------------------------------------------------

STORAGE_DIR = os.environ.get("PDFFORGE_STORAGE_DIR", "./storage")
DB_PATH = os.environ.get("PDFFORGE_DB_PATH", "./storage/state.sqlite")
MAX_UPLOAD = int(os.environ.get("PDFFORGE_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
MAX_PAGES = int(os.environ.get("PDFFORGE_MAX_PAGES", "2000"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("PDFFORGE_CORS_ORIGINS", "*").split(",")]
JOB_TTL = int(os.environ.get("PDFFORGE_JOB_TTL_SECONDS", "3600"))
REDIS_URL = os.environ.get("PDFFORGE_REDIS_URL", "")
RATE_LIMIT_PER_MINUTE = int(os.environ.get("PDFFORGE_RATE_LIMIT", "60"))

# --- app + state -------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)
    state.storage = Storage(STORAGE_DIR)
    state.store = JobStore(DB_PATH)
    state.queue = JobQueue(state.store)
    yield


app = FastAPI(title="PDFForge", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class State:
    storage: Storage
    store: JobStore
    queue: JobQueue


state = State()


# --- error translator -------------------------------------------------------

@app.exception_handler(PDFError)
async def _pdf_error(_: Request, e: PDFError) -> JSONResponse:
    return JSONResponse(
        {"success": False, "error": {"code": e.code, "message": e.message}},
        status_code=422,
    )


def err(code: str, message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"success": False, "error": {"code": code, "message": message}}, status_code=status)


# --- health -----------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"success": True, "service": "pdfforge", "version": "0.1.0"}


# --- upload -----------------------------------------------------------------

@app.post("/api/files/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    limits = Limits(max_bytes=MAX_UPLOAD, max_pages=MAX_PAGES)
    # FastAPI sets file.size from the multipart Content-Length header at parse
    # time, so we can validate the declared size before reading the body.
    name = validate_upload(
        filename=file.filename,
        content_type=file.content_type,
        size=file.size or 0,
        limits=limits,
    )

    file_id = uuid.uuid4().hex
    tmp = Path(STORAGE_DIR) / f".incoming_{file_id}"
    head_buf = bytearray()
    written = 0
    try:
        with tmp.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 256)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD:
                    raise FileSizeError(f"File exceeds {MAX_UPLOAD} bytes.")
                if len(head_buf) < 5:
                    head_buf.extend(chunk[: 5 - len(head_buf)])
                out.write(chunk)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    if written <= 0:
        tmp.unlink(missing_ok=True)
        raise InvalidPDFError("The uploaded file is empty.")
    check_pdf_magic(bytes(head_buf))

    state.storage.put_path(file_id, tmp)
    tmp.unlink(missing_ok=True)

    pages = 0
    try:
        pages = pdf_ops.page_count(state.storage.get_path(file_id))
    except PDFError:
        state.storage.delete(file_id)
        raise
    if pages > MAX_PAGES:
        state.storage.delete(file_id)
        from validation import PageCountError
        raise PageCountError(f"PDF has {pages} pages, max allowed is {MAX_PAGES}.")

    return {
        "success": True,
        "file": {"id": file_id, "name": name, "size": written, "pages": pages},
    }


# --- file metadata / download / delete -------------------------------------

@app.get("/api/files/{file_id}")
def file_info(file_id: str) -> dict:
    if not state.storage.exists(file_id):
        return err("NOT_FOUND", "File not found.", status=404)
    path = state.storage.get_path(file_id)
    try:
        pages = pdf_ops.page_count(path)
    except PDFError as e:
        return err(e.code, e.message, status=422)
    return {"success": True, "file": {"id": file_id, "size": path.stat().st_size, "pages": pages}}


@app.get("/api/files/{file_id}/metadata")
def file_metadata(file_id: str) -> dict:
    if not state.storage.exists(file_id):
        return err("NOT_FOUND", "File not found.", status=404)
    path = state.storage.get_path(file_id)
    try:
        meta = pdf_ops.get_metadata(path)
    except PDFError as e:
        return err(e.code, e.message, status=422)
    return {"success": True, "metadata": meta}


@app.get("/api/files/{file_id}/download")
def download(file_id: str, name: str | None = None):
    if not state.storage.exists(file_id):
        return err("NOT_FOUND", "File not found.", status=404)
    path = state.storage.get_path(file_id)
    return FileResponse(path, media_type="application/pdf", filename=(name or f"{file_id}.pdf"))


@app.delete("/api/files/{file_id}")
def delete_file(file_id: str) -> dict:
    state.storage.delete(file_id)
    return {"success": True}


# --- runners (run in thread via queue) -------------------------------------

def _require_file(file_id: str) -> None:
    if not state.storage.exists(file_id):
        raise InvalidPDFError(f"File {file_id} not found.")


def _result_path(job_id: str, name: str) -> Path:
    d = Path(STORAGE_DIR) / "results" / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d / name


def _run_merge(payload: dict, progress) -> dict:
    file_ids = payload["file_ids"]
    for fid in file_ids:
        _require_file(fid)
    out = _result_path(payload["_job_id"], "merged.pdf")
    paths = [state.storage.get_path(fid) for fid in file_ids]
    size, pages = pdf_ops.merge(paths, out, MAX_PAGES, progress)
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {"file_id": out_id, "size": size, "pages": pages}


def _run_split(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    total = pdf_ops.page_count(in_path)
    ranges = pdf_ops.parse_ranges(payload.get("ranges", "all"), total)
    out_dir = Path(STORAGE_DIR) / "results" / payload["_job_id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    parts = pdf_ops.split(in_path, ranges, out_dir, MAX_PAGES, progress)
    out_files = []
    for name, size in parts:
        fid_out = uuid.uuid4().hex
        state.storage.put_path(fid_out, out_dir / name)
        out_files.append({"file_id": fid_out, "name": name, "size": size})
    return {"parts": out_files, "total_pages": total}


def _run_compress(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    out = _result_path(payload["_job_id"], "compressed.pdf")
    out_size, in_size, pages = pdf_ops.compress(in_path, out, payload["level"], MAX_PAGES, progress)
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    reduction = 0.0
    if in_size > 0:
        reduction = round((1 - out_size / in_size) * 100, 1)
    return {
        "file_id": out_id,
        "input_size": in_size,
        "output_size": out_size,
        "reduction_percent": reduction,
        "pages": pages,
        "level": payload["level"],
    }


def _run_rotate(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    out = _result_path(payload["_job_id"], "rotated.pdf")
    pages = pdf_ops.rotate(
        in_path,
        out,
        angle=int(payload["angle"]),
        pages=payload.get("pages"),
        max_pages=MAX_PAGES,
        progress=progress,
    )
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {
        "file_id": out_id,
        "size": Path(out).stat().st_size,
        "pages": pages,
        "angle": payload["angle"],
    }


def _run_organize(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    out = _result_path(payload["_job_id"], "organized.pdf")
    pages = pdf_ops.organize(
        in_path, out, list(payload["order"]), MAX_PAGES, progress=progress
    )
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {"file_id": out_id, "size": Path(out).stat().st_size, "pages": pages}


def _run_watermark(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    out = _result_path(payload["_job_id"], "watermarked.pdf")
    pages = pdf_ops.watermark(
        in_path, out, payload["text"], MAX_PAGES, progress=progress
    )
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {"file_id": out_id, "size": Path(out).stat().st_size, "pages": pages}


def _run_page_numbers(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    out = _result_path(payload["_job_id"], "page_numbers.pdf")
    pages = pdf_ops.page_numbers(
        in_path, out, payload.get("position", "bottom-center"), MAX_PAGES, progress=progress
    )
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {"file_id": out_id, "size": Path(out).stat().st_size, "pages": pages}


def _run_metadata(payload: dict, progress) -> dict:
    fid = payload["file_id"]
    _require_file(fid)
    in_path = state.storage.get_path(fid)
    if not payload.get("fields"):
        # No-op read: just return current metadata.
        return {"metadata": pdf_ops.get_metadata(in_path)}
    out = _result_path(payload["_job_id"], "metadata.pdf")
    metadata = pdf_ops.set_metadata(
        in_path, out, payload["fields"], MAX_PAGES, progress=progress
    )
    out_id = uuid.uuid4().hex
    state.storage.put_path(out_id, out)
    return {"file_id": out_id, "metadata": metadata}


_RUNNERS = {
    "merge": _run_merge,
    "split": _run_split,
    "compress": _run_compress,
    "rotate": _run_rotate,
    "organize": _run_organize,
    "watermark": _run_watermark,
    "page_numbers": _run_page_numbers,
    "metadata": _run_metadata,
}


# --- job endpoints ---------------------------------------------------------

async def _submit(operation: str, payload: dict) -> dict:
    runner = _RUNNERS.get(operation)
    if runner is None:
        raise InvalidPDFError(f"Unknown operation: {operation}")
    rec = state.store.create(operation, payload, ttl=JOB_TTL)
    payload["_job_id"] = rec.id
    state.store.update(rec.id, payload_json=json.dumps(payload))

    async def _go():
        state.store.update(rec.id, status="processing", stage="starting", progress=1)
        try:
            def progress(percent: int, stage: str) -> None:
                state.store.update(rec.id, progress=percent, stage=stage)
            result = await asyncio.to_thread(runner, payload, progress)
            state.store.update(rec.id, status="completed", progress=100, stage="done",
                               result_json=json.dumps(result))
        except PDFError as e:
            state.store.update(rec.id, status="failed", error_code=e.code,
                               error_message=e.message, stage="failed")
        except Exception:
            state.store.update(rec.id, status="failed", error_code="INTERNAL",
                               error_message="Something went wrong processing this file.", stage="failed")

    asyncio.create_task(_go())
    return {"success": True, "job_id": rec.id, "status": rec.status}


@app.post("/api/pdf/merge")
async def merge_endpoint(payload: dict) -> dict:
    fids = payload.get("file_ids") or []
    if not isinstance(fids, list) or not fids:
        raise InvalidPDFError("file_ids must be a non-empty list.")
    return await _submit("merge", {"file_ids": fids})


@app.post("/api/pdf/split")
async def split_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    return await _submit("split", {"file_id": fid, "ranges": payload.get("ranges", "all")})


@app.post("/api/pdf/compress")
async def compress_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    return await _submit("compress", {"file_id": fid, "level": payload.get("level", "recommended")})


@app.post("/api/pdf/rotate")
async def rotate_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    angle = payload.get("angle", 90)
    if not isinstance(angle, int) or angle not in (0, 90, 180, 270):
        raise InvalidPDFError("angle must be one of 0, 90, 180, 270.")
    return await _submit(
        "rotate",
        {"file_id": fid, "angle": angle, "pages": payload.get("pages")},
    )


@app.post("/api/pdf/organize")
async def organize_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    order = payload.get("order") or []
    if not isinstance(order, list) or not all(isinstance(x, int) for x in order):
        raise InvalidPDFError("order must be a list of integers.")
    return await _submit("organize", {"file_id": fid, "order": order})


@app.post("/api/pdf/watermark")
async def watermark_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    text = (payload.get("text") or "").strip()
    if not text:
        raise InvalidPDFError("Watermark text is required.")
    return await _submit("watermark", {"file_id": fid, "text": text})


@app.post("/api/pdf/page-numbers")
async def page_numbers_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    return await _submit(
        "page_numbers",
        {"file_id": fid, "position": payload.get("position", "bottom-center")},
    )


@app.post("/api/pdf/metadata")
async def metadata_endpoint(payload: dict) -> dict:
    fid = payload.get("file_id")
    if not fid:
        raise InvalidPDFError("file_id is required.")
    fields = payload.get("fields") or {}
    if not isinstance(fields, dict):
        raise InvalidPDFError("fields must be an object.")
    return await _submit("metadata", {"file_id": fid, "fields": fields})


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    rec = state.store.get(job_id)
    if rec is None:
        return err("NOT_FOUND", "Job not found.", status=404)
    return {"success": True, "job": rec.to_public()}


# --- CLI entry -------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.environ.get("PDFFORGE_HOST", "127.0.0.1"),
        port=int(os.environ.get("PDFFORGE_PORT", "8000")),
        reload=False,
    )
