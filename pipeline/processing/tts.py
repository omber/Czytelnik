"""
TTS audio generation using Microsoft edge-tts.

For each sentence we generate:
  - s-{para_idx}-{sent_idx}.mp3         — audio file
  - s-{para_idx}-{sent_idx}.timing.json — word-level timing aligned with spaCy tokens

Timing alignment
----------------
edge-tts emits WordBoundary events with:
  {"text": word_text, "offset": offset_100ns, "duration": duration_100ns}

We align these events to spaCy token indices by matching on surface text,
skipping punctuation/whitespace tokens.  The result is a list:
  [{"token_index": int, "start_ms": float, "end_ms": float}, …]

The audio can be skipped globally via --no-tts, but the timing JSON will still
be empty (has_audio: false) so the frontend knows to fall back to Web Speech API.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import edge_tts

from config import TTS_VOICE
from processing.morphology import Paragraph


# ── Timing helpers ──────────────────────────────────────────────────────────

def _100ns_to_ms(value: int) -> float:
    return value / 10_000.0


def _align_timing(
    word_boundaries: list[dict],
    tokens: list[dict],
) -> list[dict]:
    """
    Match edge-tts WordBoundary events to spaCy token indices.

    edge-tts words are contiguous runs of non-space characters.
    We iterate both lists greedily, skipping punct/space tokens.
    """
    content_tokens = [
        (i, tok) for i, tok in enumerate(tokens)
        if not tok["is_punct"] and not tok["is_space"]
    ]

    aligned = []
    wb_idx = 0
    for tok_idx, tok in content_tokens:
        if wb_idx >= len(word_boundaries):
            break
        wb = word_boundaries[wb_idx]
        # Accept if the word boundary text matches (case-insensitive, strip punct)
        wb_text = wb["text"].strip(".,!?;:\"'()[]{}—–-")
        tok_surface = tok["surface"].strip(".,!?;:\"'()[]{}—–-")
        if wb_text.lower() == tok_surface.lower() or wb_text.lower() in tok_surface.lower():
            start_ms = _100ns_to_ms(wb["offset"])
            end_ms = start_ms + _100ns_to_ms(wb["duration"])
            aligned.append({"token_index": tok_idx, "start_ms": start_ms, "end_ms": end_ms})
            wb_idx += 1

    return aligned


# ── Audio generation ────────────────────────────────────────────────────────

async def _generate_sentence_audio(
    text: str,
    mp3_path: Path,
    timing_path: Path,
    voice: str = TTS_VOICE,
) -> list[dict]:
    """
    Generate MP3 + collect WordBoundary events for *text*.
    Writes MP3 to *mp3_path*; returns the raw word boundary list.
    """
    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    word_boundaries: list[dict] = []
    audio_chunks: list[bytes] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            word_boundaries.append({
                "text": chunk["text"],
                "offset": chunk["offset"],
                "duration": chunk["duration"],
            })

    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    mp3_path.write_bytes(b"".join(audio_chunks))
    return word_boundaries


def generate_sentence_tts(
    sent: dict,          # Sentence TypedDict
    para_idx: int,
    sent_idx: int,
    audio_dir: Path,
    voice: str = TTS_VOICE,
    skip: bool = False,
) -> bool:
    """
    Generate TTS for a single sentence and write files to *audio_dir*.

    Parameters
    ----------
    sent      : Sentence dict (with tokens list)
    para_idx  : paragraph index (for filename)
    sent_idx  : sentence index within paragraph (for filename)
    audio_dir : directory to write MP3 and timing JSON
    voice     : edge-tts voice name
    skip      : if True, skip audio generation entirely

    Returns True if audio was generated, False if skipped.
    """
    # Build sentence text with proper spacing.
    # Tokens have no explicit space tokens (spaCy whitespace is implicit),
    # so we insert spaces between content tokens unless the next token is
    # closing punctuation or the current token is opening punctuation.
    _CLOSING = set(",. !?:;)]}»…—")
    _OPENING = set("([{«")
    tokens_for_text = [t for t in sent["tokens"] if not t["is_space"]]
    parts: list[str] = []
    for i, tok in enumerate(tokens_for_text):
        parts.append(tok["surface"])
        nxt = tokens_for_text[i + 1] if i + 1 < len(tokens_for_text) else None
        if nxt and nxt["surface"][0] not in _CLOSING and tok["surface"][-1] not in _OPENING:
            parts.append(" ")
    text = "".join(parts).strip()
    if not text:
        return False

    stem = f"s-{para_idx}-{sent_idx}"
    mp3_path = audio_dir / f"{stem}.mp3"
    timing_path = audio_dir / f"{stem}.timing.json"

    if skip:
        return False

    # Skip if both files already exist (checkpointing)
    if mp3_path.exists() and timing_path.exists():
        return True

    word_boundaries = asyncio.run(
        _generate_sentence_audio(text, mp3_path, timing_path, voice)
    )

    aligned = _align_timing(word_boundaries, sent["tokens"])
    timing_path.write_text(
        json.dumps(aligned, ensure_ascii=False),
        encoding="utf-8",
    )
    return True


def generate_chapter_tts(
    paragraphs: list[Paragraph],
    chapter_audio_dir: Path,
    voice: str = TTS_VOICE,
    skip: bool = False,
) -> None:
    """
    Generate TTS for all sentences in a chapter.

    Parameters
    ----------
    paragraphs        : enriched paragraphs (from morphology pass)
    chapter_audio_dir : e.g. books/{book_id}/ch-1/audio/
    voice             : edge-tts voice
    skip              : if True, skip all generation (--no-tts flag)
    """
    total = sum(len(p["sentences"]) for p in paragraphs)
    done = 0

    for para in paragraphs:
        for sent in para["sentences"]:
            generated = generate_sentence_tts(
                sent=sent,
                para_idx=para["index"],
                sent_idx=sent["index"],
                audio_dir=chapter_audio_dir,
                voice=voice,
                skip=skip,
            )
            done += 1
            if not skip:
                status = "ok" if generated else "skipped"
                print(
                    f"\r[tts] {done}/{total} sentences  (p={para['index']} s={sent['index']}) [{status}]",
                    end="",
                    flush=True,
                )

    if not skip:
        print()  # newline after progress
