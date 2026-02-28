import { useLocalStorage } from './useLocalStorage'
import { UserSettings } from '../types/user'

const DEFAULT: UserSettings = { ttsSpeed: 1, fontSize: 'base' }

export function useSettings(username: string) {
  const [settings, setSettings] = useLocalStorage<UserSettings>(
    username,
    'settings',
    DEFAULT,
  )

  function updateTtsSpeed(speed: number) {
    setSettings(s => ({ ...s, ttsSpeed: Math.round(speed * 10) / 10 }))
  }

  function updateFontSize(size: UserSettings['fontSize']) {
    setSettings(s => ({ ...s, fontSize: size }))
  }

  return { settings, updateTtsSpeed, updateFontSize }
}
