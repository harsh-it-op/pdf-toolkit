"""Typed errors + file validation. Per spec: never leak stack traces to clients."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

# PDF magic number: %PDF-
PDF_MAGIC = b"%PDF-"


class PDFError(Exception):
    """Base for user-facing PDF errors. `code` is the API error code."""

    code: str = "PDF_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidPDFError(PDFError):
    code = "INVALID_PDF"


class EncryptedPDFError(PDFError):
    code = "ENCRYPTED_PDF"


class UnsupportedEncryptionError(PDFError):
    code = "UNSUPPORTED_ENCRYPTION"


class PageCountError(PDFError):
    code = "TOO_MANY_PAGES"


class FileSizeError(PDFError):
    code = "FILE_TOO_LARGE"


class FileTypeError(PDFError):
    code = "UNSUPPORTED_FILE_TYPE"


@dataclass
class Limits:
    max_bytes: int
    max_pages: int


def validate_upload(
    *,
    filename: Optional[str],
    content_type: Optional[str],
    size: int,
    limits: Limits,
) -> str:
    """Validate an upload's metadata. Returns the canonical filename. Raises PDFError."""
    if size <= 0:
        raise InvalidPDFError("The uploaded file is empty.")
    if size > limits.max_bytes:
        raise FileSizeError(
            f"File is {size} bytes, max allowed is {limits.max_bytes}."
        )
    name = (filename or "").strip()
    if not name:
        raise FileTypeError("Missing filename.")
    ext = os.path.splitext(name)[1].lower()
    if ext != ".pdf":
        raise FileTypeError(f"Only .pdf files are accepted (got {ext!r}).")
    if content_type and content_type not in ("application/pdf", "application/octet-stream"):
        raise FileTypeError(f"Unexpected content type: {content_type}.")
    return name


def check_pdf_magic(head: bytes) -> None:
    if not head.startswith(PDF_MAGIC):
        raise InvalidPDFError("File is not a valid PDF (bad magic number).")
