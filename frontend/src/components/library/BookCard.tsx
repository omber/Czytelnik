import { useNavigate } from 'react-router-dom'
import { BookWithProgress } from '../../hooks/useBooks'

const BASE = import.meta.env.BASE_URL

interface Props {
  book: BookWithProgress
}

export default function BookCard({ book }: Props) {
  const navigate = useNavigate()
  const chapter = book.progress?.chapter ?? 1
  const pct =
    book.chapterCount > 1 ? Math.round(((chapter - 1) / book.chapterCount) * 100) : 0

  return (
    <button
      onClick={() => navigate(`/read/${book.id}/${chapter}`)}
      className="w-full text-left bg-slate-800 rounded-2xl p-3 flex flex-col gap-2 active:scale-[0.97] transition-all hover:bg-slate-700/80"
    >
      {/* Book cover */}
      <div className="w-full aspect-[3/4] rounded-xl overflow-hidden relative bg-gradient-to-br from-blue-900 via-blue-800 to-slate-700">
        {book.cover ? (
          <img
            src={`${BASE}books/${book.id}/${book.cover}`}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-end p-2.5">
            <p className="text-white font-semibold text-xs leading-snug line-clamp-4 drop-shadow">
              {book.title}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-white text-sm font-medium leading-snug line-clamp-2">{book.title}</p>
        <p className="text-slate-400 text-xs truncate">{book.author}</p>
        <p className="text-slate-500 text-xs">
          {book.wordCount.toLocaleString()} слов · {book.chapterCount}{' '}
          {book.chapterCount === 1 ? 'гл.' : 'гл.'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-700 rounded-full">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${Math.max(pct, book.progress ? 2 : 0)}%` }}
        />
      </div>

      {book.progress ? (
        <p className="text-xs text-slate-500">Гл. {chapter}</p>
      ) : (
        <p className="text-xs text-slate-600">Не начата</p>
      )}
    </button>
  )
}
