"""
Morphological analysis pass.

Enriches RawParagraph/RawSentence/RawToken structures produced by segmenter.py
with spaCy morphological data (lemma, POS, morph features).

This is a second pass — segmenter already ran spaCy for sentence boundaries.
We re-run spaCy per sentence here so that morphology is always consistent
and isolated (avoids cross-sentence context bleed on very long paragraphs).
"""
from __future__ import annotations

from typing import TypedDict

from spacy.language import Language

from processing.segmenter import RawParagraph


# ── Output types (enriched) ────────────────────────────────────────────────

class Token(TypedDict):
    surface: str
    lemma: str
    pos: str        # Universal POS tag (NOUN, VERB, ADJ, …)
    morph: str      # spaCy morph string, e.g. "Case=Nom|Gender=Masc|Number=Sing"
    is_punct: bool
    is_space: bool


class Sentence(TypedDict):
    index: int
    tokens: list[Token]
    # translation filled later by translator.py
    translation: str


class Paragraph(TypedDict):
    index: int
    sentences: list[Sentence]


# ── Core function ──────────────────────────────────────────────────────────

def enrich_paragraph(raw_para: RawParagraph, nlp: Language) -> Paragraph:
    """
    Take a RawParagraph from segmenter and return a Paragraph with full morphology.

    We reconstruct text per sentence and re-run spaCy on it so token alignment
    is guaranteed (the raw tokens are surfaced as a joined string).
    """
    enriched_sentences: list[Sentence] = []

    for raw_sent in raw_para["sentences"]:
        # Use the original sentence text (with whitespace) stored by the segmenter
        sent_text = raw_sent["text"]
        doc = nlp(sent_text)

        tokens: list[Token] = []
        for tok in doc:
            tokens.append({
                "surface": tok.text,
                "lemma": tok.lemma_,
                "pos": tok.pos_,
                "morph": str(tok.morph),
                "is_punct": tok.is_punct,
                "is_space": tok.is_space,
            })

        enriched_sentences.append({
            "index": raw_sent["index"],
            "tokens": tokens,
            "translation": "",  # filled by translator
        })

    return {"index": raw_para["index"], "sentences": enriched_sentences}


def enrich_chapter(raw_paragraphs: list[RawParagraph], nlp: Language) -> list[Paragraph]:
    """Enrich all paragraphs in a chapter."""
    return [enrich_paragraph(p, nlp) for p in raw_paragraphs]
