import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { existingJournalPath } from './journal-navigation'
import { dateKey } from './records-calendar'
import type { DiaryEntry } from '../types'
const entries = [
  { id: 'today', date: dateKey(new Date()) },
  { id: 'past', date: '2024-02-29' },
] as DiaryEntry[]
it('routes the write tab directly to today, while preserving dates for new diaries', () => {
  expect(existingJournalPath(entries)).toBe('/entry/today')
  expect(existingJournalPath(entries, '2024-02-29')).toBe('/entry/past')
  expect(existingJournalPath(entries, '2024-02-28')).toBeUndefined()
  expect(existingJournalPath([])).toBeUndefined()
})
it('keeps the same route when the write tab is tapped on today’s diary', async () => {
  const component = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/entry/:id', component },
      {
        path: '/journal',
        component,
        beforeEnter: (to) => existingJournalPath(entries, to.query.date),
      },
    ],
  })
  await router.push('/entry/today')
  const route = router.currentRoute.value
  await router.push(existingJournalPath(entries)!)
  expect(router.currentRoute.value).toBe(route)
  await router.push('/journal?date=2024-02-29')
  expect(router.currentRoute.value.path).toBe('/entry/past')
})
