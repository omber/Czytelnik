#!/usr/bin/env python3
"""
Standalone TTS runner — generates audio for an already-processed book
without needing the original EPUB/source file.

Reads:
  cache/{book_id}/checkpoint_morphology.json  — tokenised paragraphs
  cache/{book_id}/translations.json           — sentence translations

Writes:
  frontend/public/books/{book_id}/ch-{n}/audio/  — MP3 + timing JSON
  frontend/public/books/{book_id}/ch-{n}.json    — updated with has_audio=True

Usage:
  python run_tts.py --book joanna-chmielewska---wszyscy-jestesmy-podejrzani
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))

from config import CACHE_DIR, TTS_VOICE
from processing.tts import generate_chapter_tts
from output.writer import write_book


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TTS audio from cached pipeline data.")
    parser.add_argument("--book", required=True, help="Book ID (slug), e.g. joanna-chmielewska---wszyscy-jestesmy-podejrzani")
    parser.add_argument("--output", default="../frontend/public/books/", help="Output directory")
    args = parser.parse_args()

    book_id = args.book
    output_dir = Path(args.output).resolve()
    cache_dir = CACHE_DIR / book_id

    # ── Load checkpoint ───────────────────────────────────────────────────────
    morph_path = cache_dir / "checkpoint_morphology.json"
    if not morph_path.exists():
        print(f"ERROR: no morphology checkpoint at {morph_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading morphology checkpoint for '{book_id}' …")
    chapters_paragraphs: list[list[dict]] = json.loads(morph_path.read_text(encoding="utf-8"))
    print(f"  {len(chapters_paragraphs)} chapter(s)")

    # ── Apply translations ────────────────────────────────────────────────────
    trans_path = cache_dir / "translations.json"
    translations: dict[str, str] = {}
    if trans_path.exists():
        translations = json.loads(trans_path.read_text(encoding="utf-8"))
        print(f"  Loaded {len(translations)} cached translations")

    for paragraphs in chapters_paragraphs:
        for para in paragraphs:
            for sent in para["sentences"]:
                key = "".join(t["surface"] for t in sent["tokens"])
                sent["translation"] = translations.get(key, "")

    # ── Load book metadata from existing meta.json ────────────────────────────
    meta_path = output_dir / book_id / "meta.json"
    if not meta_path.exists():
        print(f"ERROR: no meta.json at {meta_path}", file=sys.stderr)
        sys.exit(1)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    chapters_json_path = output_dir / book_id / "chapters.json"
    chapters_index = json.loads(chapters_json_path.read_text(encoding="utf-8"))
    # Build chapter_metas list (text field not needed for TTS/write)
    chapter_metas = [{"number": c["number"], "title": c["title"], "text": ""} for c in chapters_index]

    # ── Generate TTS ──────────────────────────────────────────────────────────
    print("\nGenerating TTS audio …")
    for cm, paragraphs in zip(chapter_metas, chapters_paragraphs):
        n = cm["number"]
        audio_dir = output_dir / book_id / f"ch-{n}" / "audio"
        total_sents = sum(len(p["sentences"]) for p in paragraphs)
        print(f"\nChapter {n}: '{cm['title']}' — {total_sents} sentences")
        generate_chapter_tts(
            paragraphs=paragraphs,
            chapter_audio_dir=audio_dir,
            voice=TTS_VOICE,
            skip=False,
        )

    # ── Rewrite ch-{n}.json with has_audio=True ───────────────────────────────
    print("\nRewriting chapter JSON with has_audio …")
    write_book(
        book_id=book_id,
        title=meta["title"],
        author=meta["author"],
        chapter_metas=chapter_metas,
        chapters_paragraphs=chapters_paragraphs,
        output_dir=output_dir,
        no_tts=False,
    )

    print("\n✓ TTS generation complete.")


if __name__ == "__main__":
    main()
