import type { DiaryEnvironment, DiaryWeather } from '../types'
import { dateKey } from './records-calendar'

export function weatherLabel(code: number): string {
  if (code === 0) return '快晴'
  if (code === 1) return '晴れ'
  if (code === 2) return '晴れ時々曇り'
  if (code === 3) return '曇り'
  if ([45, 48].includes(code)) return '霧'
  if ([51, 53, 55, 56, 57].includes(code)) return '霧雨'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '雨'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '雪'
  if ([95, 96, 99].includes(code)) return '雷雨'
  return '不明'
}
export function weatherUrl(
  latitude: number,
  longitude: number,
  date: string,
  today = dateKey(new Date()),
) {
  const days = (Date.parse(today) - Date.parse(date)) / 86400000
  const base =
    days > 90
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'
  const query = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    start_date: date,
    end_date: date,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    temperature_unit: 'celsius',
  })
  return `${base}?${query}`
}
export function parseWeather(data: unknown, date: string): DiaryWeather {
  const daily = (data as { daily?: Record<string, unknown[]> })?.daily
  const index = daily?.time?.indexOf(date) ?? -1
  const code = daily?.weather_code?.[index],
    max = daily?.temperature_2m_max?.[index],
    min = daily?.temperature_2m_min?.[index]
  if (
    index < 0 ||
    typeof code !== 'number' ||
    typeof max !== 'number' ||
    typeof min !== 'number' ||
    ![code, max, min].every(Number.isFinite)
  )
    throw new Error('この日付の天気を取得できませんでした。')
  return { date, code, high: max, low: min }
}
export function municipality(data: unknown): string {
  const address = (data as { address?: Record<string, string> })?.address
  if (!address) throw new Error('市区町村を取得できませんでした。')
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county
  const parts = [
    ...new Set([address.state || address.province, city].filter(Boolean)),
  ]
  if (!city) throw new Error('市区町村を取得できませんでした。')
  return parts.join(' ')
}
async function json(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok)
    throw new Error('通信に失敗しました。時間をおいて再試行してください。')
  return response.json()
}
const places = new Map<string, string>()
let lastPlaceRequest = 0
async function placeName(
  latitude: number,
  longitude: number,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({
    format: 'jsonv2',
    lat: latitude.toFixed(2),
    lon: longitude.toFixed(2),
    zoom: '10',
    'accept-language': 'ja',
  })
  const key = query.toString()
  if (places.has(key)) return places.get(key)!
  if (Date.now() - lastPlaceRequest < 1100)
    throw new Error('少し待ってから再試行してください。')
  lastPlaceRequest = Date.now()
  const name = municipality(
    await json(`https://nominatim.openstreetmap.org/reverse?${query}`, signal),
  )
  places.set(key, name)
  return name
}
export async function recordEnvironment(
  date: string,
  options: { location: boolean; weather: boolean },
  signal: AbortSignal,
): Promise<DiaryEnvironment> {
  if (!navigator.geolocation)
    throw new Error('この端末では位置情報を取得できません。')
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? '位置情報の利用が許可されていません。ブラウザーの設定から許可してください。'
              : '現在地を取得できませんでした。もう一度お試しください。',
          ),
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    ),
  )
  signal.throwIfAborted()
  const { latitude, longitude } = position.coords
  const [place, weather] = await Promise.all([
    options.location ? placeName(latitude, longitude, signal) : undefined,
    options.weather
      ? json(weatherUrl(latitude, longitude, date), signal).then((data) =>
          parseWeather(data, date),
        )
      : undefined,
  ])
  signal.throwIfAborted()
  return { place, weather, recordedAt: new Date().toISOString() }
}
