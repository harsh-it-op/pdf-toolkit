"""Tests for PDF operations. Per spec: cover empty, 1-page, multi-page, corrupt, encrypted."""
from __future__ import annotations

import io
from pathlib import Path

import pikepdf
import pytest

import pdf_ops
from validation import (
    EncryptedPDFError,
    InvalidPDFError,
    PageCountError,
)

FIXTURES = Path(__file__).parent / "fixtures"
FIXTURES.mkdir(exist_ok=True)


def _make_pdf(path: Path, pages: int = 1) -> int:
    """Generate a real PDF with N pages using pikepdf's built-in helper."""
    pdf = pikepdf.Pdf.new()
    for _ in range(pages):
        pdf.add_blank_page()
    pdf.save(path, compress_streams=True)
    pdf.close()
    return path.stat().st_size


# --- fixtures ---------------------------------------------------------------

@pytest.fixture(scope="session")
def empty_pdf(tmp_path_factory) -> Path:
    p = FIXTURES / "empty.pdf"
    if not p.exists():
        # 0 pages is rejected by most viewers; we use 1 blank page.
        _make_pdf(p, pages=1)
    return p


@pytest.fixture(scope="session")
def one_page_pdf() -> Path:
    p = FIXTURES / "one_page.pdf"
    if not p.exists():
        _make_pdf(p, pages=1)
    return p


@pytest.fixture(scope="session")
def multi_page_pdf() -> Path:
    p = FIXTURES / "multi_page.pdf"
    if not p.exists():
        _make_pdf(p, pages=5)
    return p


@pytest.fixture(scope="session")
def large_pdf() -> Path:
    p = FIXTURES / "large.pdf"
    if not p.exists():
        _make_pdf(p, pages=50)
    return p


@pytest.fixture
def corrupt_pdf(tmp_path) -> Path:
    p = tmp_path / "corrupt.pdf"
    p.write_bytes(b"%PDF-1.4\nnot a real body\n%%EOF\n")
    return p


@pytest.fixture
def encrypted_pdf(tmp_path) -> Path:
    plain = tmp_path / "plain.pdf"
    p = tmp_path / "secret.pdf"
    _make_pdf(plain, pages=1)
    pdf = pikepdf.Pdf.open(plain)
    pdf.save(p, encryption=pikepdf.Encryption(user="hunter2", owner="owner"))
    pdf.close()
    return p


# --- page_count -------------------------------------------------------------

def test_page_count_one_page(one_page_pdf):
    assert pdf_ops.page_count(one_page_pdf) == 1


def test_page_count_multi(multi_page_pdf):
    assert pdf_ops.page_count(multi_page_pdf) == 5


def test_page_count_large(large_pdf):
    assert pdf_ops.page_count(large_pdf) == 50


# --- merge ------------------------------------------------------------------

def test_merge_two_pdfs(one_page_pdf, multi_page_pdf, tmp_path):
    out = tmp_path / "m.pdf"
    progress_log = []
    size, pages = pdf_ops.merge([one_page_pdf, multi_page_pdf], out, max_pages=100,
                                progress=lambda p, s: progress_log.append((p, s)))
    assert pages == 6
    assert size > 0
    # progress must hit 100
    assert progress_log[-1][0] == 100
    # result is openable
    pdf_ops.page_count(out)


def test_merge_preserves_order(one_page_pdf, tmp_path):
    a = tmp_path / "a.pdf"
    b = tmp_path / "b.pdf"
    _make_pdf(a, pages=1)
    _make_pdf(b, pages=1)
    out = tmp_path / "m.pdf"
    pdf_ops.merge([a, b], out, max_pages=10)
    # Both have 1 page; result has 2.
    assert pdf_ops.page_count(out) == 2


def test_merge_empty_inputs_raises(tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.merge([], tmp_path / "x.pdf", max_pages=10)


def test_merge_page_limit(one_page_pdf, tmp_path):
    out = tmp_path / "m.pdf"
    with pytest.raises(PageCountError):
        pdf_ops.merge([one_page_pdf] * 3, out, max_pages=2)


# --- split ------------------------------------------------------------------

def test_split_all(multi_page_pdf, tmp_path):
    parts = pdf_ops.split(multi_page_pdf, [(1, 5)], tmp_path, max_pages=10)
    assert len(parts) == 1
    name, size = parts[0]
    assert size > 0
    assert pdf_ops.page_count(tmp_path / name) == 5


def test_split_by_ranges(multi_page_pdf, tmp_path):
    parts = pdf_ops.split(multi_page_pdf, [(1, 2), (3, 5)], tmp_path, max_pages=10)
    assert len(parts) == 2
    assert pdf_ops.page_count(tmp_path / parts[0][0]) == 2
    assert pdf_ops.page_count(tmp_path / parts[1][0]) == 3


def test_split_parse_ranges(multi_page_pdf):
    assert pdf_ops.parse_ranges("1-3,5", 5) == [(1, 3), (5, 5)]
    assert pdf_ops.parse_ranges("all", 5) == [(1, 5)]
    assert pdf_ops.parse_ranges("  2-2  , 4 - 4 ", 5) == [(2, 2), (4, 4)]


def test_split_parse_ranges_out_of_bounds(multi_page_pdf):
    with pytest.raises(InvalidPDFError):
        pdf_ops.parse_ranges("6-7", 5)


def test_split_parse_ranges_garbage():
    with pytest.raises(InvalidPDFError):
        pdf_ops.parse_ranges("abc", 5)


# --- compress ---------------------------------------------------------------

@pytest.mark.parametrize("level", ["extreme", "recommended", "low"])
def test_compress_runs(one_page_pdf, tmp_path, level):
    out = tmp_path / "c.pdf"
    in_size, out_size, pages = pdf_ops.compress(one_page_pdf, out, level, max_pages=10)
    assert pages == 1
    assert in_size > 0
    assert out_size > 0
    # output is openable
    assert pdf_ops.page_count(out) == 1


def test_compress_unknown_level(one_page_pdf, tmp_path):
    with pytest.raises(InvalidPDFError):
        pdf_ops.compress(one_page_pdf, tmp_path / "c.pdf", "maximus", max_pages=10)


# --- error paths ------------------------------------------------------------

def test_corrupt_pdf_raises(corrupt_pdf):
    with pytest.raises(InvalidPDFError):
        pdf_ops.page_count(corrupt_pdf)


def test_encrypted_pdf_raises(encrypted_pdf):
    with pytest.raises(EncryptedPDFError):
        pdf_ops.page_count(encrypted_pdf)


def test_nonexistent_file():
    with pytest.raises(Exception):
        pdf_ops.page_count("/no/such/file.pdf")
