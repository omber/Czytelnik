# Czytelnik — Polish Reading Companion

## Overview

A mobile-first web app for learning Polish through reading. Displays Polish literature with per-word morphological annotations, hidden Russian translations (revealable per-sentence), TTS with word-level highlighting, and a simple vocabulary trainer with spaced repetition.

Target user: Russian speaker with technical background, plus family members. No backend — fully static site with localStorage for per-user progress.

---

## Core Principles (from SLA research)

1. **Maximize decoding time** — the UI should keep the user *reading Polish*, not navigating menus
2. **Comprehensible input** — translations are support scaffolding, not the default view
3. **Ownership** — the vocab list + review system gives conscious ownership of unconsciously acquired words
4. **Contact hours** — track and display reading stats to reinforce the habit

---

## Architecture

```
┌──────────────────────────────────────────────┐
│        Static Web App (React + Vite)         │
│        Deployed as PWA on GitHub Pages       │
├──────────────────────────────────────────────┤
│  /public/books/{book-id}/                    │
│    ├── meta.json        (title, author, etc) │
│    ├── chapters.json    (list of chapters)   │
│    └── ch-{n}.json      (pre-processed text) │
├──────────────────────────────────────────────┤
│  localStorage                                │
│    polish-reader:{username}:progress         │
│    polish-reader:{username}:vocab            │
│    polish-reader:{username}:stats            │
│    polish-reader:{username}:settings         │
└──────────────────────────────────────────────┘
```

### No backend required

All linguistic processing (morphology, translation, sentence alignment) happens **offline at build time** via Python scripts. The web app is purely a reader of pre-processed JSON.

### Multi-user

On first launch → prompt for username (or pick from existing profiles stored in localStorage). All data namespaced under that username. A "switch user" option in settings.

---

## Content Pipeline (Python, offline)

### Step 1: Source texts

Fetch from **Wolne Lektury** (wolnelektury.pl) — a free Polish digital library with a public API.

**Suggested starter corpus (adolescent-to-adult level):**
- Henryk Sienkiewicz — *W pustyni i w puszczy* (adventure novel)
- Bolesław Prus — selected short stories (*Kamizelka*, *Katarynka*)
- Adam Mickiewicz — *Pan Tadeusz* (verse epic, harder but culturally central)
- Stefan Żeromski — *Syzyfowe prace* (coming-of-age novel)
- Maria Konopnicka — short stories
- Polish fairy tales / legends (Legendy polskie) — a step up from "Курочка Ряба"

API: `https://wolnelektury.pl/api/` — returns text in various formats including plain text.

**Source B: User-provided EPUB files**

For books you own (e.g., Chmielewska, contemporary Polish fiction):

1. Parse EPUB using `ebooklib` → extract XHTML content per chapter
2. Strip HTML tags and formatting via `BeautifulSoup` (preserve paragraph breaks)
3. Sanitize: remove soft hyphens (`\u00AD`), normalize whitespace, fix encoding oddities
4. Auto-detect chapter boundaries from EPUB spine/TOC structure; fall back to XHTML file boundaries
5. Extract metadata (title, author) from EPUB OPF

```bash
# Usage
python pipeline.py --source epub --file "path/to/book.epub" --output public/books/

# Optional overrides for messy EPUBs
python pipeline.py --source epub --file "book.epub" --title "Wszyscy jesteśmy podejrzani" --author "Joanna Chmielewska"
```

Dependencies: `ebooklib`, `beautifulsoup4`, `lxml`

**EPUB edge cases to handle:**
- Some EPUBs embed images or footnotes inline — strip images, preserve footnote text
- Chapter detection heuristic: if TOC exists, use it; otherwise treat each XHTML file in the spine as a chapter
- Encoding: force UTF-8 normalization (NFC) to handle Polish diacritics consistently
- DRM: the pipeline cannot process DRM-locked EPUBs (user must strip DRM separately, e.g., via Calibre + DeDRM — their own legal responsibility)

After extraction and sanitization, the text enters the same processing pipeline as Wolne Lektury content (segmentation → morphology → translation → JSON output). The output format is identical regardless of source.

### Step 2: Text segmentation

Split each text into:
- **Chapters** (from source structure or by ~2000-word chunks)
- **Paragraphs** (natural paragraph breaks)
- **Sentences** (use spaCy `pl_core_news_sm` or a regex-based splitter)
- **Tokens/words** (spaCy tokenizer)

