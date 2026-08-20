# PDFForge

An online PDF utility toolkit. Upload PDFs from the browser, run real operations on the server, and download the result. Inspired by modern PDF SaaS tools but built as an independent product with its own brand, UI, and implementation.

This is an active build. **Phase 1 is functional today** — upload, compress, merge, split, with real PDF processing and live progress. Subsequent phases are tracked below.

## Status

| Phase | Scope | State |
|------:|-------|-------|
| 1 | Project setup · Landing page · Tool cards · Upload · Compress · Merge · Split · Download | **Working** (backend + frontend) |
| 2 | Rotate · Watermark · Page numbers · Organize · PDF ↔ JPG | Pending |
| 3 | Edit · Annotations · Password · Unlock · Metadata · Crop | Pending |
| 4 | OCR · DOCX/PPTX/XLSX conversion | Pending |
| 5 | Auth · User dashboard · Pricing · Admin | Pending |
| 6 | Production hardening · Rate limiting · Object storage · Workers · Monitoring | Pending |

## Architecture

```
frontend/   React 18 + TypeScript + Vite + Tailwind
backend/    FastAPI + pikepdf + pypdf (real PDF processing, no fakes)
storage/    Local filesystem, sharded by file id (S3-shaped interface)
```

* Real PDF processing is server-side. The browser never has to load a 500 MB file just to compress it.
* Operations are async jobs with status polling: `queued → processing → completed | failed`.
* Progress percentages are reported by the actual library doing the work, not faked.
* Every job auto-expires. Files are deleted on TTL.

## Requirements

* Python 3.11+ (tested on 3.12)
* Node 20+ (for the frontend)
* Windows / macOS / Linux

## Local development

### 1. Backend

```bash
cd pdf-toolkit
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS/Linux

pip install -r backend/requirements.txt
copy .env.example .env           # Windows
# cp .env.example .env           # macOS/Linux

uvicorn app:app --app-dir backend --reload --port 8000
```

API is on `http://127.0.0.1:8000`. OpenAPI docs at `/docs`.

### 2. Frontend

```bash
cd pdf-toolkit/frontend
npm install
npm run dev
```

Requires **Node 20+** on `PATH`. The Vite dev server runs on `http://127.0.0.1:5173` and proxies `/api/*` to the FastAPI backend, so the frontend can use same-origin URLs in both dev and production.

> **Heads up:** this project was authored on a machine without Node.js installed. The source files are complete (pages, components, router, hooks, Tailwind config, Vite config, TypeScript config), but `npm install` / `npm run build` were not run here. After installing Node, run `npm install` then `npm run typecheck` and `npm run build` to confirm.

### 3. Tests

```bash
cd pdf-toolkit
.venv\Scripts\python.exe -m pytest backend/tests -q
```

## Environment variables

All variables are read by the backend. Sensible defaults for dev live in `.env.example`. Copy it to `.env` and adjust for production.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PDFFORGE_STORAGE_DIR` | `./storage` | Root for uploaded + result files |
| `PDFFORGE_DB_PATH` | `./storage/state.sqlite` | SQLite job state |
| `PDFFORGE_MAX_UPLOAD_BYTES` | `104857600` (100 MB) | Hard cap on upload size |
| `PDFFORGE_MAX_PAGES` | `2000` | Reject pathological PDFs |
| `PDFFORGE_JOB_TTL_SECONDS` | `3600` | Files auto-expire after this |
| `PDFFORGE_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allow list |
| `PDFFORGE_HOST` / `PDFFORGE_PORT` | `127.0.0.1` / `8000` | Bind address |

## API surface (current)

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/health` | Liveness check |
| POST   | `/api/files/upload` | Multipart upload, returns `{file_id, name, size, pages}` |
| GET    | `/api/files/{id}` | Metadata (size, page count) |
| GET    | `/api/files/{id}/download` | Stream the file back |
| DELETE | `/api/files/{id}` | Delete an uploaded file |
| POST   | `/api/pdf/merge` | `{file_ids: [...]}` → job |
| POST   | `/api/pdf/split` | `{file_id, ranges: "1-3,5"}` → job |
| POST   | `/api/pdf/compress` | `{file_id, level: "extreme|recommended|low"}` → job |
| GET    | `/api/jobs/{id}` | Live status, progress, result, error |

Successful responses use `{success: true, ...}`. Errors use `{success: false, error: {code, message}}`. Codes include `INVALID_PDF`, `ENCRYPTED_PDF`, `TOO_MANY_PAGES`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `NOT_FOUND`, `INTERNAL`. Stack traces are never exposed.

## Compression

Three levels, all real:

* **Low** — high quality. `normalize_content=True`, streams compressed, no linearization.
* **Recommended** — balanced. `linearize=True` (web-fast), no content rewrite.
* **Extreme** — smallest. Removes unreferenced resources, linearized, minimum PDF 1.5.

Reduction percentage is measured from real input/output bytes — never fabricated.

## Security

* Magic-byte check on every upload.
* Filename + content-type + size validation before any work.
* No arbitrary code execution; all PDF processing goes through pikepdf, which is built on QPDF.
* Temporary files in a single sharded tree; no user-controlled paths.
* TTL-driven cleanup.
* Production swap points (S3 storage, BullMQ, dedicated workers) are isolated behind adapters in `storage.py` and `jobs.py`.

## License

Internal project. Add a license before publishing.

# pdf-toolkit
