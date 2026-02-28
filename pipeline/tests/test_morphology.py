"""
Tests for processing/morphology.py
"""
import pytest

try:
    import spacy
    nlp = spacy.load("pl_core_news_lg")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False

from processing.segmenter import segment_chapter
from processing.morphology import enrich_paragraph, enrich_chapter


@pytest.mark.skipif(not SPACY_AVAILABLE, reason="pl_core_news_lg not installed")
def test_enrich_paragraph_fields():
    text = "Duży pies śpi."
    raw_paras = segment_chapter(text, nlp)
    enriched = enrich_paragraph(raw_paras[0], nlp)

    assert enriched["index"] == 0
    sent = enriched["sentences"][0]
    assert "translation" in sent
    assert sent["translation"] == ""  # not filled yet

    for tok in sent["tokens"]:
        assert "surface" in tok
        assert "lemma" in tok
        assert "pos" in tok
        assert "morph" in tok
        assert "is_punct" in tok
        assert "is_space" in tok


@pytest.mark.skipif(not SPACY_AVAILABLE, reason="pl_core_news_lg not installed")
def test_enrich_chapter_multiple_paragraphs():
    text = "Kot śpi.\n\nPies biega."
    raw_paras = segment_chapter(text, nlp)
    paragraphs = enrich_chapter(raw_paras, nlp)

    assert len(paragraphs) == 2
    # Verify a nominal token (NOUN or PROPN) is detected — spaCy may tag
    # a capitalised word at sentence-start as PROPN instead of NOUN.
    first_tokens = paragraphs[0]["sentences"][0]["tokens"]
    nominals = [t for t in first_tokens if t["pos"] in ("NOUN", "PROPN")]
    assert len(nominals) >= 1
