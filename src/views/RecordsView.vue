<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EntryThumbnail from '../components/EntryThumbnail.vue'
import { weatherLabel } from '../lib/diary-weather'
import { entries, settings } from '../stores/diary'
import { swipeDirection } from '../lib/calendar-swipe'
import { calendarDays, dateKey, moveCalendar, type CalendarMode } from '../lib/records-calendar'

const mode = ref<CalendarMode>('week')
function toggleCalendar() {
 mode.value = mode.value === 'week' ? 'month' : 'week'
}
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
const viewport = ref<HTMLElement>()
const track = ref<HTMLElement>()
const dragging = ref(false), settling = ref(false)
let offset = 0
let samples: { x: number; time: number }[] = []
function setOffset(value: number) {
 offset = value
 if (track.value) track.value.style.transform = `translate3d(calc(-100% + ${value}px), 0, 0)`
}
const panels = computed(() => [-1, 0, 1].map(direction => ({
 direction,
 days: calendarDays(direction ? moveCalendar(anchor.value, mode.value, direction) : anchor.value, mode.value),
})))
const calendarHeight = computed(() => (dragging.value || settling.value
 ? Math.max(...panels.value.map(panel => panel.days.length)) : cells.value.length) / 7 * 48)
let pointer: number | null = null, startX = 0, startY = 0, suppressClickUntil = 0
let animation: Animation | undefined
let generation = 0
function resetGesture() {
 generation++
 animation?.cancel(); animation = undefined
 const previous = pointer
 pointer = null
 if (previous !== null && viewport.value?.hasPointerCapture(previous)) viewport.value.releasePointerCapture(previous)
 dragging.value = false; settling.value = false; setOffset(0)
}
async function move(direction: number) {
 if (settling.value) return
 const width = viewport.value?.clientWidth || 0
 if (!track.value || !width) return
 const token = generation
 settling.value = true; dragging.value = false
 const reduced = settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
 const effect = track.value.animate([
  { transform: `translate3d(calc(-100% + ${offset}px), 0, 0)` },
  { transform: `translate3d(calc(-100% + ${-direction * width}px), 0, 0)` },
 ], { duration: reduced ? 0 : 260, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' })
 animation = effect
 try { await effect.finished } catch { return }
 if (token !== generation) return
 if (direction) anchor.value = moveCalendar(anchor.value, mode.value, direction)
 setOffset(0)
 await nextTick()
 effect.cancel(); animation = undefined; settling.value = false
}
function pointerDown(event: PointerEvent) {
 if (!event.isPrimary || event.button !== 0 || settling.value || pointer !== null) return
 pointer = event.pointerId; startX = event.clientX; startY = event.clientY
 samples = [{ x: startX, time: event.timeStamp }]
}
function pointerMove(event: PointerEvent) {
 if (pointer !== event.pointerId || settling.value) return
 const dx = event.clientX - startX, dy = event.clientY - startY
 if (!dragging.value) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return
  if (Math.abs(dy) > Math.abs(dx) * 1.3) { pointer = null; return }
  if (Math.abs(dx) <= Math.abs(dy)) return
  dragging.value = true
  viewport.value?.setPointerCapture(event.pointerId)
 }
 const width = viewport.value?.clientWidth || 0
 setOffset(Math.max(-width, Math.min(width, dx)))
 samples.push({ x: event.clientX, time: event.timeStamp })
 samples = samples.filter(sample => event.timeStamp - sample.time <= 100)
 event.preventDefault()
}
function pointerLeave() {
 if (!dragging.value) pointer = null
}
function pointerEnd(event: PointerEvent) {
 // Touch pointers initially belong to the tapped child. Its capture loss is not a cancelled swipe.
 if (event.type === 'lostpointercapture' && event.target !== viewport.value) return
 if (pointer !== event.pointerId) return
 pointer = null
 if (!dragging.value) return
 suppressClickUntil = Date.now() + 400
 const sample = samples.find(value => event.timeStamp - value.time <= 120)
 const elapsed = sample ? event.timeStamp - sample.time : 0
 const velocity = sample && elapsed > 0 ? (event.clientX - sample.x) / elapsed : 0
 const direction = event.type !== 'pointerup' ? 0 : swipeDirection(offset, viewport.value?.clientWidth || 0, velocity)
 void move(direction)
}
function preventSwipeClick(event: MouseEvent) {
 if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation() }
}
watch(mode, resetGesture, { flush: 'sync' })
onBeforeUnmount(resetGesture)
function entryOn(day: Date) { return entriesByDate.value.get(dateKey(day)) }
</script>

