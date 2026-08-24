"""Tests for Phase 2 PDF operations: rotate, organize, watermark, page_numbers, metadata."""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `from test_pdf_ops import _make_pdf` even though tests/ isn't a package.
_TESTS_DIR = Path(__file__).resolve().parent
if str(_TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(_TESTS_DIR))

import pikepdf
import pytest

import pdf_ops
from validation import InvalidPDFError
from test_pdf_ops import _make_pdf


@pytest.fixture(scope="session")
def five_page_pdf() -> Path:
    p = Path(__file__).parent / "fixtures" / "five_page.pdf"
    if not p.exists():
        _make_pdf(p, pages=5)
    return p


# --- rotate ----------------------------------------------------------------

def test_rotate_all_90(five_page_pdf, tmp_path):
    out = tmp_path / "r.pdf"
    pages = pdf_ops.rotate(five_page_pdf, out, angle=90, pages=None, max_pages=10)
    assert pages == 5
    # Every page should report /Rotate=90.
    with pikepdf.open(out) as pdf:
        for p in pdf.pages:
            assert int(p.get("/Rotate", 0)) == 90


def test_rotate_specific_pages(five_page_pdf, tmp_path):
    out = tmp_path / "r.pdf"
    pdf_ops.rotate(five_page_pdf, out, angle=180, pages=[1, 3], max_pages=10)
    with pikepdf.open(out) as pdf:
        # 1-indexed -> pages 1 and 3 should be 180, others 0.
        for i, p in enumerate(pdf.pages, start=1):
            expected = 180 if i in (1, 3) else 0
            assert int(p.get("/Rotate", 0)) == expected


def test_rotate_invalid_angle(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.rotate(five_page_pdf, tmp_path / "r.pdf", angle=45, pages=None, max_pages=10)


def test_rotate_out_of_bounds(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.rotate(five_page_pdf, tmp_path / "r.pdf", angle=90, pages=[99], max_pages=10)


def test_rotate_empty_pages(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.rotate(five_page_pdf, tmp_path / "r.pdf", angle=90, pages=[], max_pages=10)


# --- organize --------------------------------------------------------------

def test_organize_reverse(five_page_pdf, tmp_path):
    out = tmp_path / "o.pdf"
    order = [5, 4, 3, 2, 1]
    pages = pdf_ops.organize(five_page_pdf, out, order=order, max_pages=10)
    assert pages == 5
    with pikepdf.open(out) as pdf:
        assert len(pdf.pages) == 5


def test_organize_bad_permutation(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        # missing page 1
        pdf_ops.organize(five_page_pdf, tmp_path / "o.pdf", order=[2, 3, 4, 5], max_pages=10)
    with pytest.raises(InvalidPDFError):
        # duplicate
        pdf_ops.organize(five_page_pdf, tmp_path / "o.pdf", order=[1, 2, 3, 3, 5], max_pages=10)
    with pytest.raises(InvalidPDFError):
        # wrong count
        pdf_ops.organize(five_page_pdf, tmp_path / "o.pdf", order=[1, 2, 3, 4], max_pages=10)


# --- watermark -------------------------------------------------------------

def test_watermark_runs(five_page_pdf, tmp_path):
    out = tmp_path / "w.pdf"
    pages = pdf_ops.watermark(five_page_pdf, out, "CONFIDENTIAL", max_pages=10)
    assert pages == 5
    assert out.stat().st_size > 0
    # Output is openable.
    pdf_ops.page_count(out)


def test_watermark_empty_text_raises(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.watermark(five_page_pdf, tmp_path / "w.pdf", "   ", max_pages=10)


def test_watermark_too_long(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.watermark(five_page_pdf, tmp_path / "w.pdf", "x" * 201, max_pages=10)


# --- page numbers ----------------------------------------------------------

def test_page_numbers_runs(five_page_pdf, tmp_path):
    for pos in ("bottom-center", "bottom-right", "top-right"):
        out = tmp_path / f"pn-{pos}.pdf"
        pages = pdf_ops.page_numbers(five_page_pdf, out, position=pos, max_pages=10)
        assert pages == 5
        pdf_ops.page_count(out)


def test_page_numbers_invalid_position(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.page_numbers(five_page_pdf, tmp_path / "p.pdf", position="nope", max_pages=10)


# --- metadata --------------------------------------------------------------

def test_get_metadata_returns_dict(five_page_pdf):
    meta = pdf_ops.get_metadata(five_page_pdf)
    assert isinstance(meta, dict)


def test_set_metadata_round_trip(five_page_pdf, tmp_path):
    out = tmp_path / "m.pdf"
    fields = {
        "title": "My Document",
        "author": "PDFForge",
        "subject": "Test",
        "keywords": "test, metadata",
    }
    result = pdf_ops.set_metadata(five_page_pdf, out, fields, max_pages=10)
    # Returned dict uses the friendly lowercase form.
    assert result.get("title") == "My Document"
    assert result.get("author") == "PDFForge"
    # Reading back via get_metadata on the new file should match.
    assert pdf_ops.get_metadata(out).get("title") == "My Document"


def test_set_metadata_no_fields_raises(five_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.set_metadata(five_page_pdf, tmp_path / "m.pdf", {}, max_pages=10)


def test_set_metadata_ignores_unknown_keys(five_page_pdf, tmp_path):
    out = tmp_path / "m.pdf"
    # No error, just dropped.
    result = pdf_ops.set_metadata(
        five_page_pdf, out, {"title": "OK", "garbage": "x"}, max_pages=10
    )
    assert result.get("title") == "OK"
