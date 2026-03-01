#!/usr/bin/env python3
"""
Czytelnik pipeline — main CLI entry point.

Usage examples:
  python pipeline.py --source wolnelektury --slug w-pustyni-i-w-puszczy --output ../frontend/public/books/
  python pipeline.py --source epub --file "../inbox/book.epub" --output ../frontend/public/books/
  python pipeline.py ... --no-tts
  python pipeline.py ... --chapters 1-3
  python pipeline.py ... --resume
"""
from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# Force UTF-8 output on Windows (avoids cp1251 encoding errors for Polish text)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path


# ── Add pipeline/ to sys.path so relative imports work ────────────────────
sys.path.insert(0, str(Path(__file__).parent))

import spacy

from config import CACHE_DIR, SPACY_MODEL, TTS_VOICE
from sources.wolne_lektury import load_book as wl_load_book
from sources.epub_parser import parse_epub
from processing.segmenter import segment_chapter
from processing.morphology import enrich_chapter
from processing.translator import translate_chapters
from processing.dictionary import update_dictionary
from processing.tts import generate_chapter_tts
from output.writer import write_book


# ── Chapter range parsing ───────────────────────────────────────────────────

def _parse_chapter_range(spec: str | None, total: int) -> list[int]:
    """Parse '1-3' or '2' into a list of 0-based indices."""
    if spec is None:
        return list(range(total))
    if "-" in spec:
        start, end = spec.split("-", 1)
        return list(range(int(start) - 1, int(end)))
    return [int(spec) - 1]


# ── Checkpoint helpers ──────────────────────────────────────────────────────

def _checkpoint_path(book_id: str, stage: str) -> Path:
    p = CACHE_DIR / book_id / f"checkpoint_{stage}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _checkpoint_exists(book_id: str, stage: str) -> bool:
    return _checkpoint_path(book_id, stage).exists()


def _save_checkpoint(book_id: str, stage: str, data: object) -> None:
    path = _checkpoint_path(book_id, stage)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _load_checkpoint(book_id: str, stage: str) -> object:
    return json.loads(_checkpoint_path(book_id, stage).read_text(encoding="utf-8"))


# ── Main pipeline logic ─────────────────────────────────────────────────────

def run(args: argparse.Namespace) -> None:
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Load book ────────────────────────────────────────────────────
    print("=" * 60)
    print("STEP 1: Loading book source")
    print("=" * 60)

    if args.source == "wolnelektury":
        if not args.slug:
            print("ERROR: --slug is required for --source wolnelektury", file=sys.stderr)
            sys.exit(1)
        book_raw = wl_load_book(args.slug)
        book_id = args.slug
    elif args.source == "epub":
        if not args.file:
            print("ERROR: --file is required for --source epub", file=sys.stderr)
            sys.exit(1)
        book_raw = parse_epub(args.file)
        book_id = book_raw["slug"]
    else:
        print(f"ERROR: Unknown source '{args.source}'", file=sys.stderr)
        sys.exit(1)

    all_chapters = book_raw["chapters"]
    chapter_indices = _parse_chapter_range(args.chapters, len(all_chapters))
    selected_chapters = [all_chapters[i] for i in chapter_indices]

    print(
        f"\nBook: {book_raw['title']} by {book_raw['author']}"
        f"\nTotal chapters: {len(all_chapters)}"
        f"\nProcessing: {[c['number'] for c in selected_chapters]}"
    )

    # ── Step 2: spaCy model ──────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 2: Loading spaCy model")
    print("=" * 60)
    print(f"Loading '{SPACY_MODEL}' …")
    nlp = spacy.load(SPACY_MODEL)

    # ── Step 3: Segment + Morphology per chapter ─────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 3: Segmentation & morphological analysis")
    print("=" * 60)

    stage_morph = "morphology"
    if args.resume and _checkpoint_exists(book_id, stage_morph):
        print("[pipeline] Resuming from morphology checkpoint …")
        chapters_paragraphs = _load_checkpoint(book_id, stage_morph)
    else:
        chapters_paragraphs = []
        for cm in selected_chapters:
            print(f"  Chapter {cm['number']}: {cm['title']}")
            raw_paras = segment_chapter(cm["text"], nlp)
            enriched = enrich_chapter(raw_paras, nlp)
            chapters_paragraphs.append(enriched)
        _save_checkpoint(book_id, stage_morph, chapters_paragraphs)

    # ── Steps 4 + 5: Translation & Dictionary (run concurrently) ─────────────
    print("\n" + "=" * 60)
    print("STEPS 4+5: Sentence translation + per-lemma dictionary (parallel)")
    print("=" * 60)

    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_translate = pool.submit(translate_chapters, chapters_paragraphs, book_id)
        fut_dict = pool.submit(update_dictionary, chapters_paragraphs)
        for fut in as_completed([fut_translate, fut_dict]):
            exc = fut.exception()
            if exc:
                raise exc

    # ── Step 6: TTS ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    if args.no_tts:
        print("STEP 6: TTS skipped (--no-tts)")
    else:
        print("STEP 6: TTS audio generation")
    print("=" * 60)

    for cm, paragraphs in zip(selected_chapters, chapters_paragraphs):
        n = cm["number"]
        audio_dir = output_dir / book_id / f"ch-{n}" / "audio"
        print(f"  Chapter {n}: {cm['title']}")
        generate_chapter_tts(
            paragraphs=paragraphs,
            chapter_audio_dir=audio_dir,
            voice=TTS_VOICE,
            skip=args.no_tts,
        )

    # ── Step 7: Write JSON output ─────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("STEP 7: Writing output JSON")
    print("=" * 60)
    write_book(
        book_id=book_id,
        title=book_raw["title"],
        author=book_raw["author"],
        chapter_metas=selected_chapters,
        chapters_paragraphs=chapters_paragraphs,
        output_dir=output_dir,
        no_tts=args.no_tts,
    )

    print("\n✓ Pipeline complete.")


# ── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Czytelnik pipeline — process Polish books into annotated JSON + TTS audio."
    )

    parser.add_argument(
        "--source",
        choices=["wolnelektury", "epub"],
        required=True,
        help="Book source: 'wolnelektury' (API) or 'epub' (local file).",
    )
    parser.add_argument(
        "--slug",
        default=None,
        help="Wolne Lektury book slug (e.g. w-pustyni-i-w-puszczy).",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="Path to EPUB file (for --source epub).",
    )
    parser.add_argument(
        "--output",
        default="../frontend/public/books/",
        help="Output directory (default: ../frontend/public/books/).",
    )
    parser.add_argument(
        "--no-tts",
        action="store_true",
        default=False,
        help="Skip TTS audio generation.",
    )
    parser.add_argument(
        "--chapters",
        default=None,
        help="Chapter range to process, e.g. '1-3' or '2' (default: all).",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        default=False,
        help="Resume from last checkpoint (skip already-done stages).",
    )

    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
