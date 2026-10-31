export type CalendarMode = 'month' | 'week'
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function calendarDays(
  anchor: Date,
  mode: CalendarMode,
): (Date | null)[] {
  const year = anchor.getFullYear(),
    month = anchor.getMonth()
  if (mode === 'week') {
    return Array.from(
      { length: 7 },
      (_, index) =>
        new Date(year, month, anchor.getDate() - anchor.getDay() + index, 12),
    )
  }
  const first = new Date(year, month, 1, 12).getDay()
  const count = new Date(year, month + 1, 0, 12).getDate()
  return Array.from(
    { length: Math.ceil((first + count) / 7) * 7 },
    (_, index) => {
      const day = index - first + 1
      return day < 1 || day > count ? null : new Date(year, month, day, 12)
    },
  )
}
export function moveCalendar(
  anchor: Date,
  mode: CalendarMode,
  direction: number,
): Date {
  return mode === 'week'
    ? new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate() + direction * 7,
        12,
      )
    : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1, 12)
}