### Step 3: Morphological analysis

For each token, extract:
- `surface`: the word as it appears in text (e.g., "domowi")
- `lemma`: dictionary form (e.g., "dom")
- `pos`: part of speech (noun, verb, adj, etc.)
- `morph`: grammatical features (case=Dat, number=Sing, gender=Masc, etc.)

**Tool: spaCy** with `pl_core_news_lg` model (good enough accuracy, easy to integrate).

Alternative: **Morfeusz²** (more accurate for Polish morphology, free for non-commercial use, Python bindings via `morfeusz2` package). Can be used as a fallback or cross-check.

### Step 4: Translation

Two levels:
1. **Per-sentence Russian translation** — batch-generate using Claude API (Haiku for cost efficiency). Prompt: "Translate the following Polish sentence to Russian. Keep it natural, not word-for-word literal. Sentence: {sentence}"
2. **Per-lemma Russian translation** — use a Polish-Russian dictionary dataset (e.g., from Wiktionary dumps), supplemented by LLM for missing entries. Store as a shared `dictionary.json`.

### Step 5: TTS audio generation

For each sentence, generate:
- MP3 audio file via `edge-tts` with `pl-PL-ZofiaNeural` voice
- Word-level timing data (extracted from SSML boundary events returned by `edge-tts`)

Output per chapter:
```
ch-{n}/
  audio/
    s-{paragraph}-{sentence}.mp3
    s-{paragraph}-{sentence}.timing.json   # [{word_index, start_ms, end_ms}, ...]
```

This step is optional (pass `--no-tts` to skip). Books without TTS data fall back to Web Speech API in the reader.

Dependencies: `edge-tts`

### Step 6: Output format

Each chapter file (`ch-{n}.json`):

```json
{
  "chapter": 1,
  "title": "Rozdział pierwszy",
  "paragraphs": [
    {
      "sentences": [
        {
          "text": "Stasia Tarkowskiego i Nel Rawlison znał cały Port-Said.",
          "translation_ru": "Стася Тарковского и Нель Ролисон знал весь Порт-Саид.",
          "tokens": [
            {
              "surface": "Stasia",
              "lemma": "Staś",
              "pos": "PROPN",
              "morph": "Case=Gen|Gender=Masc|Number=Sing",
              "dict_ru": "Стась (имя)"
            },
            {
              "surface": "Tarkowskiego",
              "lemma": "Tarkowski",
              "pos": "PROPN",
              "morph": "Case=Gen|Gender=Masc|Number=Sing",
              "dict_ru": "Тарковский (фамилия)"
            },
            // ...
          ]
        }
      ]
    }
  ]
}
```

### Pipeline script

A single Python CLI:
```bash
python pipeline.py --source wolnelektury --book-slug w-pustyni-i-w-puszczy --output public/books/
```

Dependencies: `spacy`, `requests`, `anthropic` (for translations), `edge-tts`, `ebooklib`, `beautifulsoup4`, `lxml`, optionally `morfeusz2`.

---

## UI / UX

### Technology

- **React 18+** with Vite
- **Tailwind CSS** — mobile-first utility classes
- **PWA** manifest + service worker for offline reading
- No UI library needed — keep it minimal

### Screens

#### 1. Profile selector (first launch / switch user)

Simple screen: list of existing usernames + "Create new". No passwords — this is a family tool, not a bank.

#### 2. Library

Grid/list of available books with cover image (or a styled title card), author, word count, and reading progress bar.

#### 3. Reader (main screen — where 90%+ of time is spent)

**Layout (mobile portrait):**

```
┌─────────────────────────────┐
│  ← Book Title    Ch.3  ⚙️   │  ← minimal header
├─────────────────────────────┤
│                             │
│  Polish text paragraph      │
│  displayed with generous    │
│  line height and readable   │
│  font size.                 │
│                             │
│  Tapped word appears in     │
│  a bottom sheet with        │
│  lemma + translation +      │
│  grammar info.              │
│                             │
│  Sentence translation       │
│  revealed on sentence tap   │
│  (faded, below the Polish)  │
│                             │
├─────────────────────────────┤
│  ▶ Play  │  📝 Vocab  │ ← │  ← bottom toolbar
└─────────────────────────────┘
```

