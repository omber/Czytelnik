# Czytelnik Implementation Plan

## Context

Czytelnik is a mobile-first PWA for Russian speakers learning Polish through reading. It displays Polish literature with per-word morphological annotations, hidden Russian translations (revealable per-sentence/word), TTS with word-level highlighting, and a Leitner-box vocabulary trainer. The repo currently contains only `README.md`, `Specification.md`, and a test EPUB in `inbox/`. All code needs to be built from scratch.

The architecture is split into two independent parts:
1. **Python pipeline** (offline, build-time) — processes books into annotated JSON + TTS audio
2. **React frontend** (runtime) — reads pre-processed JSON, all user data in localStorage

---

## Directory Structure

```
C:\py\Czytelnik\
├── README.md
├── Specification.md
├── inbox/                              # User-provided EPUBs
│
├── pipeline/                           # Python build-time pipeline
│   ├── requirements.txt
│   ├── pipeline.py                     # Main CLI entry point (argparse)
│   ├── config.py                       # Constants (API URLs, model names, voices)
│   ├── sources/
│   │   ├── __init__.py
│   │   ├── wolne_lektury.py            # Fetch from wolnelektury.pl API
│   │   └── epub_parser.py             # Parse user EPUBs (ebooklib + BS4)
│   ├── processing/
│   │   ├── __init__.py
│   │   ├── segmenter.py               # Chapter → paragraphs → sentences → tokens
│   │   ├── morphology.py              # spaCy morphological analysis
│   │   ├── translator.py             # Claude Haiku batch translation (sentences)
│   │   ├── dictionary.py             # Per-lemma dictionary (LLM)
│   │   └── tts.py                     # edge-tts audio + word-level timing
│   ├── output/
│   │   ├── __init__.py
│   │   └── writer.py                  # Assemble final JSON + audio files
│   ├── cache/                          # Intermediate results (checkpointing)
│   └── tests/
│       ├── test_segmenter.py
│       ├── test_morphology.py
│       ├── test_epub_parser.py
│       └── fixtures/
│
├── frontend/                           # React + Vite + Tailwind app
│   ├── package.json
│   ├── vite.config.ts                  # base: '/Czytelnik/' for GitHub Pages
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json              # PWA manifest
│   │   ├── icons/
│   │   └── books/                     # Pipeline output lands here
│   │       └── {book-id}/
│   │           ├── meta.json
│   │           ├── chapters.json
│   │           ├── ch-{n}.json
│   │           └── ch-{n}/audio/      # TTS MP3 + timing JSON
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                     # HashRouter setup
│       ├── index.css                   # Tailwind directives
│       ├── types/
│       │   ├── book.ts                # BookMeta, ChapterData, Token, Sentence, etc.
│       │   └── user.ts               # UserProgress, VocabEntry, UserStats, UserSettings
│       ├── hooks/
│       │   ├── useLocalStorage.ts     # Generic typed localStorage hook
│       │   ├── useUser.ts
│       │   ├── useProgress.ts
│       │   ├── useVocab.ts            # Vocab CRUD + Leitner logic
│       │   ├── useStats.ts
│       │   ├── useSettings.ts
│       │   ├── useTTS.ts              # Audio playback + word highlight sync
│       │   └── useBooks.ts            # Load book list & chapter data
│       ├── lib/
│       │   ├── storage.ts             # localStorage wrapper with namespacing
│       │   ├── leitner.ts             # Leitner box promotion/demotion logic
│       │   ├── pagination.ts
│       │   ├── csv-export.ts
│       │   └── reading-timer.ts
│       ├── context/
│       │   └── UserContext.tsx
│       ├── components/
│       │   ├── ui/                    # BottomSheet, Toast, Badge, ProgressBar
│       │   ├── reader/                # ReaderPage, Paragraph, Sentence, Word, WordBottomSheet, TTSControls
│       │   ├── vocab/                 # VocabList, ReviewSession, WordDetail
│       │   ├── library/               # LibraryGrid, BookCard
│       │   ├── profile/               # ProfileSelector
│       │   ├── stats/                 # StatsPage
│       │   └── settings/              # SettingsPage
│       └── pages/
│           ├── ProfilePage.tsx        # Route: /
│           ├── LibraryPage.tsx        # Route: /library
│           ├── ReaderPageRoute.tsx    # Route: /read/:bookId/:chapter
│           ├── VocabPage.tsx          # Route: /vocab
│           ├── ReviewPage.tsx         # Route: /review
│           ├── StatsPage.tsx          # Route: /stats
│           └── SettingsPage.tsx       # Route: /settings
```