<template>
 <div class="page records-page">
  <header class="page-header records-header">
   <p class="eyebrow">YOUR MOMENTS</p>
   <div class="records-heading">
    <h1>記録</h1>
   </div>
   <section class="records-calendar" aria-label="記録カレンダー">
    <div id="records-calendar-content">
    <div class="month-nav">
     <button type="button" :aria-label="mode === 'month' ? '前の月' : '前の週'" @click="move(-1)"><AppIcon name="chevron-left" /></button>
     <h2 aria-live="polite">{{ title }}</h2>
     <button type="button" :aria-label="mode === 'month' ? '次の月' : '次の週'" @click="move(1)"><AppIcon name="chevron-right" /></button>
    </div>
    <div class="week" aria-hidden="true"><span v-for="day in ['日','月','火','水','木','金','土']" :key="day">{{ day }}</span></div>
    <div ref="viewport" class="calendar-days" :class="{ dragging }" :style="{ height: `${calendarHeight}px` }"
     @pointerdown="pointerDown" @pointermove="pointerMove" @pointerleave="pointerLeave" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @click.capture="preventSwipeClick" @dragstart.prevent>
    <div ref="track" class="calendar-track">
    <div v-for="panel in panels" :key="panel.direction" class="days calendar-panel" :aria-hidden="panel.direction !== 0 ? true : undefined" :inert="panel.direction !== 0">
     <span v-for="(day, index) in panel.days" :key="day ? dateKey(day) : `blank-${index}`" :class="{ written: day && entryOn(day) }">
      <template v-if="day">
       <RouterLink v-if="entryOn(day)" :to="`/entry/${entryOn(day)!.id}`" :aria-label="`${dateKey(day)}の日記`" :aria-current="dateKey(day) === dateKey(new Date()) ? 'date' : undefined">{{ day.getDate() }}<i></i></RouterLink>
       <RouterLink v-else-if="dateKey(day) <= dateKey(new Date())" :to="{path:'/journal',query:{date:dateKey(day)}}" :aria-label="`${dateKey(day)}の日記を書く`" :aria-current="dateKey(day) === dateKey(new Date()) ? 'date' : undefined">{{day.getDate()}}</RouterLink>
       <b v-else :aria-label="dateKey(day)" :aria-current="dateKey(day) === dateKey(new Date()) ? 'date' : undefined">{{ day.getDate() }}</b>
      </template>
     </span>
    </div>
    </div>
    </div>
    </div>
    <button type="button" class="calendar-handle" :aria-label="mode === 'week' ? '月全体を表示' : '1週間を表示'" :title="mode === 'week' ? '月全体を表示' : '1週間を表示'" :aria-expanded="mode === 'month'" aria-controls="records-calendar-content" @click="toggleCalendar"><span aria-hidden="true"></span></button>
   </section>
  </header>
  <section class="recent-list" aria-label="日記の一覧">
   <h2 class="records-list-title">これまでの記録</h2>
   <p v-if="!entries.length" class="soft-card">まだ日記がありません。日記を書くと、ここに表示されます。</p>
   <RouterLink v-for="e in entries" :key="e.id" :to="`/entry/${e.id}`" class="entry-row" :class="{ 'has-photo': e.thumbnailImageId }"><div v-if="e.thumbnailImageId" class="entry-photo"><EntryThumbnail :id="e.thumbnailImageId"/></div><div class="entry-icon" v-if="!e.thumbnailImageId"><AppIcon :name="['moon','leaf','sun','cloud','leaf'][e.mood-1]" /></div><div class="entry-content"><small>{{new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(e.date+'T12:00'))}}</small><h3>{{e.guess.trim() || '無題の日記'}}</h3><p v-if="e.tags.length"><span v-for="t in e.tags" :key="t">#{{t}} </span></p></div><b><AppIcon name="chevron-right" /></b><div v-if="e.environment?.weather || e.environment?.place" class="entry-environment"><span v-if="e.environment?.weather" class="entry-weather"><AppIcon :name="e.environment.weather.code < 3 ? 'sun' : 'cloud'" /><span>{{ weatherLabel(e.environment.weather.code) }} <span class="high" aria-label="最高気温">↑{{ Math.round(e.environment.weather.high) }}°</span> <span class="low" aria-label="最低気温">↓{{ Math.round(e.environment.weather.low) }}°</span></span></span><span v-if="e.environment?.place" class="entry-place"><AppIcon name="pin" /><span>{{ e.environment.place }}</span></span></div></RouterLink>
  </section>
 </div>