**Key interactions:**

| Action | Result |
|---|---|
| Tap a word (new) | Bottom sheet: lemma, POS, morphology, Russian translation. Button: "＋ Add to vocab" |
| Tap a word (already in vocab) | Bottom sheet shows same info + current Leitner box. Button: "Не помню" → downgrades word one Leitner box (min box 1). Current sentence is added as additional context to the vocab entry. |
| Tap a sentence (outside a word) | Toggle Russian translation below the sentence (faded/smaller font) |
| Long-press a sentence | Copy Polish text to clipboard |
| ▶ Play button | TTS reads current paragraph, highlighting each word as spoken |
| Swipe left/right or arrows | Next/previous page (paginated by ~3-5 paragraphs) |
| Scroll | Natural scroll within current page |

**Word familiarity visual cue (optional but nice for v1):**
- Words in the user's vocab list could have a subtle dot or underline
- Words reviewed ≥ N times in Leitner box 3+ → no marking (considered "known")

**TTS word highlighting:**
- Audio is **pre-generated at pipeline time** using `edge-tts` (Microsoft Edge Neural TTS, free)
- Voice: `pl-PL-ZofiaNeural` (female, natural-sounding Polish) or `pl-PL-MarekNeural` (male)
- `edge-tts` returns **word-level timestamps** (SSML boundary metadata) alongside the audio
- Pipeline outputs per-sentence: an MP3 file + a timing JSON mapping each word index to `{start_ms, end_ms}`
- The reader plays audio via `<audio>` element and uses the timing data to highlight words in sync
- Playback controls: play/pause, speed (0.75×, 1×, 1.25×) — speed via `HTMLAudioElement.playbackRate`
- Read one sentence at a time; auto-advance to next sentence with a short pause

**TTS storage:** ~1-2 MB per chapter (MP3 at 48kbps mono). A full novel ≈ 30-60 MB of audio. Acceptable for PWA with lazy loading (download chapter audio on first play, cache via service worker).

**Fallback:** if audio files aren't available (e.g., user skipped TTS generation in pipeline to save space), fall back to Web Speech API with `pl-PL` system voice. Show a note that quality may vary.

**Font:** Use a system font stack or Inter. Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż) must render correctly — test on Android/iOS.

#### 4. Vocabulary review

**Leitner box system (3 boxes):**

| Box | Review interval | Promotion condition | Demotion condition |
|---|---|---|---|
| 1 (New) | Every session | Correct → Box 2 | — |
| 2 (Learning) | Every 3 days | Correct → Box 3 | Wrong → Box 1 |
| 3 (Known) | Every 7 days | Stays in Box 3 | Wrong → Box 1 |

