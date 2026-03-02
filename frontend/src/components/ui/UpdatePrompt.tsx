import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // iOS Safari doesn't re-check the SW when returning to the PWA.
      // Force a network check every time the page becomes visible.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration?.update()
        }
      })
    },
  })

  // Also check on initial mount (handles cold-start after an update was deployed)
  useEffect(() => {
    navigator.serviceWorker?.getRegistration().then(reg => reg?.update())
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-safe">
      <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 shadow-lg text-white text-sm">
        <span className="flex-1">Доступна новая версия приложения</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-white text-blue-600 font-semibold px-3 py-1 text-sm shrink-0"
        >
          Обновить
        </button>
      </div>
    </div>
  )
}
