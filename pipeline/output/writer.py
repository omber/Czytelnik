"""
Assemble final JSON output files consumed by the React frontend.

Output structure per book (under {output_dir}/{book_id}/):
  meta.json          — title, author, chapterCount, wordCount
  chapters.json      — [{number, title}, …]
  ch-{n}.json        — full chapter data (paragraphs → sentences → tokens)
  ch-{n}/audio/      — TTS MP3 + timing JSON (written by tts.py)

Also writes/updates:
  {output_dir}/index.json — manifest of all processed book IDs
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from processing.morphology import Paragraph
from sources.wolne_lektury import ChapterRaw


# ── Helpers ─────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Convert arbitrary string to lowercase-hyphenated slug."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def _count_words(chapters_paragraphs: list[list[Paragraph]]) -> int:
    """Count non-punct, non-space tokens across all chapters."""
    total = 0
    for paragraphs in chapters_paragraphs:
        for para in paragraphs:
            for sent in para["sentences"]:
                total += sum(
                    1 for t in sent["tokens"]
                    if not t["is_punct"] and not t["is_space"]
                )
    return total


def _sentence_has_audio(audio_dir: Path, para_idx: int, sent_idx: int) -> bool:
    """Check if MP3 + timing files exist for this sentence."""
    stem = f"s-{para_idx}-{sent_idx}"
    return (audio_dir / f"{stem}.mp3").exists()


# ── JSON serialisation of a chapter ─────────────────────────────────────────

def _serialise_chapter(
    chapter_number: int,
    chapter_title: str,
    paragraphs: list[Paragraph],
    audio_dir: Path,
) -> dict:
    """Build the ch-{n}.json payload."""
    para_list = []
    for para in paragraphs:
        sent_list = []
        for sent in para["sentences"]:
            has_audio = _sentence_has_audio(audio_dir, para["index"], sent["index"])
            sent_list.append({
                "index": sent["index"],
                "translation": sent["translation"],
                "has_audio": has_audio,
                "tokens": sent["tokens"],  # already dicts: surface, lemma, pos, morph, is_punct, is_space
            })
        para_list.append({"index": para["index"], "sentences": sent_list})

    return {
        "number": chapter_number,
        "title": chapter_title,
        "paragraphs": para_list,
    }


# ── Public API ───────────────────────────────────────────────────────────────

def write_book(
    book_id: str,
    title: str,
    author: str,
    chapter_metas: list[ChapterRaw],
    chapters_paragraphs: list[list[Paragraph]],
    output_dir: Path,
    no_tts: bool = False,
    cover_image: bytes | None = None,
    cover_ext: str = "jpg",
) -> None:
    """
    Write all output JSON files for a book.

    Parameters
    ----------
    book_id              : URL-safe identifier (slug)
    title / author       : book metadata strings
    chapter_metas        : raw chapter dicts (number, title, text)
    chapters_paragraphs  : enriched paragraph data per chapter
    output_dir           : root output directory (frontend/public/books/)
    no_tts               : if True, audio files won't exist — has_audio always False
    cover_image          : raw image bytes for the book cover (optional)
    cover_ext            : file extension for the cover image (default: "jpg")
    """
    book_dir = output_dir / book_id
    book_dir.mkdir(parents=True, exist_ok=True)

    word_count = _count_words(chapters_paragraphs)

    # ── Cover image ───────────────────────────────────────────────────────────
    cover_filename: str | None = None
    if cover_image:
        cover_filename = f"cover.{cover_ext}"
        (book_dir / cover_filename).write_bytes(cover_image)
        print(f"[writer] Cover saved → {cover_filename}")

    # ── meta.json ────────────────────────────────────────────────────────────
    meta: dict = {
        "id": book_id,
        "title": title,
        "author": author,
        "chapterCount": len(chapter_metas),
        "wordCount": word_count,
    }
    if cover_filename:
        meta["cover"] = cover_filename
    (book_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── chapters.json ─────────────────────────────────────────────────────────
    chapters_index = [
        {"number": cm["number"], "title": cm["title"]}
        for cm in chapter_metas
    ]
    (book_dir / "chapters.json").write_text(
        json.dumps(chapters_index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── ch-{n}.json per chapter ───────────────────────────────────────────────
    for cm, paragraphs in zip(chapter_metas, chapters_paragraphs):
        n = cm["number"]
        audio_dir = book_dir / f"ch-{n}" / "audio"
        chapter_data = _serialise_chapter(n, cm["title"], paragraphs, audio_dir)
        chapter_path = book_dir / f"ch-{n}.json"
        chapter_path.write_text(
            json.dumps(chapter_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"[writer] Book '{title}' written to {book_dir}")
    print(f"[writer]   {len(chapter_metas)} chapter(s), {word_count:,} words")

    # ── Update index.json ─────────────────────────────────────────────────────
    _update_index(book_id, output_dir)


def _update_index(book_id: str, output_dir: Path) -> None:
    """Add *book_id* to the books/index.json manifest if not already present."""
    index_path = output_dir / "index.json"
    if index_path.exists():
        index: list[str] = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = []

    if book_id not in index:
        index.append(book_id)
        index_path.write_text(
            json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[writer] Updated index.json → {index}")
