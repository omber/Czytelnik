import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useSettings } from '../hooks/useSettings'
import { UserSettings } from '../types/user'

const FONT_OPTIONS: { value: UserSettings['fontSize']; label: string; example: string }[] = [
  { value: 'sm', label: 'А−', example: 'Маленький' },
  { value: 'base', label: 'А', example: 'Обычный' },
  { value: 'lg', label: 'А+', example: 'Большой' },
  { value: 'xl', label: 'А++', example: 'Очень большой' },
]

export default function SettingsPage() {
  const { currentUser, logout } = useUser()
  const navigate = useNavigate()
  const { settings, updateTtsSpeed, updateFontSize } = useSettings(currentUser ?? '')

  useEffect(() => {
    if (!currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  if (!currentUser) return null

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
        <h1 className="text-xl font-bold tracking-tight">Настройки</h1>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        {/* Font size */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Размер шрифта
          </h2>
          <div className="flex gap-2">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateFontSize(opt.value)}
                className={`flex-1 py-3 rounded-xl text-center transition-colors ${
                  settings.fontSize === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="text-lg font-bold">{opt.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{opt.example}</div>
              </button>
            ))}
          </div>
          <div
            className={`mt-3 px-4 py-3 bg-slate-800 rounded-xl text-slate-200 ${
              settings.fontSize === 'sm'
                ? 'text-sm leading-6'
                : settings.fontSize === 'base'
                  ? 'text-base leading-7'
                  : settings.fontSize === 'lg'
                    ? 'text-lg leading-8'
                    : 'text-xl leading-9'
            }`}
          >
            Uroczyście oświadczam, że wszystkie osoby są fikcją.
          </div>
        </section>

        {/* TTS speed */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Скорость чтения вслух
          </h2>
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-sm">0.5×</span>
              <span className="text-white font-semibold tabular-nums">
                {settings.ttsSpeed.toFixed(1)}×
              </span>
              <span className="text-slate-400 text-sm">2.0×</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.ttsSpeed}
              onChange={e => updateTtsSpeed(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between mt-2">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(v => (
                <button
                  key={v}
                  onClick={() => updateTtsSpeed(v)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    settings.ttsSpeed === v
                      ? 'text-blue-400 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Аккаунт
          </h2>
          <div className="bg-slate-800 rounded-xl divide-y divide-slate-700">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-slate-400 text-sm">Пользователь</span>
              <span className="text-white font-medium">{currentUser}</span>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/', { replace: true })
              }}
              className="w-full px-4 py-3 text-left text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              Выйти из профиля
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            О приложении
          </h2>
          <div className="bg-slate-800 rounded-xl px-4 py-3 space-y-1">
            <p className="text-white font-semibold">Czytelnik</p>
            <p className="text-slate-400 text-sm">
              Читайте польские книги с русскими переводами и изучайте слова.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
