import type { AppSettings } from '../types'

export const settingsKey = 'daylog:v1:settings'
const defaultSettings: AppSettings = {
  seasonTheme: 'auto',
  notifications: true,
  location: true,
  weather: true,
  reducedMotion: false,
  largeText: false,
}

export function loadSettings(): AppSettings {
  const settings = { ...defaultSettings }
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(settingsKey) || '{}',
    )
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const key of Object.keys(defaultSettings) as (keyof AppSettings)[]) {
        const value = (stored as Record<string, unknown>)[key]
        if (key === 'seasonTheme') {
          if (
            ['auto', 'spring', 'summer', 'autumn', 'winter'].includes(
              value as string,
            )
          )
            settings.seasonTheme = value as AppSettings['seasonTheme']
        } else if (typeof value === 'boolean') settings[key] = value
      }
    }
  } catch {
    /* Keep the stored value intact, and start with usable defaults. */
  }
  return settings
}
