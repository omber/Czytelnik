"""
Text segmentation: chapter text → paragraphs → sentences → token lists.

Uses spaCy's sentence segmenter. Short sentences (<MIN_SENTENCE_TOKENS non-punct
tokens) are merged with the preceding sentence.
"""
from __future__ import annotations

import re
from typing import TypedDict

import spacy
from spacy.language import Language

from config import MIN_SENTENCE_TOKENS


# ── Types ──────────────────────────────────────────────────────────────────

class RawToken(TypedDict):
    """Minimal token before morphology pass."""
    surface: str
    is_punct: bool
    is_space: bool


class RawSentence(TypedDict):
    index: int          # 0-based within paragraph
    text: str           # original sentence text (with whitespace, for re-parsing)
    tokens: list[RawToken]


class RawParagraph(TypedDict):
    index: int          # 0-based within chapter
    sentences: list[RawSentence]


# ── Paragraph splitting ────────────────────────────────────────────────────

def _split_paragraphs(text: str) -> list[str]:
    """Split chapter text on blank lines; skip empty results."""
    raw = re.split(r"\n{2,}", text)
    return [p.strip() for p in raw if p.strip()]


# ── Sentence segmentation ──────────────────────────────────────────────────

def _count_content_tokens(span) -> int:
    """Count non-punct, non-space tokens in a spaCy span."""
    return sum(1 for t in span if not t.is_punct and not t.is_space)


def _sentence_to_raw_tokens(span) -> list[RawToken]:
    return [
        {"surface": t.text, "is_punct": t.is_punct, "is_space": t.is_space}
        for t in span
    ]


def _merge_short_sentences(sents: list) -> list[list]:
    """
    Merge spaCy sentence spans that are too short into the previous sentence.
    Returns list-of-token-lists (each item is a flat list of spaCy tokens).
    """
    merged: list[list] = []
    for sent in sents:
        tokens = list(sent)
        if merged and _count_content_tokens(sent) < MIN_SENTENCE_TOKENS:
            merged[-1].extend(tokens)
        else:
            merged.append(tokens)
    return merged


def _tokens_from_list(token_list: list) -> list[RawToken]:
    return [
        {"surface": t.text, "is_punct": t.is_punct, "is_space": t.is_space}
        for t in token_list
    ]


# ── Main API ───────────────────────────────────────────────────────────────

def segment_chapter(text: str, nlp: Language) -> list[RawParagraph]:
    """
    Segment a chapter's plain text into paragraphs → sentences → tokens.

    Parameters
    ----------
    text : str
        Raw chapter text (may contain multiple lines / paragraphs).
    nlp : spacy.Language
        Loaded spaCy model (pl_core_news_lg).

    Returns
    -------
    list[RawParagraph]
        Nested structure: paragraphs containing sentences containing tokens.
    """
    paragraphs_text = _split_paragraphs(text)
    result: list[RawParagraph] = []

    for p_idx, para_text in enumerate(paragraphs_text):
        doc = nlp(para_text)
        sents = list(doc.sents)
        merged = _merge_short_sentences(sents)

        sentences: list[RawSentence] = []
        for s_idx, token_list in enumerate(merged):
            raw_tokens = _tokens_from_list(token_list)
            # text_with_ws preserves original spacing (needed for re-parsing in morphology)
            sent_text = "".join(t.text_with_ws for t in token_list)
            sentences.append({"index": s_idx, "text": sent_text, "tokens": raw_tokens})

        result.append({"index": p_idx, "sentences": sentences})

    return result
