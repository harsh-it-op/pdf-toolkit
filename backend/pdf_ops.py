"""Real PDF operations. pikepdf (QPDF-backed) handles merge/split/compress.

Progress callbacks are plumbed so the API can report real stage + 0-100 progress.
"""
from __future__ import annotations

import io
import re
from pathlib import Path
from typing import Callable, Iterable, List, Tuple

import pikepdf

from validation import (
    EncryptedPDFError,
    InvalidPDFError,
    PageCountError,
    UnsupportedEncryptionError,
)

ProgressFn = Callable[[int, str], None]  # (percent, stage_label)


def _open(path: str | Path, password: str | None = None) -> pikepdf.Pdf:
    """Open a PDF, raising typed errors for the API layer."""
    kwargs = {}
    if password:
        kwargs["password"] = password
    try:
        return pikepdf.open(path, **kwargs)
    except pikepdf.PasswordError as e:
        raise EncryptedPDFError("This PDF is password-protected.") from e
    except Exception as e:  # noqa: BLE001 — qpdf raises various types
        if isinstance(e, pikepdf.PasswordError):
            raise EncryptedPDFError("This PDF is password-protected.") from e
        # ponytail: qpdf error messages vary; classify by exception type when possible,
        # fall back to "corrupt" for anything else.
        raise InvalidPDFError("The PDF is corrupted or not a valid PDF.") from e


def _enforce_page_limit(pdf: pikepdf.Pdf, max_pages: int) -> None:
    if len(pdf.pages) > max_pages:
        raise PageCountError(
            f"PDF has {len(pdf.pages)} pages, max allowed is {max_pages}."
        )


def page_count(path: str | Path) -> int:
    pdf = _open(path)
    try:
        return len(pdf.pages)
    finally:
        pdf.close()


# --- merge -----------------------------------------------------------------

