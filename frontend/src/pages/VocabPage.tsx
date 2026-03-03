import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useVocab } from '../hooks/useVocab'
import { VocabEntry } from '../types/user'
import BottomSheet from '../components/ui/BottomSheet'
import { POS_LABELS } from '../lib/constants'

const BOX_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Ящик 1 · каждый день',
  2: 'Ящик 2 · раз в 3 дня',
  3: 'Ящик 3 · раз в 7 дней',
}

const BOX_COLORS: Record<1 | 2 | 3, string> = {
  1: 'text-orange-400 border-orange-800 bg-orange-900/20',
  2: 'text-blue-400 border-blue-800 bg-blue-900/20',
  3: 'text-green-400 border-green-800 bg-green-900/20',
}

// ── Flashcard component ──────────────────────────────────────────────────────

interface FlashcardProps {
  entry: VocabEntry
  index: number
  total: number
  onCorrect: () => void
  onWrong: () => void
}

function Flashcard({ entry, index, total, onCorrect, onWrong }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {index + 1} / {total}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-4 rounded-full ${i <= index ? 'bg-blue-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-slate-800 rounded-2xl p-7 min-h-[220px] flex flex-col justify-between border border-slate-700">
        <div>
          {/* Polish side — always visible */}
          <div className="flex items-baseline gap-3 flex-wrap mb-1">
            <span className="text-4xl font-bold text-white">{entry.lemma}</span>
            {entry.surface.toLowerCase() !== entry.lemma.toLowerCase() && (
              <span className="text-slate-400 text-lg">{entry.surface}</span>
            )}
          </div>
          <span className="text-sm text-slate-500">
            {POS_LABELS[entry.pos] ?? entry.pos}
          </span>

          {/* Russian side — hidden until flipped */}
          {flipped && (
            <div className="mt-5">
              <p className="text-2xl font-semibold text-blue-200">
                {entry.translation || '—'}
              </p>
              {entry.contexts[0] && (
                <div className="mt-4 border-l-2 border-slate-600 pl-3">
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    {entry.contexts[0].sentenceText}
                  </p>
                  {entry.contexts[0].sentenceTranslation && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {entry.contexts[0].sentenceTranslation}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!flipped && (
          <button
            onClick={() => setFlipped(true)}
            className="mt-6 w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors active:scale-[0.98]"
          >
            Показать перевод
          </button>
        )}
      </div>

      {/* Answer buttons */}
      {flipped && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setFlipped(false)
              onWrong()
            }}
            className="flex-1 py-4 rounded-2xl bg-red-900/30 text-red-400 font-semibold text-lg border border-red-900 hover:bg-red-900/50 active:scale-[0.97] transition-all"
          >
            ✗ Не знаю
          </button>
          <button
            onClick={() => {
              setFlipped(false)
              onCorrect()
            }}
            className="flex-1 py-4 rounded-2xl bg-green-900/30 text-green-400 font-semibold text-lg border border-green-900 hover:bg-green-900/50 active:scale-[0.97] transition-all"
          >
            ✓ Знаю
          </button>
        </div>
      )}
    </div>
  )
}

// Normalize Polish text for accent-insensitive search:
// ł doesn't decompose via NFD so handle it explicitly first
function normalize(s: string): string {
  return s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Main page ────────────────────────────────────────────────────────────────

type Tab = 'review' | 'list'

export default function VocabPage() {
  const navigate = useNavigate()
  const { currentUser } = useUser()
  const vocab = useVocab(currentUser ?? '')
  const [tab, setTab] = useState<Tab>('review')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteLemma, setConfirmDeleteLemma] = useState<string | null>(null)
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(false)

  // Review state
  const [dueQueue, setDueQueue] = useState<VocabEntry[]>(() => shuffle(vocab.getDue()))
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewDone, setReviewDone] = useState(false)

  // Refresh queue when new words are added (e.g. navigating here after adding)
  useEffect(() => {
    if (!reviewDone) {
      setDueQueue(shuffle(vocab.getDue()))
    }
  }, [vocab.entries.length])

  // Word detail sheet
  const [selectedEntry, setSelectedEntry] = useState<VocabEntry | null>(null)

  if (!currentUser) {
    navigate('/', { replace: true })
    return null
  }

  const due = dueQueue
  const currentCard = due[reviewIdx]

  function handleCorrect() {
    vocab.review(currentCard.lemma, true)
    advance()
  }

  function handleWrong() {
    vocab.review(currentCard.lemma, false)
    advance()
  }

  function advance() {
    if (reviewIdx + 1 >= due.length) {
      setReviewDone(true)
    } else {
      setReviewIdx(i => i + 1)
    }
  }

  function startReview() {
    const fresh = shuffle(vocab.getDue())
    setDueQueue(fresh)
    setReviewIdx(0)
    setReviewDone(false)
  }

  // Group entries by box for list view, sorted alphabetically (memoized)
  const byBox = useMemo(() => {
    const result: Record<1 | 2 | 3, VocabEntry[]> = { 1: [], 2: [], 3: [] }
    for (const e of vocab.entries) {
      result[e.box].push(e)
    }
    for (const box of [1, 2, 3] as const) {
      result[box].sort((a, b) => a.lemma.localeCompare(b.lemma, 'pl'))
    }
    return result
  }, [vocab.entries])

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/library')}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Назад"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Мои слова</h1>
        <span className="text-sm text-slate-500">{vocab.entries.length}</span>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900">
        {(['review', 'list'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'review' ? 'Повторение' : 'Слова'}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {/* ── REVIEW TAB ── */}
        {tab === 'review' && (
          <div>
            {vocab.entries.length === 0 ? (
              <p className="text-center text-slate-500 py-16 text-sm">
                Словарь пуст.
                <br />
                <span className="text-slate-600">
                  Нажмите на слово в тексте, чтобы добавить его.
                </span>
              </p>
            ) : reviewDone || due.length === 0 ? (
              /* ── Done / nothing due ── */
              <div className="flex flex-col items-center gap-5 py-8">
                <div className="text-5xl">✓</div>
                <p className="text-xl font-semibold text-green-400">
                  {reviewDone ? 'Повторение завершено!' : 'Всё повторено!'}
                </p>
                <p className="text-sm text-slate-400 text-center">
                  Слов к повторению сегодня нет.
                </p>
                {/* Box summary */}
                <div className="w-full flex flex-col gap-2 mt-4">
                  {([1, 2, 3] as const).map(box => (
                    <div
                      key={box}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border ${BOX_COLORS[box]}`}
                    >
                      <span className="text-sm font-medium">{BOX_LABELS[box]}</span>
                      <span className="font-bold">{byBox[box].length}</span>
                    </div>
                  ))}
                </div>
                {vocab.getDue().length > 0 && (
                  <button
                    onClick={startReview}
                    className="mt-2 py-3 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
                  >
                    Повторить снова
                  </button>
                )}
              </div>
            ) : (
              /* ── Active flashcard ── */
              <Flashcard
                key={currentCard.lemma + reviewIdx}
                entry={currentCard}
                index={reviewIdx}
                total={due.length}
                onCorrect={handleCorrect}
                onWrong={handleWrong}
              />
            )}
          </div>
        )}

        {/* ── LIST TAB ── */}
        {tab === 'list' && (
          <div className="flex flex-col gap-6">
            {/* Search input */}
            {vocab.entries.length > 0 && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {vocab.entries.length === 0 && (
              <p className="text-center text-slate-500 py-16 text-sm">
                Словарь пуст.
              </p>
            )}
            {([1, 2, 3] as const).map(box => {
              const q = normalize(searchQuery)
              const entries = q
                ? byBox[box].filter(e => normalize(e.lemma).includes(q) || normalize(e.translation ?? '').includes(q))
                : byBox[box]
              return entries.length === 0 ? null : (
                <div key={box}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                    box === 1 ? 'text-orange-500' : box === 2 ? 'text-blue-500' : 'text-green-500'
                  }`}>
                    {BOX_LABELS[box]} · {entries.length}
                  </h3>
                  <div className="flex flex-col divide-y divide-slate-800 bg-slate-800/40 rounded-xl overflow-hidden">
                    {entries.map(entry => (
                      <div
                        key={entry.lemma}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-slate-700/50"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-white">
                              {entry.lemma}
                            </span>
                            <span className="text-xs text-slate-500">
                              {POS_LABELS[entry.pos] ?? entry.pos}
                            </span>
                          </div>
                          {entry.translation && (
                            <p className="text-sm text-blue-300 truncate">
                              {entry.translation}
                            </p>
                          )}
                        </div>
                        {confirmDeleteLemma === entry.lemma ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                vocab.remove(entry.lemma)
                                setConfirmDeleteLemma(null)
                              }}
                              className="text-xs text-red-400 px-2 py-1 rounded-lg bg-red-900/30 border border-red-900 hover:bg-red-900/50 transition-colors"
                            >
                              Да
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmDeleteLemma(null) }}
                              className="text-xs text-slate-400 px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteLemma(entry.lemma) }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
                            aria-label="Удалить"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Word detail sheet */}
      <BottomSheet open={!!selectedEntry} onClose={() => { setSelectedEntry(null); setConfirmDeleteEntry(false) }}>
        {selectedEntry && (
          <div className="flex flex-col gap-4">
            {/* Word header */}
            <div>
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <span className="text-3xl font-bold text-white">{selectedEntry.lemma}</span>
                {selectedEntry.surface.toLowerCase() !== selectedEntry.lemma.toLowerCase() && (
                  <span className="text-slate-400 text-lg">{selectedEntry.surface}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {POS_LABELS[selectedEntry.pos] ?? selectedEntry.pos}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${BOX_COLORS[selectedEntry.box]}`}>
                  {BOX_LABELS[selectedEntry.box]}
                </span>
              </div>
            </div>

            {/* Translation */}
            <p className="text-2xl font-semibold text-blue-200">
              {selectedEntry.translation || '—'}
            </p>

            {/* Contexts */}
            {selectedEntry.contexts.length > 0 && (
              <div className="flex flex-col gap-3">
                {selectedEntry.contexts.map((ctx, i) => (
                  <div key={i} className="border-l-2 border-slate-600 pl-3">
                    <p className="text-sm text-slate-300 leading-relaxed italic">
                      {ctx.sentenceText}
                    </p>
                    {ctx.sentenceTranslation && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {ctx.sentenceTranslation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Delete with confirmation */}
            {confirmDeleteEntry ? (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    vocab.remove(selectedEntry.lemma)
                    setSelectedEntry(null)
                    setConfirmDeleteEntry(false)
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-900/30 text-red-400 border border-red-900 hover:bg-red-900/50 text-sm font-medium transition-colors"
                >
                  Удалить
                </button>
                <button
                  onClick={() => setConfirmDeleteEntry(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteEntry(true)}
                className="mt-2 w-full py-3 rounded-xl bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/30 text-sm font-medium transition-colors"
              >
                Удалить из словаря
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
