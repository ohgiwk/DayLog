import type { AppSettings, Season } from '../types'

export const seasons: {
  id: Season
  label: string
  color: string
  icon: string
}[] = [
  { id: 'spring', label: '春', color: '#61836B', icon: 'spring-leaf' },
  { id: 'summer', label: '夏', color: '#397C80', icon: 'sun' },
  { id: 'autumn', label: '秋', color: '#8B6248', icon: 'maple-leaf' },
  { id: 'winter', label: '冬', color: '#60778B', icon: 'snowflake' },
]
export function seasonForDate(date = new Date()): Season {
  const month = date.getMonth() + 1
  return month >= 3 && month <= 5
    ? 'spring'
    : month >= 6 && month <= 8
      ? 'summer'
      : month >= 9 && month <= 11
        ? 'autumn'
        : 'winter'
}
export function applySeasonTheme(
  theme: AppSettings['seasonTheme'],
  date = new Date(),
) {
  const season = theme === 'auto' ? seasonForDate(date) : theme
  document.documentElement.dataset.season = season
  return season
}
