# Czytelnik — Improvements & Bug Fixes Plan

## Context
The app has all 5 phases complete and working. This plan addresses bugs, UX gaps, code quality issues, and PWA polish identified during a comprehensive review. Changes are ordered by impact: bugs first, then high-impact UX, then code quality, then PWA polish.

---

## Phase A: Bug Fixes

### A1. Fix useVocab mutations to use React state
**File:** `frontend/src/hooks/useVocab.ts`
- `add()`, `remove()`, `review()` all re-read from `storageGet()` instead of using `entries` state
- Change to use functional `setEntries(prev => ...)` pattern and derive from state, then persist
- This eliminates potential desync between React state and localStorage

### A2. Fix session timer potential double-count
**File:** `frontend/src/pages/ReaderPageRoute.tsx` (lines 52-71)
- The `visibilitychange` handler resets `sessionStartRef` to prevent double-count, but there's still an edge: if the browser fires `visibilitychange: hidden` and then the component unmounts in the same tick, both `save()` calls run before the ref resets
- Add a `savedRef` boolean flag — set to `true` in `save()`, check it in the cleanup, reset on visibility resume

### A3. Fix npm audit vulnerabilities
**File:** `frontend/package.json`
- Run `npm audit fix` to update `serialize-javascript` via `vite-plugin-pwa` chain
- 4 HIGH severity vulns (build-time only, but should fix)

### A4. Add book cover image fallback
**File:** `frontend/src/components/library/BookCard.tsx` (line 24-28)
- Add `onError` handler on `<img>` to fall back to the gradient+title placeholder when cover 404s
- Use local state `imgFailed` to toggle

---

## Phase B: UX Improvements

### B1. Chapter table of contents
**File:** `frontend/src/components/reader/ReaderHeader.tsx` + new `ChapterList` component
- Add a chapter list dropdown/sheet accessible from the reader header (tap chapter title to open)
- Shows all chapters with titles, current chapter highlighted
- Tap to navigate directly to any chapter
- Reuse existing `chapters` prop already passed to `ReaderHeader`

### B2. "Continue reading" card on library page
**File:** `frontend/src/pages/LibraryPage.tsx`
- At top of library, show a prominent "Continue reading" card for the last-read book
- Pull from `useProgress` — find the book with the most recent activity
- Card shows: book title, chapter N, page X/Y, tap to resume
- Skip if no books have been started

### B3. Error retry buttons
**Files:** `ReaderPageRoute.tsx`, `LibraryPage.tsx`
- Reader error state (line 225-234): add "Попробовать снова" button that re-triggers the fetch
- Library error state: add retry button that calls `retry()` or re-mounts

### B4. Page-based progress on book cards
**Files:** `BookCard.tsx`, `useBooks.ts`
- Currently: `((chapter - 1) / chapterCount) * 100` — only tracks chapters
- Improve: factor in page within chapter: `((chapter - 1 + page/totalPagesInChapter) / chapterCount) * 100`
- This requires knowing totalPages per chapter. Since we don't preload chapter data, approximate by using saved page count from progress, or just show `chapter/chapterCount` fraction more accurately

### B5. Export/import user data (cross-device sync)
**Files:** `frontend/src/pages/SettingsPage.tsx`, `frontend/src/lib/storage.ts`
- Add "Export data" button on SettingsPage that serializes all localStorage keys for the current user (progress, vocab, stats, settings) into a single JSON file and triggers a download
- Add "Import data" button with file picker that reads the JSON, validates it, and merges/overwrites into localStorage
- JSON format: `{ version: 1, username: string, progress: {...}, vocab: [...], stats: {...}, settings: {...} }`
- Show confirmation before import overwrites existing data
- This enables moving progress between devices without a backend

### B6. Show book title in sessions log
**File:** `frontend/src/pages/StatsPage.tsx` (line 191)
- Currently shows raw `bookId` slug (e.g., "joanna-chmielewska---wszyscy-jestesmy-podejrzani")
- Pass books data to StatsPage (via `useBooks` hook) and resolve bookId → title
- Fallback to bookId if book not found