**Review card UI:**
- Front: Polish word in **sentence context** (randomly picked from the word's `contexts` array — variety reinforces learning)
  - The target word is highlighted within the sentence
- Back: lemma, Russian translation, grammar note
- Buttons: "Знаю" (Know) / "Не знаю" (Don't know)
- Show: words due for review count on the main library screen as a badge

**Word detail page** (accessible from vocab list):
- Lemma, POS, Russian translation at the top
- Current Leitner box + review stats
- List of all context sentences (chronological), each showing:
  - The Polish sentence with the target word highlighted
  - The inflected form encountered (e.g., *domowi* in sentence 1, *domem* in sentence 3)
  - Russian translation below
  - Book + chapter reference
- This view makes it natural to see how the same word appears in different cases/contexts

**Downgrade-on-tap flow:**
When a user taps a word in the reader that's already in their vocab list:
1. The bottom sheet shows a "Не помню" button (instead of "＋ Add")
2. Tapping it: moves the word down one Leitner box (box 3→2, 2→1, 1 stays at 1)
3. Adds the current sentence as a new context entry
4. Brief toast confirmation: "dom ↓ Коробка 1 · контекст сохранён"
This creates a natural loop: you're reading, you see a word you "should" know but don't → one tap both schedules it for sooner review and captures the new context you struggled with.

#### 5. Stats

A simple page showing:
- **Total unique words encountered** (parsed from reading progress)
- **Words in vocab list** (broken down by Leitner box)
- **Reading time** (tracked approximately via time-on-reader-screen)
- **Books / chapters completed**
- **Current streak** (days with ≥ 5 min reading time)

Display the word count prominently — "Вы встретили 1,247 уникальных польских слов" is a great motivator.

#### 6. Settings

- Switch user profile
- TTS speed (0.75× / 1× / 1.25×)
- Font size (small / medium / large)
- Translation language display (Russian — hardcoded for now, but keep the architecture flexible)
- Export vocab list as CSV
- Reset progress (with confirmation)

---

## Data Model (localStorage)

```typescript
interface UserProgress {
  currentBook: string;        // book-id
  bookProgress: {
    [bookId: string]: {
      currentChapter: number;
      currentPage: number;     // page within chapter
      completedChapters: number[];
    }
  };
}

interface VocabEntry {
  lemma: string;              // dictionary form
  surface: string;            // form as first encountered
  pos: string;
  translationRu: string;
  morphNote: string;          // e.g. "Case=Gen|Gender=Masc"
  contexts: Array<{           // multiple sentences where word was encountered/reviewed
    sentence: string;         // Polish sentence
    translation: string;      // Russian translation
    surface: string;          // inflected form in this context
    bookId: string;
    chapter: number;
    addedAt: string;          // ISO date
  }>;
  leitnerBox: 1 | 2 | 3;
  lastReviewed: string;       // ISO date
  nextReview: string;         // ISO date
  timesCorrect: number;
  timesIncorrect: number;
  addedAt: string;            // ISO date
}

interface UserStats {
  wordsEncountered: Set<string>;  // unique lemmas from reading
  totalReadingTimeMinutes: number;
  sessionsLog: Array<{
    date: string;
    minutes: number;
    wordsRead: number;
  }>;
}

interface UserSettings {
  ttsSpeed: number;           // 0.75 | 1.0 | 1.25
  fontSize: 'small' | 'medium' | 'large';
}
```

---

## Implementation Plan

### Phase 1: Content pipeline (Python)

1. Script to fetch a book from Wolne Lektury API
2. Segment into chapters → paragraphs → sentences → tokens (spaCy)
3. Morphological analysis (spaCy `pl_core_news_lg`)
4. Per-sentence Russian translation (Claude Haiku, batched)
5. Per-lemma dictionary lookup (Wiktionary dump + LLM fallback)
6. Output as JSON files

**Test with:** first 3 chapters of *W pustyni i w puszczy*

### Phase 2: Reader core (React)

1. Profile selection screen
2. Library screen (reads `meta.json` from each book folder)
3. Reader screen: display text, paginate, chapter navigation
4. Word tap → bottom sheet with morphology + translation
5. Sentence tap → toggle Russian translation

### Phase 3: TTS + highlighting

1. Integrate Web Speech API for Polish
2. Word boundary event → highlight sync
3. Play/pause/speed controls

### Phase 4: Vocabulary system

1. "Add to vocab" from word bottom sheet
2. Vocab list view (grouped by Leitner box)
3. Review session screen with flashcard UI
4. Leitner promotion/demotion logic
5. Review-due badge on library screen

### Phase 5: Stats + polish

1. Reading time tracking
2. Unique words counter
3. Stats display screen
4. PWA manifest + service worker for offline
5. Export vocab as CSV

---

## Non-goals for v1

- Video content / dual subtitles (v2)
- Cross-device sync (would need a backend)
- Content from non-public-domain sources
- Pronunciation assessment
- Writing/production exercises
- Android/iOS native app

---

## Technical Notes

- **TTS:** Pre-generated via `edge-tts` at pipeline time. `pl-PL-ZofiaNeural` is high quality and free. Audio stored as MP3 (~1-2 MB/chapter). Word timestamps from SSML metadata enable precise highlighting. Total audio per novel ≈ 30-60 MB, lazy-loaded and cached by service worker.
- **Content size:** a full novel ≈ 1-3 MB of JSON with all annotations. 10 books ≈ 30 MB. Fine for a PWA.
- **spaCy model accuracy:** `pl_core_news_lg` is good but not perfect on lemmatization of rare forms. For v1 this is acceptable — occasional wrong lemma is not a dealbreaker.
- **Translation quality:** Claude Haiku produces good Polish→Russian literary translations. Budget ~$1-3 per novel in API costs for batch translation.
- **Offline support:** service worker caches all book JSONs after first load. The app should work fully offline after initial content download.

---