---

## Phase 1: Python Content Pipeline ✅ COMPLETE

**Goal:** Process a Polish book into annotated JSON + TTS audio that the frontend can consume.

**Status:** All steps implemented, tested, and committed (commit f417987).
Verified end-to-end on Chmielewska EPUB ch.1 — 1,881 words, 141 sentences translated, 867 lemmas in dictionary.

**Bugs fixed during implementation:**
- Windows cp1251 console encoding → `sys.stdout.reconfigure(encoding="utf-8")`
- `load_dotenv` not overriding empty shell env var → `override=True`
- Token concatenation in morphology re-parse → store `text_with_ws` in segmenter's `RawSentence.text`
- BS4 `XMLParsedAsHTMLWarning` suppressed in epub_parser

### Step 1.1 — Scaffolding & Dependencies ✅
- Create `pipeline/requirements.txt`: spacy, requests, anthropic, edge-tts, ebooklib, beautifulsoup4, lxml, python-dotenv
- Create `pipeline/config.py` with constants (API URLs, spaCy model name, TTS voice, output dir)
- Create `pipeline/.env.example` with `ANTHROPIC_API_KEY=your-key-here` as a template
- Create `pipeline/.env` (gitignored) — user places their actual API key here
- Add `.env` to `.gitignore`
- Config loads API key via `python-dotenv` from `.env` file with `override=True`
- Set up venv, install deps, download `pl_core_news_lg` model

### Step 1.2 — Wolne Lektury Source ✅
- `pipeline/sources/wolne_lektury.py`
- `fetch_book_metadata(slug)` → calls `wolnelektury.pl/api/books/{slug}/`
- `fetch_book_text(slug)` → downloads `.txt` URL from metadata
- `split_into_chapters(raw_text)` → splits on `ROZDZIAŁ` headings (Roman numerals), strips metadata header

### Step 1.3 — EPUB Parser ✅
- `pipeline/sources/epub_parser.py`
- `parse_epub(filepath)` → returns `{title, author, chapters: [{number, title, text}]}`
- Uses ebooklib to read spine, BS4 to clean HTML (strip images, soft hyphens, normalize NFC encoding)
- Chapter detection: prefer TOC, fall back to XHTML file boundaries, last resort: regex on `ROZDZIAŁ`
- Tested with `inbox/Joanna Chmielewska - Wszyscy jestesmy podejrzani.epub` → 6 chapters

### Step 1.4 — Text Segmentation ✅
- `pipeline/processing/segmenter.py`
- `segment_chapter(text, nlp)` → paragraphs (split `\n\n`) → sentences (spaCy `doc.sents`) → tokens
- Post-process: merge suspiciously short sentences (<3 tokens) with preceding sentence
- `RawSentence` stores `text` field (joined with `text_with_ws`) for lossless re-parsing

### Step 1.5 — Morphological Analysis ✅
- `pipeline/processing/morphology.py`
- For each token: extract `surface`, `lemma`, `pos`, `morph`, `is_punct`, `is_space` from spaCy
- Uses `pl_core_news_lg` model; re-parses using `sent["text"]` (preserves spaces)

### Step 1.6 — Sentence Translation (Claude Haiku Batch API) ✅
- `pipeline/processing/translator.py`
- Uses Anthropic Batch API to translate all sentences Polish → Russian
- Prompt: literary translator, natural fluent Russian, output only translation
- Cache translations to `cache/{book_id}/translations.json` so re-runs skip done sentences

### Step 1.7 — Per-Lemma Dictionary ✅
- `pipeline/processing/dictionary.py`
- Shared `pipeline/dictionary.json` that grows across books (867 entries after ch.1)
- Collect unique lemmas → look up existing dict → batch-translate missing via Claude Haiku
- Dictionary entry: `{"ru": "translation", "pos": "NOUN"}`

### Step 1.8 — TTS Audio Generation ✅
- `pipeline/processing/tts.py`
- Uses `edge-tts` with `pl-PL-ZofiaNeural` voice
- Per sentence: generate MP3 + timing JSON from WordBoundary events
- Align edge-tts word boundaries with spaCy token indices (exclude punctuation/whitespace)
- Output: `ch-{n}/audio/s-{p}-{s}.mp3` + `s-{p}-{s}.timing.json`
- Skippable with `--no-tts` flag

