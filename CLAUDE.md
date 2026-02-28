# Czytelnik — Claude Code Project Guide

## Project Overview

Czytelnik ("Reader" in Polish) is a mobile-first PWA for Russian speakers learning Polish through reading. It has two independent parts:

1. **Python pipeline** (`pipeline/`) — offline, build-time processing of Polish books into annotated JSON + TTS audio
2. **React frontend** (`frontend/`) — static web app that reads pre-processed JSON, all user data in localStorage

No backend. Deployed as a static site on GitHub Pages.

## Architecture

```
Polish book (EPUB or Wolne Lektury API)
  → Python pipeline (spaCy + Claude API + edge-tts)
  → Annotated JSON + MP3 audio per chapter
  → React PWA reads JSON, user data in localStorage
```

## Tech Stack

### Pipeline (Python)
- **spaCy** (`pl_core_news_lg`) — tokenization, sentence segmentation, morphological analysis
- **anthropic** (Claude Haiku Batch API) — Polish → Russian sentence translation
- **edge-tts** — TTS audio generation with word-level timing (`pl-PL-ZofiaNeural`)
- **ebooklib** + **BeautifulSoup4** — EPUB parsing
- **requests** — Wolne Lektury API

### Frontend (TypeScript/React)
- **React 18+** with **Vite**
- **Tailwind CSS** — mobile-first utility classes
- **react-router-dom** with `HashRouter` (GitHub Pages compatible)
- **PWA** — manifest + service worker via `vite-plugin-pwa`
- **localStorage** — all user data (profiles, progress, vocab, stats, settings)

## Key Data Formats

### Pipeline output per book (`frontend/public/books/{book-id}/`)
- `meta.json` — title, author, chapter count, word count
- `chapters.json` — list of chapter numbers and titles
- `ch-{n}.json` — full chapter with paragraphs → sentences → tokens (surface, lemma, POS, morph, translations)
- `ch-{n}/audio/s-{p}-{s}.mp3` + `s-{p}-{s}.timing.json` — TTS audio + word-level timing

### localStorage keys (namespaced by username)
- `polish-reader:{username}:progress` — current book, chapter, page per book
- `polish-reader:{username}:vocab` — vocabulary entries with Leitner box state
- `polish-reader:{username}:stats` — reading time, words encountered, session log
- `polish-reader:{username}:settings` — TTS speed, font size

## Pipeline CLI Usage

```bash
cd pipeline
python pipeline.py --source wolnelektury --slug w-pustyni-i-w-puszczy --output ../frontend/public/books/
python pipeline.py --source epub --file "../inbox/book.epub" --output ../frontend/public/books/
python pipeline.py ... --no-tts        # Skip TTS generation
python pipeline.py ... --chapters 1-3  # Process only chapters 1-3
python pipeline.py ... --resume        # Resume from last checkpoint
```

## Environment Setup

### Pipeline
```bash
cd pipeline
python -m venv .venv
.venv/Scripts/activate       # Windows
pip install -r requirements.txt
python -m spacy download pl_core_news_lg
```

API key: copy `pipeline/.env.example` to `pipeline/.env` and set `ANTHROPIC_API_KEY`.

### Frontend
```bash
cd frontend
npm install
npm run dev      # Dev server
npm run build    # Production build
```

## Implementation Phases

1. **Phase 1: Content pipeline** — fetch/parse books, segment, morphology, translate, TTS, output JSON
2. **Phase 2: Reader core** — profiles, library, reader with word/sentence interactions
3. **Phase 3: TTS + highlighting** — audio playback with word-level highlight sync
4. **Phase 4: Vocabulary system** — add words, Leitner spaced repetition, flashcard review
5. **Phase 5: Stats + PWA** — reading stats, settings, offline support, GitHub Pages deploy

Start with Phase 1 (pipeline), then frontend phases sequentially.

## Key Design Decisions

- **HashRouter** for GitHub Pages (no server-side routing)
- **Leitner 3-box system** for spaced repetition (Box 1: every session, Box 2: every 3 days, Box 3: every 7 days)
- **Word tap vs sentence tap**: Word `onClick` calls `e.stopPropagation()`; sentence `onClick` toggles translation
- **TTS alignment**: edge-tts WordBoundary events aligned with spaCy token indices (excluding punctuation)
- **Checkpointing**: pipeline caches intermediate results in `pipeline/cache/` so re-runs skip completed steps
- **Translation caching**: sentence translations cached to avoid re-spending API credits

## Content Sources

1. **Wolne Lektury** (`wolnelektury.pl`) — public domain Polish digital library with API
2. **User EPUBs** — placed in `inbox/` folder, must be DRM-free

## Test Corpus

First 3 chapters of *W pustyni i w puszczy* by Henryk Sienkiewicz (from Wolne Lektury).

## Files to Never Commit

- `pipeline/.env` (contains API key)
- `pipeline/cache/` (intermediate pipeline data)
- `pipeline/.venv/` (Python virtual environment)
- `frontend/node_modules/`
- `frontend/dist/` (build output)
