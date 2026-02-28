import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useStats } from '../hooks/useStats'
import { useVocab } from '../hooks/useVocab'
import { UserStats } from '../types/user'

function formatTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}с`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}мин`
  if (minutes === 0) return `${hours}ч`
  return `${hours}ч ${minutes}мин`
}

function getStreak(sessionsLog: UserStats['sessionsLog']): number {
  if (sessionsLog.length === 0) return 0
  const days = new Set(sessionsLog.map(s => s.date))
  const today = new Date().toISOString().slice(0, 10)
  // Start from today if there was a session, otherwise from yesterday
  const startDate = new Date()
  if (!days.has(today)) startDate.setDate(startDate.getDate() - 1)
  let streak = 0
  const cur = new Date(startDate)
  for (let i = 0; i < 365; i++) {
    const dateStr = cur.toISOString().slice(0, 10)
    if (days.has(dateStr)) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function getLast7Days(): { date: string; label: string; seconds: number }[] {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('ru-RU', { weekday: 'short' })
    result.push({ date, label, seconds: 0 })
  }
  return result
}

export default function StatsPage() {
  const { currentUser } = useUser()
  const navigate = useNavigate()
  const { stats } = useStats(currentUser ?? '')
  const { entries } = useVocab(currentUser ?? '')

  useEffect(() => {
    if (!currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  if (!currentUser) return null

  const streak = getStreak(stats.sessionsLog)

  // Build last 7 days activity
  const last7 = getLast7Days()
  for (const session of stats.sessionsLog) {
    const day = last7.find(d => d.date === session.date)
    if (day) day.seconds += session.seconds
  }
  const maxSeconds = Math.max(...last7.map(d => d.seconds), 1)

  // Vocab by box
  const box1 = entries.filter(e => e.box === 1).length
  const box2 = entries.filter(e => e.box === 2).length
  const box3 = entries.filter(e => e.box === 3).length

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/library')}
          className="text-slate-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Назад"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-tight">Статистика</h1>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-xl px-3 py-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {formatTime(stats.totalReadingSeconds)}
            </div>
            <div className="text-xs text-slate-400 mt-1">Время чтения</div>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-4 text-center">
            <div className="text-2xl font-bold text-green-400">{streak}</div>
            <div className="text-xs text-slate-400 mt-1">
              {streak === 1 ? 'день подряд' : streak >= 2 && streak <= 4 ? 'дня подряд' : 'дней подряд'}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {stats.uniqueWordsEncountered.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Слов встречено</div>
          </div>
        </div>

        {/* Last 7 days */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Активность за 7 дней
          </h2>
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-end gap-1.5 h-20">
              {last7.map(day => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative flex items-end" style={{ height: '56px' }}>
                    <div
                      className={`w-full rounded-t transition-all ${
                        day.seconds > 0 ? 'bg-blue-500' : 'bg-slate-700'
                      }`}
                      style={{
                        height: `${Math.max(day.seconds > 0 ? 8 : 4, (day.seconds / maxSeconds) * 56)}px`,
                        minHeight: day.seconds > 0 ? '8px' : '4px',
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{day.label}</span>
                </div>
              ))}
            </div>
            {last7.every(d => d.seconds === 0) && (
              <p className="text-center text-slate-500 text-sm mt-2">Пока нет данных</p>
            )}
          </div>
        </section>

        {/* Vocabulary */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Словарный запас
          </h2>
          <div className="bg-slate-800 rounded-xl divide-y divide-slate-700">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Всего слов</div>
                <div className="text-xs text-slate-400 mt-0.5">В личном словаре</div>
              </div>
              <span className="text-2xl font-bold text-white">{entries.length}</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400">{box1}</div>
                <div className="text-xs text-slate-400 mt-0.5">Ящик 1</div>
                <div className="text-xs text-slate-500">каждый день</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-400">{box2}</div>
                <div className="text-xs text-slate-400 mt-0.5">Ящик 2</div>
                <div className="text-xs text-slate-500">раз в 3 дня</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{box3}</div>
                <div className="text-xs text-slate-400 mt-0.5">Ящик 3</div>
                <div className="text-xs text-slate-500">раз в 7 дней</div>
              </div>
            </div>
          </div>
        </section>

        {/* Sessions log */}
        {stats.sessionsLog.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Последние сессии
            </h2>
            <div className="bg-slate-800 rounded-xl divide-y divide-slate-700">
              {[...stats.sessionsLog]
                .reverse()
                .slice(0, 10)
                .map((session, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-white">{session.bookId}</span>
                      <span className="text-xs text-slate-500 ml-2">{session.date}</span>
                    </div>
                    <span className="text-sm text-slate-300 tabular-nums">
                      {formatTime(session.seconds)}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
