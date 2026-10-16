<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EntryThumbnail from '../components/EntryThumbnail.vue'
import { entries } from '../stores/diary'
import { calendarDays, dateKey, moveCalendar, type CalendarMode } from '../lib/records-calendar'

const mode = ref<CalendarMode>('week')
const anchor = ref(new Date())
const cells = computed(() => calendarDays(anchor.value, mode.value))
const entriesByDate = computed(() => new Map(entries.value.map(entry => [entry.date, entry])))
const monthFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' })
const dayFormat = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' })
const title = computed(() => {
 if (mode.value === 'month') return monthFormat.format(anchor.value)
 const first = cells.value[0]!, last = cells.value[6]!
 return `${first.getFullYear()}年 ${dayFormat.format(first)}〜${first.getFullYear() !== last.getFullYear() ? last.getFullYear() + '年 ' : ''}${dayFormat.format(last)}`
})
function move(direction: number) { anchor.value = moveCalendar(anchor.value, mode.value, direction) }
function entryOn(day: Date) { return entriesByDate.value.get(dateKey(day)) }
</script>

<template>
 <div class="page records-page">
  <header class="page-header records-header">
   <p class="eyebrow">YOUR MOMENTS</p>
   <div class="records-heading">
    <h1>記録</h1>
    <div class="view-toggle" role="group" aria-label="カレンダーの表示範囲">
     <button type="button" :aria-pressed="mode === 'month'" @click="mode = 'month'">月全体</button>
     <button type="button" :aria-pressed="mode === 'week'" @click="mode = 'week'">1週間</button>
    </div>
   </div>
   <section class="records-calendar" aria-label="記録カレンダー">
    <div class="month-nav">
     <button type="button" :aria-label="mode === 'month' ? '前の月' : '前の週'" @click="move(-1)"><AppIcon name="chevron-left" /></button>
     <h2 aria-live="polite">{{ title }}</h2>
     <button type="button" :aria-label="mode === 'month' ? '次の月' : '次の週'" @click="move(1)"><AppIcon name="chevron-right" /></button>
    </div>
    <div class="week" aria-hidden="true"><span v-for="day in ['日','月','火','水','木','金','土']" :key="day">{{ day }}</span></div>
    <div class="calendar-days" :style="{ height: `${cells.length / 7 * 48}px` }">
    <div class="days">
     <span v-for="(day, index) in cells" :key="day ? dateKey(day) : `blank-${index}`" :class="{ written: day && entryOn(day) }">
      <template v-if="day">
       <RouterLink v-if="entryOn(day)" :to="`/entry/${entryOn(day)!.id}`" :aria-label="`${dateKey(day)}の日記`" :aria-current="dateKey(day) === dateKey(new Date()) ? 'date' : undefined">{{ day.getDate() }}<i></i></RouterLink>
       <b v-else :aria-label="dateKey(day)" :aria-current="dateKey(day) === dateKey(new Date()) ? 'date' : undefined">{{ day.getDate() }}</b>
      </template>
     </span>
    </div>
    </div>
   </section>
  </header>
  <section class="recent-list" aria-label="日記の一覧">
   <h2 class="records-list-title">これまでの記録</h2>
   <p v-if="!entries.length" class="soft-card">まだ日記がありません。日記を書くと、ここに表示されます。</p>
   <RouterLink v-for="e in entries" :key="e.id" :to="`/entry/${e.id}`" class="entry-row" :class="{ 'has-photo': e.thumbnailImageId }"><EntryThumbnail :id="e.thumbnailImageId"/><div class="entry-icon" v-if="!e.thumbnailImageId"><AppIcon :name="['moon','leaf','sun','cloud','leaf'][e.mood-1]" /></div><div><small>{{new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium'}).format(new Date(e.date+'T12:00'))}}</small><h3>{{e.body}}</h3><p><span v-for="t in e.tags" :key="t">#{{t}} </span></p></div><b><AppIcon name="chevron-right" /></b></RouterLink>
  </section>
 </div>
</template>

<style scoped>
.records-header { padding-bottom: 20px; }
.records-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.view-toggle { display: inline-flex; flex-shrink: 0; padding: 3px; border: 1px solid var(--line); border-radius: 15px; background: rgba(255,255,255,.45); }
.view-toggle button { min-height: 44px; padding: 0 12px; border: 0; border-radius: 11px; background: transparent; color: var(--sub); font: inherit; font-size: .75rem; cursor: pointer; }
.view-toggle button[aria-pressed="true"] { background: white; color: var(--forest); box-shadow: 0 2px 6px rgba(30,50,40,.1); }
.view-toggle button:focus-visible, .days a:focus-visible, .month-nav button:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
.records-calendar { border-top: 1px solid rgba(82,110,101,.16); padding-top: 8px; }
.month-nav h2 { font-size: .95rem; text-align: center; }
.month-nav button { flex-shrink: 0; }
.calendar-days { overflow: hidden; transition: height 300ms cubic-bezier(.22, 1, .36, 1); }
.days > span { height: 48px; }
:global(.reduce-motion) .calendar-days { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .calendar-days { transition: none; }
}
.days a, .days b { width: 42px; height: 44px; }
.days [aria-current="date"] { outline: 1px solid var(--sage); outline-offset: -2px; }
.records-list-title { margin: 0 0 4px; font-size: 1rem; }
.entry-row { grid-template-columns: 64px minmax(0, 1fr) 12px; }
.entry-row > div { min-width: 0; }
.entry-row p { overflow-wrap: anywhere; }
.entry-row.has-photo { grid-template-columns: 104px minmax(0, 1fr) 12px; }
.entry-row.has-photo :deep(.entry-thumb) { width: 104px; height: 104px; }
@media (max-width: 374px) {
  .entry-row.has-photo { grid-template-columns: 88px minmax(0, 1fr) 12px; gap: 10px; }
  .entry-row.has-photo :deep(.entry-thumb) { width: 88px; height: 88px; }
}
</style>
