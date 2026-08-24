"""Job store + in-process queue. Ponytail: swap to BullMQ when concurrency > ~5."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

# Statuses per spec.
QUEUED = "queued"
PROCESSING = "processing"
COMPLETED = "completed"
FAILED = "failed"
EXPIRED = "expired"


@dataclass
class JobRecord:
    id: str
    operation: str
    status: str
    progress: int
    stage: str
    payload_json: str
    result_json: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    created_at: float
    updated_at: float
    expires_at: float

    def to_public(self) -> dict:
        out: dict[str, Any] = {
            "job_id": self.id,
            "operation": self.operation,
            "status": self.status,
            "progress": self.progress,
            "stage": self.stage,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
        }
        if self.result_json:
            out["result"] = json.loads(self.result_json)
        if self.error_code:
            out["error"] = {"code": self.error_code, "message": self.error_message}
        return out


class JobStore:
    def __init__(self, db_path: str) -> None:
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db_path = db_path
        self._init_schema()

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path, isolation_level=None)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._conn() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    operation TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    stage TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL,
                    result_json TEXT,
                    error_code TEXT,
                    error_message TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
                """
            )
            c.execute("CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status)")

    def create(self, operation: str, payload: dict, ttl: int) -> JobRecord:
        now = time.time()
        rec = JobRecord(
            id=uuid.uuid4().hex,
            operation=operation,
            status=QUEUED,
            progress=0,
            stage="queued",
            payload_json=json.dumps(payload),
            result_json=None,
            error_code=None,
            error_message=None,
            created_at=now,
            updated_at=now,
            expires_at=now + ttl,
        )
        with self._conn() as c:
            c.execute(
                """INSERT INTO jobs (id, operation, status, progress, stage,
                       payload_json, created_at, updated_at, expires_at)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                (rec.id, rec.operation, rec.status, rec.progress, rec.stage,
                 rec.payload_json, rec.created_at, rec.updated_at, rec.expires_at),
            )
        return rec

    def get(self, job_id: str) -> Optional[JobRecord]:
        with self._conn() as c:
            row = c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return _row_to_record(row) if row else None

    def update(self, job_id: str, **fields: Any) -> None:
        if not fields:
            return
        fields["updated_at"] = time.time()
        cols = ", ".join(f"{k}=?" for k in fields)
        vals = list(fields.values()) + [job_id]
        with self._conn() as c:
            c.execute(f"UPDATE jobs SET {cols} WHERE id=?", vals)

    def expire_old(self) -> int:
        """Mark any job past its expiry as EXPIRED. Returns count."""
        now = time.time()
        with self._conn() as c:
            cur = c.execute(
                "UPDATE jobs SET status=?, stage=?, updated_at=? "
                "WHERE status IN (?,?,?) AND expires_at < ?",
                (EXPIRED, "expired", now, QUEUED, PROCESSING, COMPLETED, now),
            )
            return cur.rowcount


def _row_to_record(row: sqlite3.Row) -> JobRecord:
    return JobRecord(
        id=row["id"],
        operation=row["operation"],
        status=row["status"],
        progress=row["progress"],
        stage=row["stage"],
        payload_json=row["payload_json"],
        result_json=row["result_json"],
        error_code=row["error_code"],
        error_message=row["error_message"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        expires_at=row["expires_at"],
    )


# --- queue ----------------------------------------------------------------

class JobQueue:
    """Ponytail: in-process queue; swap to BullMQ/Redis when concurrency > ~5."""

    def __init__(self, store: JobStore) -> None:
        self.store = store
        self._sem = asyncio.Semaphore(4)  # ponytail: 4 concurrent workers is plenty for Phase 1

    async def submit(self, operation: str, payload: dict, runner) -> JobRecord:
        rec = self.store.create(operation, payload, ttl=_ttl())
        asyncio.create_task(self._run(rec, runner))
        return rec

    async def _run(self, rec: JobRecord, runner) -> None:
        async with self._sem:
            self.store.update(rec.id, status=PROCESSING, stage="starting", progress=1)
            try:
                payload = json.loads(rec.payload_json)

                def progress(percent: int, stage: str) -> None:
                    self.store.update(rec.id, progress=percent, stage=stage)

                result = await asyncio.to_thread(runner, payload, progress)
                self.store.update(
                    rec.id,
                    status=COMPLETED,
                    progress=100,
                    stage="done",
                    result_json=json.dumps(result),
                )
            except Exception as e:  # noqa: BLE001 — translate to typed error
                from validation import PDFError
                if isinstance(e, PDFError):
                    code, msg = e.code, e.message
                else:
                    code, msg = "INTERNAL", "Something went wrong processing this file."
                self.store.update(
                    rec.id,
                    status=FAILED,
                    error_code=code,
                    error_message=msg,
                    stage="failed",
                )


def _ttl() -> int:
    import os
    return int(os.environ.get("PDFFORGE_JOB_TTL_SECONDS", "3600"))