</template>

<style scoped>
.calendar-handle{display:flex;align-items:center;justify-content:center;width:100%;height:20px;margin:4px auto 0;padding:8px 12px;border:0;border-radius:12px;background:transparent;cursor:pointer}
.calendar-handle span{width:32px;height:4px;flex-shrink:0;border-radius:999px;background:var(--sage)}
.calendar-handle:hover{background:rgba(255,255,255,.3)}
.calendar-handle:focus-visible{outline:2px solid var(--forest);outline-offset:2px}
/* Clipping must not create a separate scroll container for the sticky header. */
:global(.app-shell:has(.records-page)) { overflow: clip; }
.records-header { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 15; padding-bottom: 4px; box-shadow: 0 6px 14px rgba(32,50,44,.06); }
.entry-environment { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 12px; padding-top: 8px; border-top: 1px solid var(--line); font-size: .7rem; line-height: 1.5; color: var(--sub); }
.entry-row.has-photo .entry-environment { margin: 0 14px 14px; }
.entry-weather, .entry-place { flex: 1; }
.entry-weather, .entry-place { display: flex; align-items: flex-start; gap: 5px; min-width: 0; }
.entry-environment :deep(.app-icon) { flex-shrink: 0; width: 15px; height: 15px; margin-top: 1px; }
.entry-environment span { overflow-wrap: anywhere; }
.entry-weather .high { color: #a35b49; }
.entry-weather .low { color: #407995; }
.records-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.days a:focus-visible, .month-nav button:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
.records-calendar { border-top: 1px solid rgba(82,110,101,.16); padding-top: 8px; }
.month-nav h2 { font-size: .95rem; text-align: center; }
.month-nav button { flex-shrink: 0; }
.calendar-days { touch-action: pan-y pinch-zoom; user-select: none; cursor: grab; overflow: hidden; transition: height 300ms cubic-bezier(.22, 1, .36, 1); }
.calendar-days.dragging { cursor: grabbing; }
.calendar-track { transform: translate3d(-100%, 0, 0); will-change: transform; display: flex; width: 100%; align-items: flex-start; }
.calendar-panel { flex: 0 0 100%; min-width: 0; }
.days > span { height: 48px; }
:global(.reduce-motion) .calendar-days { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .calendar-days { transition: none; }
}
.days a, .days b { width: 42px; height: 42px; }
.days .written a{background:var(--forest);color:white;border-radius:50%}
.days .written i{background:rgba(255,255,255,.8)}
.days [aria-current="date"] { outline: 1px solid var(--sage); outline-offset: -2px; }
.records-list-title { margin: 0 0 4px; font-size: 1rem; }
.entry-row { grid-template-columns: 64px minmax(0, 1fr) 12px; }
.entry-row > div { min-width: 0; }
.entry-row p { overflow-wrap: anywhere; }
.entry-row.has-photo { grid-template-columns: minmax(0, 1fr) 12px; row-gap: 8px; padding: 0; overflow: hidden; }
.entry-photo { grid-column: 1 / -1; width: 100%; aspect-ratio: 16 / 9; background: var(--mist); overflow: hidden; }
.entry-photo :deep(.entry-thumb) { display: block; width: 100%; height: 100%; border-radius: 0; object-fit: cover; }
.entry-photo :deep(span.entry-thumb) { display: grid; place-items: center; font-size: .8rem; color: var(--sub); }
.entry-row.has-photo .entry-content { margin-left: 14px; margin-bottom: 8px; }
.entry-row h3 { margin: 2px 0; }
.entry-row.has-photo > b { margin-right: 14px; justify-self: end; }
</style>
