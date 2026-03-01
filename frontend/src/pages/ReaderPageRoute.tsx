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
    window.scrollTo({ top: 0, behavior: 'instant' })
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
          ttsIsPlaying={tts.isPlaying}
          ttsIsPaused={tts.isPaused}
          ttsIsActive={tts.isActive}
          onTtsPlay={() => tts.play(buildPageQueue())}
          onTtsPause={tts.pause}
          onTtsResume={tts.resume}
          onTtsStop={tts.stop}
          onTtsPrevSentence={tts.prevSentence}
          onTtsNextSentence={tts.nextSentence}
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