### Step 1.9 — Output Assembly ✅
- `pipeline/output/writer.py`
- Write `meta.json`, `chapters.json`, `ch-{n}.json` per spec format
- Write `books/index.json` manifest listing all processed book IDs

### Step 1.10 — Main CLI ✅
- `pipeline/pipeline.py` with argparse
- `--source wolnelektury|epub`, `--slug`, `--file`, `--output`, `--no-tts`, `--chapters 1-3`, `--resume`
- Orchestrates all steps in order with checkpointing after each major step

---

## Phase 2: Frontend Reader Core

**Goal:** Working reading experience — select user, browse library, read with word/sentence interactions.

### Step 2.1 — Vite + React + Tailwind scaffold
- `npm create vite@latest frontend -- --template react-ts`
- Install tailwindcss, react-router-dom
- Configure `vite.config.ts` with `base: '/Czytelnik/'` for GitHub Pages
- Use `HashRouter` (GitHub Pages has no server-side routing)

### Step 2.2 — Type definitions
- `src/types/book.ts`: BookMeta, ChapterData, Paragraph, Sentence, Token
- `src/types/user.ts`: UserProgress, VocabEntry, UserStats, UserSettings

### Step 2.3 — localStorage abstraction
- `src/lib/storage.ts`: namespaced read/write (`polish-reader:{username}:key`)
- `src/hooks/useLocalStorage.ts`: generic React hook wrapping storage with debounced writes

### Step 2.4 — User profiles
- `src/context/UserContext.tsx`: React context for current username
- `src/components/profile/ProfileSelector.tsx`: list users, create new (no passwords)
- `src/pages/ProfilePage.tsx`: landing page

### Step 2.5 — Library page
- `src/hooks/useBooks.ts`: fetch `books/index.json` then each `meta.json`
- `src/components/library/LibraryGrid.tsx` + `BookCard.tsx`: grid of books with progress bars
- `src/pages/LibraryPage.tsx`

### Step 2.6 — Reader page (core — most complex component)
- `src/components/reader/ReaderPage.tsx`: pagination (3-5 paragraphs/page), swipe navigation
- `src/components/reader/Paragraph.tsx`, `Sentence.tsx`, `Word.tsx`
- **Key UX:** Word tap → `e.stopPropagation()` + open bottom sheet; Sentence tap → toggle translation
- `src/components/reader/WordBottomSheet.tsx`: lemma, POS, morph, Russian translation, "Add to vocab" button
- `src/components/ui/BottomSheet.tsx`: slide-up panel with backdrop
- `src/components/reader/ReaderHeader.tsx` + `ReaderToolbar.tsx`: minimal header, bottom bar with nav
- `src/hooks/useProgress.ts`: save chapter/page position to localStorage
- `src/lib/pagination.ts`: split paragraphs into pages

---

## Phase 3: TTS + Word Highlighting

**Goal:** Play pre-generated audio with synchronized word highlighting.

### Step 3.1 — TTS hook
- `src/hooks/useTTS.ts`
- Fetch `s-{p}-{s}.mp3` + `s-{p}-{s}.timing.json` on play
- Use `HTMLAudioElement` for playback, `requestAnimationFrame` loop to check `currentTime` against timing data
- Expose: `play()`, `pause()`, `currentWordIndex`, `isPlaying`
- Support `playbackRate` for speed control (0.75×, 1×, 1.25×)

### Step 3.2 — Auto-advance
- After sentence finishes, short pause (500ms), then auto-play next sentence in paragraph
- After paragraph finishes, stop (user advances to next paragraph manually or continues)

### Step 3.3 — TTSControls component
- `src/components/reader/TTSControls.tsx`: play/pause button, speed selector
- Word highlighting: pass `currentWordIndex` down to `Word` component, apply CSS highlight class

### Step 3.4 — Fallback
- If no audio files exist for a sentence (`has_audio: false`), fall back to Web Speech API with `pl-PL` voice
- Show note that quality may vary

---

## Phase 4: Vocabulary System

**Goal:** Add words from reader, review with Leitner spaced repetition, manage vocab list.

