import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useProgress } from '../hooks/useProgress'
import { useTTS, QueueItem } from '../hooks/useTTS'
import { useSettings } from '../hooks/useSettings'
import { useStats } from '../hooks/useStats'
import { paginate } from '../lib/pagination'
import { ChapterData, ChapterMeta, Token, Sentence } from '../types/book'
import Paragraph from '../components/reader/Paragraph'
import ReaderHeader from '../components/reader/ReaderHeader'
import WordBottomSheet from '../components/reader/WordBottomSheet'

const BASE = import.meta.env.BASE_URL

export default function ReaderPageRoute() {
  const { bookId, chapter: chapterParam } = useParams<{
    bookId: string
    chapter: string
  }>()
  const navigate = useNavigate()
  const { currentUser } = useUser()

  const [chapterData, setChapterData] = useState<ChapterData | null>(null)
  const [chapters, setChapters] = useState<ChapterMeta[]>([])
  const [bookTitle, setBookTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Word tap state — track token + sentence for vocab context
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { progress, savePosition } = useProgress(currentUser ?? '')
  const { settings } = useSettings(currentUser ?? '')
  const { logSession, addUniqueWords } = useStats(currentUser ?? '')

  const bookIdStr = bookId ?? ''
  const chapterNum = parseInt(chapterParam ?? '1', 10)

  // TTS
  const tts = useTTS(bookIdStr, chapterNum, settings.ttsSpeed)

  // Track session reading time
  const sessionStartRef = useRef(Date.now())
  useEffect(() => {
    sessionStartRef.current = Date.now()
    return () => {
      const seconds = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (seconds >= 5) logSession(bookIdStr, seconds)
    }
  }, [bookIdStr]) // eslint-disable-line react-hooks/exhaustive-deps

  // Current page: use stored page only if we're on the same chapter
  const savedProgress = progress[bookIdStr]
  const currentPage =
    savedProgress?.chapter === chapterNum ? (savedProgress.page ?? 0) : 0

  const pages = chapterData ? paginate(chapterData.paragraphs) : []
  const totalPages = Math.max(pages.length, 1)

  function setPage(page: number) {
    tts.stop()
    savePosition(bookIdStr, chapterNum, page)
  }

  // Build a flat queue of all sentences on the current page
  const currentParas = pages[currentPage] ?? []
  function buildPageQueue(): QueueItem[] {
    const items: QueueItem[] = []
    for (const para of currentParas) {
      for (const sent of para.sentences) {
        items.push({ paraIdx: para.index, sentIdx: sent.index, sentence: sent })
      }
    }
    return items
  }

  // Record unique words encountered on the current page
  useEffect(() => {
    if (!currentParas.length) return
    const lemmas = currentParas
      .flatMap(p => p.sentences)
      .flatMap(s => s.tokens)
      .filter(t => !t.is_space && t.lemma)
      .map(t => t.lemma)
    addUniqueWords(lemmas)
  }, [currentPage, chapterData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe navigation
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    // Ignore mostly-vertical swipes
    if (Math.abs(dy) > Math.abs(dx) * 0.8) return
    if (Math.abs(dx) < 50) return

    if (dx < 0 && currentPage < totalPages - 1) {
      setPage(currentPage + 1)
    } else if (dx > 0 && currentPage > 0) {
      setPage(currentPage - 1)
    }
  }

  // Load chapter data when bookId or chapterNum changes
  useEffect(() => {
    if (!bookIdStr || !currentUser) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setChapterData(null)

    Promise.all([
      fetch(`${BASE}books/${bookIdStr}/ch-${chapterNum}.json`).then(r => {
        if (!r.ok) throw new Error(`Глава не найдена (${r.status})`)
        return r.json() as Promise<ChapterData>
      }),
      fetch(`${BASE}books/${bookIdStr}/chapters.json`).then(r =>
        r.json() as Promise<ChapterMeta[]>,
      ),
      fetch(`${BASE}books/${bookIdStr}/meta.json`).then(r =>
        r.json() as Promise<{ title: string }>,
      ),
    ])
      .then(([chData, chsList, meta]) => {
        if (cancelled) return
        setChapterData(chData)
        setChapters(chsList)
        setBookTitle(meta.title)
        // Save that we opened this chapter (so library shows correct resume point)
        if (!savedProgress || savedProgress.chapter !== chapterNum) {
          savePosition(bookIdStr, chapterNum, 0)
        }
      })
      .catch(e => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bookIdStr, chapterNum, currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) {
    navigate('/', { replace: true })
    return null
  }

  const currentChapterMeta = chapters.find(c => c.number === chapterNum) ?? {
    number: chapterNum,
    title: `Глава ${chapterNum}`,
  }

  return (
    <div
      className="min-h-screen bg-slate-900 flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {!loading && chapterData && (
        <ReaderHeader
          bookId={bookIdStr}
          bookTitle={bookTitle}
          chapter={currentChapterMeta}
          chapters={chapters}
          page={currentPage}
          totalPages={totalPages}
          onPrevPage={() => setPage(Math.max(0, currentPage - 1))}
          onNextPage={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
        />
      )}

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mt-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => navigate('/library')}
              className="mt-3 text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Назад в библиотеку
            </button>
          </div>
        )}

        {!loading && chapterData && (
          <div className={`text-white ${{
            sm: 'text-sm leading-6',
            base: 'text-base leading-7',
            lg: 'text-lg leading-8',
            xl: 'text-xl leading-9',
          }[settings.fontSize]}`}>
            {currentParas.map(para => (
              <Paragraph
                key={para.index}
                paragraph={para}
                onWordTap={(token, sentence) => {
                  setSelectedToken(token)
                  setSelectedSentence(sentence)
                  setSheetOpen(true)
                }}
                playingSentIdx={
                  tts.current?.paraIdx === para.index ? tts.current.sentIdx : null
                }
                playingTokenIdx={
                  tts.current?.paraIdx === para.index
                    ? tts.current.highlightedTokenIndex
                    : null
                }
              />
            ))}

            {/* TTS transport bar */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {/* Prev sentence */}
              <button
                onClick={tts.prevSentence}
                disabled={!tts.isActive}
                className="p-3 rounded-xl bg-slate-800/80 text-slate-300 disabled:text-slate-700 disabled:bg-slate-800/30 hover:bg-slate-700 transition-colors"
                aria-label="Предыдущее предложение"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              {/* Play / Pause / Resume */}
              <button
                onClick={() => {
                  if (tts.isPlaying) tts.pause()
                  else if (tts.isPaused) tts.resume()
                  else tts.play(buildPageQueue())
                }}
                className={`flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-medium transition-colors ${
                  tts.isActive
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
                aria-label={tts.isPlaying ? 'Пауза' : tts.isPaused ? 'Продолжить' : 'Слушать'}
              >
                {tts.isPlaying ? (
                  // Pause icon
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  // Play icon
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                {tts.isPlaying ? 'Пауза' : tts.isPaused ? 'Продолжить' : 'Слушать'}
              </button>

              {/* Stop — only visible when active */}
              <button
                onClick={tts.stop}
                disabled={!tts.isActive}
                className="p-3 rounded-xl bg-slate-800/80 text-slate-300 disabled:text-slate-700 disabled:bg-slate-800/30 hover:bg-slate-700 transition-colors"
                aria-label="Стоп"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>

              {/* Next sentence */}
              <button
                onClick={tts.nextSentence}
                disabled={!tts.isActive}
                className="p-3 rounded-xl bg-slate-800/80 text-slate-300 disabled:text-slate-700 disabled:bg-slate-800/30 hover:bg-slate-700 transition-colors"
                aria-label="Следующее предложение"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zm2-8.14 4.48 3.14L8 16.14V9.86zM16 6h2v12h-2z" />
                </svg>
              </button>
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-between mt-3 pb-8">
              <button
                onClick={() => currentPage > 0 && setPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="py-3 px-5 rounded-xl bg-slate-800/80 text-slate-300 text-sm disabled:text-slate-700 disabled:bg-slate-800/30 hover:bg-slate-700 transition-colors"
              >
                ← Назад
              </button>
              <button
                onClick={() =>
                  currentPage < totalPages - 1 && setPage(currentPage + 1)
                }
                disabled={currentPage === totalPages - 1}
                className="py-3 px-5 rounded-xl bg-slate-800/80 text-slate-300 text-sm disabled:text-slate-700 disabled:bg-slate-800/30 hover:bg-slate-700 transition-colors"
              >
                Далее →
              </button>
            </div>
          </div>
        )}
      </main>

      <WordBottomSheet
        token={selectedToken}
        sentence={selectedSentence}
        bookId={bookIdStr}
        chapter={chapterNum}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