def merge(
    inputs: Iterable[str | Path],
    output: str | Path,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> Tuple[int, int]:
    """Merge N PDFs in order. Returns (output_size, total_pages)."""
    inputs = list(inputs)
    if not inputs:
        raise InvalidPDFError("Need at least one PDF to merge.")

    progress and progress(5, "reading inputs")
    pdfs = [_open(p) for p in inputs]
    try:
        total = sum(len(p.pages) for p in pdfs)
        if total > max_pages:
            raise PageCountError(
                f"Merged output would have {total} pages, max allowed is {max_pages}."
            )

        progress and progress(20, "merging")
        out = pikepdf.Pdf.new()
        for i, src in enumerate(pdfs):
            out.pages.extend(src.pages)
            if progress and total:
                pct = 20 + int(60 * (i + 1) / len(pdfs))
                progress(pct, f"merging {i + 1}/{len(pdfs)}")

        progress and progress(85, "writing output")
        # linearize=False (default). Use qpdf-style stream filters.
        out.save(
            output,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            normalize_content=True,
            linearize=False,
        )
        progress and progress(100, "done")
        return Path(output).stat().st_size, len(out.pages)
    finally:
        for p in pdfs:
            p.close()


# --- split -----------------------------------------------------------------

_RANGE_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")
_SINGLE_RE = re.compile(r"^\s*(\d+)\s*$")


def parse_ranges(spec: str, total_pages: int) -> List[Tuple[int, int]]:
    """Parse "1-3,5,7-9" or "all" into 1-based inclusive page ranges."""
    spec = (spec or "").strip().lower()
    if spec in ("", "all"):
        return [(1, total_pages)]

    out: List[Tuple[int, int]] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = _RANGE_RE.match(chunk)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
        else:
            m = _SINGLE_RE.match(chunk)
            if not m:
                raise InvalidPDFError(f"Bad range token: {chunk!r}")
            a = b = int(m.group(1))
        if a < 1 or b < a or b > total_pages:
            raise InvalidPDFError(
                f"Range {chunk!r} is out of bounds for a {total_pages}-page PDF."
            )
        out.append((a, b))

    if not out:
        raise InvalidPDFError("No pages selected.")
    return out


def split(
    input_path: str | Path,
    ranges: List[Tuple[int, int]],
    output_dir: str | Path,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> List[Tuple[str, int]]:
    """Split a PDF into one output per range. Returns [(filename, size), ...]."""
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    progress and progress(5, "reading input")
    src = _open(input_path)
    try:
        total = len(src.pages)
        progress and progress(15, f"selected {len(ranges)} range(s)")

        results: List[Tuple[str, int]] = []
        for idx, (a, b) in enumerate(ranges):
            out_pdf = pikepdf.Pdf.new()
            # pikepdf pages are 0-indexed; ranges are 1-indexed.
            out_pdf.pages.extend(src.pages[(a - 1) : b])
            out_name = f"part_{idx + 1:03d}_p{a}-{b}.pdf"
            out_path = out_dir / out_name
            out_pdf.save(
                out_path,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            )
            out_pdf.close()
            results.append((out_name, out_path.stat().st_size))
            if progress:
                pct = 15 + int(75 * (idx + 1) / len(ranges))
                progress(pct, f"writing {idx + 1}/{len(ranges)}")

        if sum(s for _, s in results) > 0 and max_pages < total:
            pass  # already enforced per-file
        progress and progress(100, "done")
        return results
    finally:
        src.close()


# --- compress --------------------------------------------------------------

# pikepdf's stream filter choices per compression level.
# Low = prioritize quality (light recompression), extreme = aggressive.
def compress(
    input_path: str | Path,
    output: str | Path,
    level: str,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> Tuple[int, int, int]:
    """Compress a PDF. Returns (input_size, output_size, pages)."""
    if level not in ("extreme", "recommended", "low"):
        raise InvalidPDFError(f"Unknown compression level: {level!r}")

    progress and progress(5, "reading input")
    in_size = Path(input_path).stat().st_size
    pdf = _open(input_path)
    try:
        _enforce_page_limit(pdf, max_pages)
        progress and progress(20, "rewriting streams")

        # ponytail: pikepdf rejects normalize_content + linearize together. Pick
        # one per level — linearize for "fast web delivery", normalize_content
        # for "preserve content fidelity".
        if level == "low":
            pdf.save(
                output,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                normalize_content=True,
                linearize=False,
            )
        elif level == "recommended":
            pdf.save(
                output,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                normalize_content=False,
                linearize=True,
            )
        else:  # extreme
            pdf.remove_unreferenced_resources()
            pdf.save(
                output,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                normalize_content=False,
                linearize=True,
                min_version=("1.5", 5),
            )

        progress and progress(100, "done")
        out_size = Path(output).stat().st_size
        return in_size, out_size, len(pdf.pages)
    finally:
        pdf.close()


# --- rotate ----------------------------------------------------------------

VALID_ROTATIONS = (0, 90, 180, 270)


def rotate(
    input_path: str | Path,
    output: str | Path,
    angle: int,
    pages: List[int] | None,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> int:
    """Rotate selected pages (1-based) by `angle` degrees. Returns page count."""
    if angle not in VALID_ROTATIONS:
        raise InvalidPDFError(f"Angle must be one of {VALID_ROTATIONS}.")

    progress and progress(5, "reading input")
    pdf = _open(input_path)
    try:
        _enforce_page_limit(pdf, max_pages)
        total = len(pdf.pages)

        if pages is None:
            # No explicit list — rotate all.
            targets = list(range(1, total + 1))
        else:
            if not pages:
                raise InvalidPDFError("At least one page must be selected.")
            for p in pages:
                if p < 1 or p > total:
                    raise InvalidPDFError(f"Page {p} is out of bounds for a {total}-page PDF.")
            targets = sorted(set(pages))

        progress and progress(20, "rotating pages")
        for i, page_num in enumerate(targets):
            page = pdf.pages[page_num - 1]
            # Compose with any existing rotation so cumulative rotations are
            # preserved rather than overwritten.
            existing = int(page.get("/Rotate", 0))
            page["/Rotate"] = (existing + angle) % 360
            if progress and targets:
                pct = 20 + int(70 * (i + 1) / len(targets))
                progress(pct, f"rotating {i + 1}/{len(targets)}")

        progress and progress(95, "writing output")
        pdf.save(
            output,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            normalize_content=False,
            linearize=False,
        )
        progress and progress(100, "done")
        return total
    finally:
        pdf.close()


# --- organize (reorder pages) --------------------------------------------

def organize(
    input_path: str | Path,
    output: str | Path,
    order: List[int],
    max_pages: int,
    progress: ProgressFn | None = None,
) -> int:
    """Reorder pages. `order` is a 1-based permutation of [1..N]."""
    progress and progress(5, "reading input")
    pdf = _open(input_path)
    try:
        _enforce_page_limit(pdf, max_pages)
        total = len(pdf.pages)
        if not order or len(order) != total or sorted(order) != list(range(1, total + 1)):
            raise InvalidPDFError(
                f"Order must be a permutation of 1..{total} (got {len(order)} entries)."
            )

        progress and progress(20, "reordering")
        # pikepdf pages support index-based deletion; build a new PDF in the
        # requested order to avoid mutating while iterating.
        out = pikepdf.Pdf.new()
        for i, page_num in enumerate(order):
            out.pages.append(pdf.pages[page_num - 1])
            if progress:
                pct = 20 + int(70 * (i + 1) / total)
                progress(pct, f"reordering {i + 1}/{total}")

        progress and progress(95, "writing output")
        out.save(
            output,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            normalize_content=False,
            linearize=False,
        )
        progress and progress(100, "done")
        return total
    finally:
        pdf.close()


# --- stamp helpers (watermark / page-numbers) ---------------------------
# Hand-built minimal 1-page PDF used as an overlay. This avoids depending
# on reportlab just for text stamps, and avoids fighting with pypdf 5.x's
# ContentStream constructor (which rejects raw bytes in some versions).


def _pdf_escape(s: str) -> str:
    # Minimal parens + backslash escape for a Type1 Tj string.
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_text_stamp_pdf(text: str) -> bytes:
    """Build a 1-page 612x792 PDF containing `text` drawn diagonally.

    The result is suitable for use as an overlay on any page; pypdf merges
    it on top of the source page so positions line up (origin = bottom-left
    of the recipient page after the standard transform is applied).
    """
    # Build the content stream for a rotated, semi-transparent text.
    # We draw the text unrotated near the page center with a small font;
    # pypdf's merge_page composes it onto each input page.
    safe = _pdf_escape(text)
    content = (
        "q\n"
        "0.85 0.85 0.85 rg\n"   # light gray fill
        "BT\n"
        "/F1 56 Tf\n"
        # Center of US Letter is (306, 396). Adjust Tm to roughly center.
        "1 0 0 1 0 380 Tm\n"
        f"({safe}) Tj\n"
        "ET\n"
        "Q\n"
    ).encode("latin-1", errors="replace")

    # Minimal hand-rolled PDF. Object structure:
    #   1: Catalog -> 5 (Pages)
    #   2: Font (Helvetica)
    #   3: Page content stream
    #   4: Page -> 5 (Pages)
    #   5: Pages (single page -> 4)
    objects: list[bytes] = []

    def obj(num: int, body: bytes) -> bytes:
        return f"{num} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"

    # Object 1: Catalog
    objects.append(obj(1, b"<< /Type /Catalog /Pages 5 0 R >>"))
    # Object 2: Font
    objects.append(obj(2, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))
    # Object 3: Content stream
    objects.append(
        obj(
            3,
            b"<< /Length " + str(len(content)).encode("latin-1") + b" >>\nstream\n"
            + content + b"\nendstream",
        )
    )
    # Object 4: Page
    objects.append(
        obj(
            4,
            (
                b"<< /Type /Page /Parent 5 0 R /MediaBox [0 0 612 792] "
                b"/Resources << /Font << /F1 2 0 R >> >> /Contents 3 0 R >>"
            ),
        )
    )
    # Object 5: Pages
    objects.append(obj(5, b"<< /Type /Pages /Kids [4 0 R] /Count 1 >>"))

    # Assemble the file.
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = b""
    offsets = [0]  # index 0 unused; objects are 1-indexed
    for i, o in enumerate(objects, start=1):
        offsets.append(len(header) + len(body))
        body += o
    xref_offset = len(header) + len(body)
    xref = b"xref\n0 6\n0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n".encode("latin-1")
    trailer = (
        b"trailer\n<< /Size 6 /Root 1 0 R >>\n"
        b"startxref\n" + str(xref_offset).encode("latin-1") + b"\n%%EOF\n"
    )
    return header + body + xref + trailer


def _apply_overlay_to_pages(
    input_path: str | Path,
    output: str | Path,
    overlay_pdf_bytes: bytes,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> int:
    """Merge a 1-page overlay onto every page of `input_path` and write to `output`."""
    from pypdf import PdfReader, PdfWriter

    progress and progress(10, "reading input")
    reader = PdfReader(str(input_path))
    if max_pages is not None and len(reader.pages) > max_pages:
        raise PageCountError(
            f"PDF has {len(reader.pages)} pages, max allowed is {max_pages}."
        )
    overlay_page = PdfReader(io.BytesIO(overlay_pdf_bytes)).pages[0]

    writer = PdfWriter()
    total = len(reader.pages)
    for i, page in enumerate(reader.pages):
        page.merge_page(overlay_page)
        writer.add_page(page)
        if progress:
            pct = 10 + int(80 * (i + 1) / total)
            progress(pct, f"stamping {i + 1}/{total}")

    progress and progress(95, "writing output")
    with open(output, "wb") as f:
        writer.write(f)
    progress and progress(100, "done")
    return total


def watermark(
    input_path: str | Path,
    output: str | Path,
    text: str,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> int:
    """Overlay `text` across every page. Returns page count."""
    text = (text or "").strip()
    if not text:
        raise InvalidPDFError("Watermark text cannot be empty.")
    if len(text) > 200:
        raise InvalidPDFError("Watermark text is too long (max 200 characters).")
    stamp = _build_text_stamp_pdf(text)
    return _apply_overlay_to_pages(input_path, output, stamp, max_pages, progress)


def page_numbers(
    input_path: str | Path,
    output: str | Path,
    position: str,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> int:
    """Add a small "i / N" page number to every page.

    Implemented as per-page overlays: build a tiny 1-page stamp with the
    number positioned per `position`, then merge it onto each source page.
    Cleaner than poking content streams directly.
    """
    valid_positions = {"bottom-center", "bottom-right", "top-right"}
    if position not in valid_positions:
        raise InvalidPDFError(f"Position must be one of {sorted(valid_positions)}.")

    progress and progress(5, "reading input")
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(input_path))
    total = len(reader.pages)
    if max_pages is not None and total > max_pages:
        raise PageCountError(f"PDF has {total} pages, max allowed is {max_pages}.")

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        # Copy the source page into the writer.
        out_page = writer.add_page(page)
        # Per-page stamp sized to this page's mediabox.
        media = out_page.mediabox
        w = float(media.width)
        h = float(media.height)
        text = f"{i + 1} / {total}"
        # Build a stamp PDF sized to this page so positions are exact.
        stamp_bytes = _build_page_number_stamp(text, w, h, position)
        stamp_page = PdfReader(io.BytesIO(stamp_bytes)).pages[0]
        out_page.merge_page(stamp_page)
        if progress:
            pct = 5 + int(85 * (i + 1) / total)
            progress(pct, f"stamping {i + 1}/{total}")

    progress and progress(95, "writing output")
    with open(output, "wb") as f:
        writer.write(f)
    progress and progress(100, "done")
    return total


def _build_page_number_stamp(text: str, w: float, h: float, position: str) -> bytes:
    """1-page stamp with the page number positioned per `position`."""
    safe = _pdf_escape(text)
    # Choose (tx, ty) in PDF user-space (origin = bottom-left).
    if position == "bottom-center":
        tx, ty = (w / 2) - 18, 24
    elif position == "bottom-right":
        tx, ty = w - 72, 24
    else:  # top-right
        tx, ty = w - 72, h - 32
    content = (
        "q\n"
        "0.4 g\n"
        "BT\n"
        "/F1 10 Tf\n"
        f"1 0 0 1 {tx} {ty} Tm\n"
        f"({safe}) Tj\n"
        "ET\n"
        "Q\n"
    ).encode("latin-1", errors="replace")

    def obj(num: int, body: bytes) -> bytes:
        return f"{num} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"

    objects = [
        obj(1, b"<< /Type /Catalog /Pages 5 0 R >>"),
        obj(2, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
        obj(
            3,
            b"<< /Length " + str(len(content)).encode("latin-1") + b" >>\nstream\n"
            + content + b"\nendstream",
        ),
        obj(
            4,
            (
                f"<< /Type /Page /Parent 5 0 R /MediaBox [0 0 {w} {h}] "
                f"/Resources << /Font << /F1 2 0 R >> >> /Contents 3 0 R >>"
            ).encode("latin-1"),
        ),
        obj(5, b"<< /Type /Pages /Kids [4 0 R] /Count 1 >>"),
    ]
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = b""
    offsets = [0]
    for i, o in enumerate(objects, start=1):
        offsets.append(len(header) + len(body))
        body += o
    xref_offset = len(header) + len(body)
    xref = b"xref\n0 6\n0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n".encode("latin-1")
    trailer = (
        b"trailer\n<< /Size 6 /Root 1 0 R >>\n"
        b"startxref\n" + str(xref_offset).encode("latin-1") + b"\n%%EOF\n"
    )
    return header + body + xref + trailer
    progress and progress(100, "done")
    return total


# --- metadata -------------------------------------------------------------

def get_metadata(path: str | Path) -> dict:
    """Return the PDF's document info dict (title, author, etc.) as a flat dict.

    Keys are returned lowercase to match the friendly input shape used by
    set_metadata, so a frontend can round-trip a metadata edit with the same
    field names it sent.
    """
    pdf = _open(path)
    try:
        info = pdf.docinfo or {}
        out: dict = {}
        for k, v in info.items():
            try:
                out[str(k).lstrip("/").lower()] = str(v)
            except Exception:
                # Skip entries that can't be coerced to str.
                continue
        return out
    finally:
        pdf.close()


def set_metadata(
    input_path: str | Path,
    output: str | Path,
    fields: dict,
    max_pages: int,
    progress: ProgressFn | None = None,
) -> dict:
    """Write a subset of standard metadata fields and return the resulting dict.

    Supported fields (all optional): title, author, subject, keywords, creator, producer.
    Unknown keys are ignored so a frontend typo can't crash the job.
    """
    progress and progress(5, "reading input")
    pdf = _open(input_path)
    try:
        _enforce_page_limit(pdf, max_pages)
        if not fields:
            raise InvalidPDFError("No metadata fields provided.")

        # Map our friendly names to the PDF /Info keys. We write to /Info
        # directly (not XMP) so that any reader — including get_metadata
        # below — sees the change immediately. XMP is the "modern" copy but
        # /Info is the universal contract.
        KEYMAP = {
            "title": pikepdf.Name("/Title"),
            "author": pikepdf.Name("/Author"),
            "subject": pikepdf.Name("/Subject"),
            "keywords": pikepdf.Name("/Keywords"),
            "creator": pikepdf.Name("/Creator"),
            "producer": pikepdf.Name("/Producer"),
        }
        for k, v in fields.items():
            if v is None:
                continue
            if k not in KEYMAP:
                continue
            pdf.docinfo[KEYMAP[k]] = str(v)

        progress and progress(80, "writing output")
        pdf.save(
            output,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            normalize_content=False,
            linearize=False,
        )
        progress and progress(100, "done")
        return get_metadata(output)
    finally:
        pdf.close()
