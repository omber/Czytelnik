import { useNavigate } from 'react-router-dom'
import { ChapterMeta } from '../../types/book'

interface Props {
  bookId: string
  bookTitle: string
  chapter: ChapterMeta
  chapters: ChapterMeta[]
  page: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
}

export default function ReaderHeader({
  bookId,
  bookTitle,
  chapter,
  chapters,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
}: Props) {
  const navigate = useNavigate()
  const chIdx = chapters.findIndex(c => c.number === chapter.number)
  const hasPrevPage = page > 0
  const hasNextPage = page < totalPages - 1
  const hasPrevChapter = chIdx > 0
  const hasNextChapter = chIdx < chapters.length - 1

  function goChapter(n: number) {
    navigate(`/read/${bookId}/${n}`, { replace: true })
  }

  function handlePrev() {
    if (hasPrevPage) onPrevPage()
    else if (hasPrevChapter) goChapter(chapters[chIdx - 1].number)
  }

  function handleNext() {
    if (hasNextPage) onNextPage()
    else if (hasNextChapter) goChapter(chapters[chIdx + 1].number)
  }

  const atStart = !hasPrevPage && !hasPrevChapter
  const atEnd = !hasNextPage && !hasNextChapter

  const prevLabel = !hasPrevPage && hasPrevChapter ? '← Пред. гл.' : '← Назад'
  const nextLabel = !hasNextPage && hasNextChapter ? 'След. гл. →' : 'Далее →'

  return (
    <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      {/* Title row */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <button
          onClick={() => navigate('/library')}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Библиотека"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate leading-tight">{bookTitle}</p>
          <p className="text-slate-400 text-xs truncate">{chapter.title}</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0 tabular-nums">
          {page + 1}/{totalPages}
        </span>
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between px-2 pb-2 gap-1">
        <button
          onClick={handlePrev}
          disabled={atStart}
          className="text-xs text-slate-400 disabled:text-slate-700 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800 disabled:hover:bg-transparent"
        >
          {prevLabel}
        </button>

        {/* Page progress dots */}
        <div className="flex items-center gap-1 overflow-hidden max-w-[120px]">
          {Array.from({ length: Math.min(totalPages, 12) }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-shrink-0 transition-all duration-200 ${
                i === page ? 'bg-blue-400 w-4' : 'bg-slate-700 w-1.5'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={atEnd}
          className="text-xs text-slate-400 disabled:text-slate-700 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800 disabled:hover:bg-transparent"
        >
          {nextLabel}
        </button>
      </div>
    </header>
  )
}