### B7. Vocab deletion confirmation
**Files:** `VocabPage.tsx` (line 340, 415)
- Add a simple confirmation before deleting words from vocab
- Either a small "Удалить? Да/Нет" inline confirm, or a brief undo toast

---

## Phase C: Code Quality

### C1. Extract shared constants
**New file:** `frontend/src/lib/constants.ts`
- Move `POS_LABELS`, `MORPH_LABELS`, `CLOSING_PUNCT`, `OPENING_PUNCT`, `buildSentenceText()` here
- Currently duplicated in: `WordBottomSheet.tsx` (lines 7-55), `Sentence.tsx` (lines 5-6), `VocabPage.tsx` (lines 8-23)
- Update all imports

### C2. Add React error boundary
**New file:** `frontend/src/components/ui/ErrorBoundary.tsx`
- Wrap the main app routes in an error boundary
- Shows "Something went wrong" with a "Reload" button instead of white screen
- Catch rendering errors in reader, vocab, stats pages

### C3. Memoize expensive computations
**Files:** `VocabPage.tsx`, `StatsPage.tsx`, `ReaderPageRoute.tsx`
- `VocabPage`: wrap `byBox` grouping in `useMemo([vocab.entries])`
- `StatsPage`: wrap `last7` accumulation in `useMemo([stats.sessionsLog])`
- `ReaderPageRoute`: wrap font size class map in a constant (not object literal per render)

### C4. Add localStorage error handling
**File:** `frontend/src/lib/storage.ts`
- Wrap `localStorage.setItem` in try-catch for `QuotaExceededError`
- On quota exceeded, show a user-facing warning (could use a simple global event/callback)
- `storageGet` already catches JSON parse errors but returns null silently — add console.warn

---

## Phase D: PWA Polish

### D1. Add PNG icons
- Generate `frontend/public/icon-192.png` and `frontend/public/icon-512.png` from existing `icon.svg`
- Update `vite.config.ts` manifest icons array to include all three sizes

### D2. Add meta tags to index.html
**File:** `frontend/index.html`
- Add `<meta name="description">` for SEO
- Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Add `apple-mobile-web-app-title`

---

## Files to modify (summary)

| File | Changes |
|------|---------|
| `frontend/src/hooks/useVocab.ts` | A1: state-based mutations |
| `frontend/src/pages/ReaderPageRoute.tsx` | A2: session timer fix |
| `frontend/package.json` | A3: audit fix |
| `frontend/src/components/library/BookCard.tsx` | A4: cover fallback, B4: progress |
| `frontend/src/components/reader/ReaderHeader.tsx` | B1: chapter TOC trigger |
| `frontend/src/pages/LibraryPage.tsx` | B2: continue reading, B3: retry |
| `frontend/src/pages/StatsPage.tsx` | B6: book title in log, C3: memoize |
| `frontend/src/pages/VocabPage.tsx` | B7: delete confirm, C1: shared constants, C3: memoize |
| `frontend/src/components/reader/WordBottomSheet.tsx` | C1: shared constants |
| `frontend/src/components/reader/Sentence.tsx` | C1: shared constants |
| `frontend/src/lib/constants.ts` | C1: new shared constants file |
| `frontend/src/components/ui/ErrorBoundary.tsx` | C2: new error boundary |
| `frontend/src/lib/storage.ts` | B5: export/import helpers, C4: quota handling |
| `frontend/src/pages/SettingsPage.tsx` | B5: export/import UI |
| `frontend/src/App.tsx` | C2: wrap routes in ErrorBoundary |
| `frontend/index.html` | D2: meta tags |
| `frontend/vite.config.ts` | D1: PNG icons in manifest |

---

## Verification
1. `npm run build` — ensure no TypeScript or build errors
2. Start dev server, test in browser:
   - Open reader → tap words, add to vocab, verify no state desync
   - Navigate chapters via new TOC
   - Check library "continue reading" card
   - Verify cover image fallback (temporarily rename a cover file)
   - Check StatsPage shows book titles
   - Verify error retry by disconnecting network
   - Export data from settings, inspect JSON, then import on fresh profile
   - Inspect console for localStorage warnings
3. Run `npm audit` — confirm 0 high/critical vulnerabilities
