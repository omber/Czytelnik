import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useBooks } from '../hooks/useBooks'
import LibraryGrid from '../components/library/LibraryGrid'

export default function LibraryPage() {
  const { currentUser } = useUser()
  const navigate = useNavigate()
  const { books, loading, error } = useBooks(currentUser)

  useEffect(() => {
    if (!currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  if (!currentUser) return null

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Czytelnik</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/vocab')}
            className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800"
          >
            Слова
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800"
          >
            Статистика
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            aria-label="Настройки"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-5">Библиотека</h2>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <p className="text-slate-400 text-center py-16 text-sm">
            Книги не найдены.
            <br />
            <span className="text-slate-600">Обработайте книгу через pipeline.</span>
          </p>
        )}

        {!loading && books.length > 0 && <LibraryGrid books={books} />}
      </main>
    </div>
  )
}
