# Czytelnik

A mobile-first PWA for Russian speakers learning Polish through reading. Presents Polish literature with per-word morphological annotations, hidden Russian translations (tap to reveal), TTS audio with word-level highlighting, and a Leitner spaced-repetition vocabulary trainer.

## Features

- **Annotated reader** — tap any word to see its lemma, POS, grammatical tags, and Russian translation
- **Sentence translation** — tap a sentence to toggle its Russian translation
- **TTS playback** — sentence-by-sentence audio with synchronized word highlighting; falls back to Web Speech API when MP3s are unavailable
- **Vocabulary trainer** — add words from the reader; review with Leitner 3-box flashcards
- **Reading stats** — unique words encountered, reading time, 7-day streaks, vocab breakdown
- **Multiple profiles** — separate progress, vocab, and stats per user
- **PWA** — installable, works offline after first load

## Architecture

```
Polish book (EPUB or Wolne Lektury API)
  → Python pipeline (spaCy + Claude API + edge-tts)
  → Annotated JSON + MP3 audio per chapter
  → React PWA reads JSON, all user data in localStorage
```

No backend. Static site deployed on GitHub Pages.

## Tech Stack

| Layer | Stack |
|---|---|
| Pipeline | Python, spaCy (`pl_core_news_lg`), Claude Haiku (Batch API), edge-tts |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, react-router-dom |
| Storage | localStorage (namespaced per user) |
| Hosting | GitHub Pages (HashRouter) |

## Setup

### Pipeline

```bash
cd pipeline
python -m venv .venv
.venv/Scripts/activate        # Windows
source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python -m spacy download pl_core_news_lg

cp .env.example .env          # then set ANTHROPIC_API_KEY
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173/Czytelnik/
npm run build    # output → dist/
```

## Processing a Book

```bash
cd pipeline

# From Wolne Lektury (public domain Polish library)
python pipeline.py --source wolnelektury --slug w-pustyni-i-w-puszczy --output ../frontend/public/books/

# From a local EPUB
python pipeline.py --source epub --file "../inbox/book.epub" --output ../frontend/public/books/

# Useful flags
python pipeline.py ... --no-tts        # skip TTS (faster, no audio)
python pipeline.py ... --chapters 1-3  # process only chapters 1–3
python pipeline.py ... --resume        # resume from last checkpoint
```

## Content Sources

- **[Wolne Lektury](https://wolnelektury.pl)** — public domain Polish digital library with API
- **User EPUBs** — place DRM-free files in `inbox/`

## Data Format

Pipeline outputs per book into `frontend/public/books/{book-id}/`:

| File | Contents |
|---|---|
| `meta.json` | title, author, chapter count, word count |
| `chapters.json` | chapter list with titles |
| `ch-{n}.json` | paragraphs → sentences → tokens (surface, lemma, POS, morph, translation) |
| `ch-{n}/audio/s-{p}-{s}.mp3` | TTS audio per sentence |
| `ch-{n}/audio/s-{p}-{s}.timing.json` | word-boundary timestamps for highlight sync |
