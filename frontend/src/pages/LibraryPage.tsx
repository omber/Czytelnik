import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useBooks } from '../hooks/useBooks'
import LibraryGrid from '../components/library/LibraryGrid'

export default function LibraryPage() {
  const { currentUser, logout } = useUser()
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
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm truncate max-w-[120px]">{currentUser}</span>
          <button
            onClick={() => {
              logout()
              navigate('/', { replace: true })
            }}
            className="text-sm text-slate-500 hover:text-white transition-colors"
          >
            Выйти
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
