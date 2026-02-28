"""
Tests for sources/epub_parser.py
Uses the test EPUB in inbox/.
"""
import pytest
from pathlib import Path

EPUB_PATH = Path(__file__).parent.parent.parent / "inbox" / "Joanna Chmielewska - Wszyscy jestesmy podejrzani.epub"


@pytest.mark.skipif(not EPUB_PATH.exists(), reason="Test EPUB not found in inbox/")
def test_parse_epub_returns_structure():
    from sources.epub_parser import parse_epub
    book = parse_epub(EPUB_PATH)

    assert "title" in book
    assert "author" in book
    assert "slug" in book
    assert "chapters" in book
    assert len(book["chapters"]) >= 1


@pytest.mark.skipif(not EPUB_PATH.exists(), reason="Test EPUB not found in inbox/")
def test_parse_epub_chapters_have_text():
    from sources.epub_parser import parse_epub
    book = parse_epub(EPUB_PATH)

    for ch in book["chapters"]:
        assert "number" in ch
        assert "title" in ch
        assert "text" in ch
        assert len(ch["text"]) > 0


@pytest.mark.skipif(not EPUB_PATH.exists(), reason="Test EPUB not found in inbox/")
def test_parse_epub_no_soft_hyphens():
    from sources.epub_parser import parse_epub
    book = parse_epub(EPUB_PATH)

    SOFT_HYPHEN = "\u00ad"
    for ch in book["chapters"]:
        assert SOFT_HYPHEN not in ch["text"], "Soft hyphens should be removed"
