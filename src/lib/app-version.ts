// GitHub push webhooks supply a Unix timestamp; accept ISO dates for local builds.
export function releaseDate(value?: string): string {
 if (!value?.trim()) return new Date().toISOString()
 const input = value.trim()
 const date = new Date(/^\d+$/.test(input) ? Number(input) * 1000 : input)
 if (!Number.isFinite(date.getTime())) throw new Error('Invalid app release date')
 return date.toISOString()
}

export function formatReleaseDate(value: string): string {
 const parts = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
 }).formatToParts(new Date(value))
 const date = Object.fromEntries(parts.map(part => [part.type, part.value]))
 return `v${date.year}.${date.month}.${date.day}-${date.hour}${date.minute}${date.second}`
}
