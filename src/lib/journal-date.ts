import { dateKey } from './records-calendar'

export function journalDate(
  value: unknown,
  today = dateKey(new Date()),
): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return today
  const parsed = new Date(value + 'T12:00:00')
  return !Number.isNaN(parsed.getTime()) &&
    dateKey(parsed) === value &&
    value <= today
    ? value
    : today
}
