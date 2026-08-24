"""Local filesystem storage. S3-shaped interface so the production swap is one class."""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import BinaryIO


class Storage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, file_id: str) -> Path:
        # Shard by first 2 chars to avoid huge dirs.
        if len(file_id) < 2 or "/" in file_id or "\\" in file_id:
            raise ValueError("invalid file_id")
        return self.root / file_id[:2] / file_id

    def put(self, file_id: str, source: BinaryIO | bytes) -> int:
        p = self._path(file_id)
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(source, bytes):
            p.write_bytes(source)
        else:
            with p.open("wb") as f:
                shutil.copyfileobj(source, f)
        return p.stat().st_size

    def put_path(self, file_id: str, src_path: str | os.PathLike) -> int:
        p = self._path(file_id)
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src_path, p)
        return p.stat().st_size

    def get_path(self, file_id: str) -> Path:
        p = self._path(file_id)
        if not p.exists():
            raise FileNotFoundError(file_id)
        return p

    def exists(self, file_id: str) -> bool:
        return self._path(file_id).exists()

    def size(self, file_id: str) -> int:
        return self.get_path(file_id).stat().st_size

    def delete(self, file_id: str) -> None:
        p = self._path(file_id)
        if p.exists():
            p.unlink()

    def open_read(self, file_id: str) -> BinaryIO:
        return self.get_path(file_id).open("rb")


# ponytail: in-process queue + SQLite, swap to BullMQ/Redis when concurrent jobs > ~5.