### Step 4.1 — Vocab hook & Leitner logic
- `src/hooks/useVocab.ts`: addWord, removeWord, getWordsByBox, getDueWords, reviewWord(correct/incorrect)
- `src/lib/leitner.ts`: promotion/demotion logic
  - Box 1 → correct → Box 2 (next review: now)
  - Box 2 → correct → Box 3 (next review: +3 days) / wrong → Box 1
  - Box 3 → correct → stay Box 3 (next review: +7 days) / wrong → Box 1

### Step 4.2 — "Add to vocab" flow
- In `WordBottomSheet`: if word not in vocab → show "Добавить в словарь" button
- On add: create VocabEntry with current sentence as first context, Box 1

### Step 4.3 — "Не помню" (downgrade) flow
- In `WordBottomSheet`: if word already in vocab → show "Не помню" button + current Leitner box
- On tap: demote one box, add current sentence as new context, show toast confirmation

### Step 4.4 — Vocab list page
- `src/components/vocab/VocabList.tsx`: grouped by Leitner box (tabs or sections)
- `src/components/vocab/VocabCard.tsx`: lemma, translation, box indicator, tap → WordDetail

### Step 4.5 — Review session
- `src/components/vocab/ReviewSession.tsx`: flashcard UI
- Front: Polish word highlighted in a random context sentence
- Back: lemma, Russian translation, grammar note
- Buttons: "Знаю" / "Не знаю"
- Show count of due words on Library page as badge

### Step 4.6 — Word detail page
- `src/components/vocab/WordDetail.tsx`: all contexts where word was encountered, inflected forms, book/chapter refs

---

## Phase 5: Stats, Settings & PWA

**Goal:** Reading stats, user settings, offline support, CSV export.

### Step 5.1 — Reading time tracking
- `src/lib/reading-timer.ts`: track time-on-reader-screen (start/stop on page visibility)
- `src/hooks/useStats.ts`: aggregate sessions, count unique words encountered

### Step 5.2 — Stats page
- `src/components/stats/StatsPage.tsx`: unique words, vocab breakdown by box, reading time, books/chapters completed, streak

### Step 5.3 — Settings page
- `src/components/settings/SettingsPage.tsx`: switch user, TTS speed, font size, light/dark theme toggle, export CSV, reset progress
- Theme stored in `UserSettings.theme: 'dark' | 'light'`; apply via `class="dark"` on `<html>` + Tailwind `darkMode: 'class'`; toggle button in reader header and library header

### Step 5.4 — CSV export
- `src/lib/csv-export.ts`: export vocab as CSV (lemma, surface, POS, translation, box, dates)

### Step 5.5 — PWA
- `public/manifest.json`: name, icons, start_url, display: standalone
- Service worker via `vite-plugin-pwa`: cache all book JSONs + audio after first load
- Lazy-load audio per chapter (download on first play, cache via SW)

### Step 5.6 — GitHub Pages deployment
- GitHub Actions workflow to build and deploy `frontend/dist/` to `gh-pages` branch

---

## Verification Plan

### Phase 1 verification ✅ DONE
- Processed ch.1 of Chmielewska EPUB end-to-end (1,881 words, 141 sentences, 867 lemmas)
- JSON output structure validated — tokens properly split, lemmas/POS/morph correct
- Sentence translations spot-checked — fluent literary Russian quality confirmed
- TTS not yet tested (run with --no-tts during verification)
- Tests: 10/10 passing (`python -m pytest pipeline/tests/`)

### Phase 2 verification
- Full reading flow: select user → library → open book → read → paginate → tap words → toggle translations
- Test on mobile viewport (Chrome DevTools mobile emulation)
- Verify localStorage persistence across page reloads

### Phase 3 verification
- Play button triggers audio, words highlight in sync
- Speed control works (0.75×, 1×, 1.25×)
- Auto-advance between sentences within a paragraph

### Phase 4 verification
- Add word from reader → appears in vocab list in Box 1
- "Не помню" tap → word demotes, toast shown, context added
- Review session: correct → promotes, incorrect → demotes to Box 1
- Due-word badge shows on library screen

### Phase 5 verification
- Reading time accumulates correctly
- Stats page shows accurate data
- CSV export downloads valid file
- PWA: install on mobile, works offline after initial load
- Deploy to GitHub Pages, verify all routes work with HashRouter
