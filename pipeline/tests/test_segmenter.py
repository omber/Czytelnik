"""
Tests for processing/segmenter.py
Run with: pytest pipeline/tests/test_segmenter.py
"""
import pytest

# We need a minimal spaCy model; if not available, skip
try:
    import spacy
    nlp = spacy.load("pl_core_news_lg")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False

from processing.segmenter import (
    _split_paragraphs,
    segment_chapter,
)


def test_split_paragraphs_basic():
    text = "Pierwsza akapit.\n\nDruga akapit.\n\nTrzecia akapit."
    result = _split_paragraphs(text)
    assert len(result) == 3
    assert result[0] == "Pierwsza akapit."


def test_split_paragraphs_collapses_blanks():
    text = "A\n\n\n\nB"
    result = _split_paragraphs(text)
    assert len(result) == 2


def test_split_paragraphs_strips():
    text = "  Hello world.  \n\n  Goodbye.  "
    result = _split_paragraphs(text)
    assert result[0] == "Hello world."
    assert result[1] == "Goodbye."


@pytest.mark.skipif(not SPACY_AVAILABLE, reason="pl_core_news_lg not installed")
def test_segment_chapter_structure():
    text = "Była ciemna noc. Wiatr wiał z północy.\n\nStaś siedział przy ogniu."
    paragraphs = segment_chapter(text, nlp)
    assert len(paragraphs) == 2
    assert paragraphs[0]["index"] == 0
    assert paragraphs[1]["index"] == 1
    # Each paragraph has at least 1 sentence
    assert len(paragraphs[0]["sentences"]) >= 1
    assert len(paragraphs[1]["sentences"]) >= 1


@pytest.mark.skipif(not SPACY_AVAILABLE, reason="pl_core_news_lg not installed")
def test_segment_chapter_tokens():
    text = "Kot siedział na macie."
    paragraphs = segment_chapter(text, nlp)
    tokens = paragraphs[0]["sentences"][0]["tokens"]
    surfaces = [t["surface"] for t in tokens]
    assert "Kot" in surfaces
    assert "siedział" in surfaces
