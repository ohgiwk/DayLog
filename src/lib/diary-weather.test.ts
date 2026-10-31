import { afterEach, expect, it, vi } from 'vitest'
import {
  municipality,
  parseWeather,
  recordEnvironment,
  weatherLabel,
  weatherUrl,
} from './diary-weather'
afterEach(() => vi.unstubAllGlobals())
it('uses the selected date and chooses historical data for old diaries', () => {
  const recent = new URL(
    weatherUrl(35.68123, 139.76712, '2026-10-17', '2026-10-17'),
  )
  expect(recent.hostname).toBe('api.open-meteo.com')
  expect(recent.searchParams.get('latitude')).toBe('35.68')
  expect(recent.searchParams.get('start_date')).toBe('2026-10-17')
  expect(recent.searchParams.get('daily')).toContain('temperature_2m_min')
  expect(
    new URL(weatherUrl(35, 139, '2024-02-29', '2026-10-17')).hostname,
  ).toBe('archive-api.open-meteo.com')
})
it('rejects missing daily readings instead of recording zero degrees', () => {
  expect(
    parseWeather(
      {
        daily: {
          time: ['2026-10-17'],
          weather_code: [2],
          temperature_2m_max: [24.3],
          temperature_2m_min: [16.2],
        },
      },
      '2026-10-17',
    ),
  ).toEqual({ date: '2026-10-17', code: 2, high: 24.3, low: 16.2 })
  expect(() =>
    parseWeather(
      {
        daily: {
          time: ['2026-10-17'],
          weather_code: [2],
          temperature_2m_max: [null],
          temperature_2m_min: [16],
        },
      },
      '2026-10-17',
    ),
  ).toThrow()
  expect(() => parseWeather({}, '2026-10-17')).toThrow()
  expect(weatherLabel(95)).toBe('雷雨')
})
it('keeps only municipality-level names, excluding street and building', () => {
  expect(
    municipality({
      address: {
        state: '東京都',
        city: '千代田区',
        road: '秘密の通り',
        house_number: '1',
      },
    }),
  ).toBe('東京都 千代田区')
  expect(() => municipality({ address: { road: '通りだけ' } })).toThrow()
})
it('can record weather without saving location or making a geocoding request', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: PositionCallback) =>
        success({
          coords: { latitude: 35.681, longitude: 139.767 },
        } as GeolocationPosition),
    },
  })
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      daily: {
        time: ['2026-10-17'],
        weather_code: [0],
        temperature_2m_max: [25],
        temperature_2m_min: [16],
      },
    }),
  })
  vi.stubGlobal('fetch', fetcher)
  const result = await recordEnvironment(
    '2026-10-17',
    { location: false, weather: true },
    new AbortController().signal,
  )
  expect(result.place).toBeUndefined()
  expect(result.weather?.high).toBe(25)
  expect(result).not.toHaveProperty('latitude')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('handles denied location permission without any requests', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1 } as GeolocationPositionError),
    },
  })
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await expect(
    recordEnvironment(
      '2026-10-17',
      { location: true, weather: true },
      new AbortController().signal,
    ),
  ).rejects.toThrow('許可')
  expect(fetcher).not.toHaveBeenCalled()
})
