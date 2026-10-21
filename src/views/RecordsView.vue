<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EntryThumbnail from '../components/EntryThumbnail.vue'
import { weatherLabel } from '../lib/diary-weather'
import { entries, settings } from '../stores/diary'
import { swipeDirection } from '../lib/calendar-swipe'
import { calendarDays, dateKey, moveCalendar } from '../lib/records-calendar'

const mode = 'month' as const
const calendarDialog = ref<HTMLDialogElement>()
const calendarOpen = ref(false)
const calendarClosing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
let previousOverflow: string | undefined
function openCalendar() {
 if (!calendarDialog.value || calendarOpen.value) return
 resetGesture()
 calendarDialog.value.showModal()
 calendarOpen.value = true
 previousOverflow = document.body.style.overflow
 document.body.style.overflow = 'hidden'
}
function closeCalendar() {
 if (!calendarDialog.value?.open || calendarClosing.value) return
 resetGesture()
 if (settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  calendarDialog.value.close()
  return
 }
 calendarClosing.value = true
 closeTimer = setTimeout(() => calendarDialog.value?.close(), 200)
}
function calendarClosed() {
 clearTimeout(closeTimer)
 calendarClosing.value = false
 calendarOpen.value = false
 resetGesture()
 if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
 previousOverflow = undefined
}
function closeOnDate(event: MouseEvent) {
 if (event.target instanceof Element && event.target.closest('a') && !event.defaultPrevented) closeCalendar()
}
function backdropClick(event: MouseEvent) {
 if (event.target !== calendarDialog.value) return
 const bounds = calendarDialog.value.getBoundingClientRect()
 if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeCalendar()
}
const anchor = ref(new Date())
const cells = computed(() => calendarDays(anchor.value, mode))
const entriesByDate = computed(() => new Map(entries.value.map(entry => [entry.date, entry])))
const monthFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' })
const title = computed(() => monthFormat.format(anchor.value))
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
 days: calendarDays(direction ? moveCalendar(anchor.value, mode, direction) : anchor.value, mode),
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
 if (direction) anchor.value = moveCalendar(anchor.value, mode, direction)
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
onBeforeUnmount(() => { clearTimeout(closeTimer); calendarDialog.value?.close(); calendarClosed() })
function entryOn(day: Date) { return entriesByDate.value.get(dateKey(day)) }
</script>

<template>
 <div class="page records-page">
  <header class="page-header records-header">
   <p class="eyebrow">YOUR MOMENTS</p>
   <div class="records-heading">
    <h1>記録</h1>
    <button class="calendar-switch" type="button" aria-label="カレンダーを開く" title="カレンダーを開く" aria-haspopup="dialog" :aria-expanded="calendarOpen" aria-controls="records-calendar-dialog" @click="openCalendar"><AppIcon name="calendar-month" /></button>
   </div>


  </header>
  <Teleport to="body">
   <dialog id="records-calendar-dialog" ref="calendarDialog" class="calendar-dialog" :class="{ 'without-animation': settings.reducedMotion, closing: calendarClosing }" aria-labelledby="calendar-dialog-title" @cancel.prevent="closeCalendar" @close="calendarClosed" @click="backdropClick">
    <div class="calendar-dialog-heading"><h2 id="calendar-dialog-title">カレンダー</h2><button type="button" class="calendar-switch" aria-label="カレンダーを閉じる" @click="closeCalendar"><AppIcon name="close" /></button></div>
   <section class="records-calendar" aria-label="記録カレンダー" @click="closeOnDate">
    <div id="records-calendar-content">
    <div class="month-nav">
     <button type="button" aria-label="前の月" @click="move(-1)"><AppIcon name="chevron-left" /></button>
     <h2 aria-live="polite">{{ title }}</h2>
     <button type="button" aria-label="次の月" @click="move(1)"><AppIcon name="chevron-right" /></button>
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
   </section>
   </dialog>
  </Teleport>
  <section class="recent-list" aria-label="日記の一覧">
   <p v-if="!entries.length" class="soft-card">まだ日記がありません。日記を書くと、ここに表示されます。</p>
   <RouterLink v-for="e in entries" :key="e.id" :to="`/entry/${e.id}`" class="entry-row" :class="{ 'has-photo': e.thumbnailImageId }"><div v-if="e.thumbnailImageId" class="entry-photo"><EntryThumbnail :id="e.thumbnailImageId"/></div><div class="entry-icon" v-if="!e.thumbnailImageId"><AppIcon :name="['moon','leaf','sun','cloud','leaf'][e.mood-1]" /></div><div class="entry-content"><small>{{new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(e.date+'T12:00'))}}</small><h3>{{e.guess.trim() || '無題の日記'}}</h3><p v-if="e.tags.length"><span v-for="t in e.tags" :key="t">#{{t}} </span></p></div><b><AppIcon name="chevron-right" /></b><div v-if="e.environment?.weather || e.environment?.place" class="entry-environment"><span v-if="e.environment?.weather" class="entry-weather"><AppIcon :name="e.environment.weather.code < 3 ? 'sun' : 'cloud'" /><span>{{ weatherLabel(e.environment.weather.code) }} <span class="high" aria-label="最高気温">↑{{ Math.round(e.environment.weather.high) }}°</span> <span class="low" aria-label="最低気温">↓{{ Math.round(e.environment.weather.low) }}°</span></span></span><span v-if="e.environment?.place" class="entry-place"><AppIcon name="pin" /><span>{{ e.environment.place }}</span></span></div></RouterLink>
  </section>
 </div>
</template>

<style scoped>
.calendar-dialog { width: min(430px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); padding: 18px; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); overflow-y: auto; }
.calendar-dialog::backdrop { background: rgba(14,24,20,.45); }
.calendar-dialog[open] { animation: calendar-appear 240ms cubic-bezier(.2,.7,.3,1); }
.calendar-dialog[open]::backdrop { animation: calendar-backdrop-appear 240ms ease-out; }
.calendar-dialog[open].closing { animation: calendar-disappear 200ms ease-in forwards; pointer-events: none; }
.calendar-dialog[open].closing::backdrop { animation: calendar-backdrop-disappear 200ms ease-in forwards; }
@keyframes calendar-disappear { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes calendar-backdrop-disappear { from { opacity: 1; } to { opacity: 0; } }
@keyframes calendar-appear { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes calendar-backdrop-appear { from { opacity: 0; } to { opacity: 1; } }
.calendar-dialog.without-animation[open], .calendar-dialog.without-animation[open]::backdrop { animation: none; }
@media (prefers-reduced-motion: reduce) { .calendar-dialog[open], .calendar-dialog[open]::backdrop { animation: none; } }

.calendar-dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.calendar-dialog-heading h2 { margin: 0; font-size: 1.1rem; }

.calendar-switch { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,.65); color: var(--forest); cursor: pointer; }
.calendar-switch :deep(.app-icon) { width: 22px; height: 22px; }
.calendar-switch:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
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
.week > span:first-child,
.days > span:nth-child(7n + 1) a,
.days > span:nth-child(7n + 1) b { color: #b34d48; }
.week > span:last-child,
.days > span:nth-child(7n) a,
.days > span:nth-child(7n) b { color: #3477ad; }
.days > span.written:nth-child(7n + 1) a { background: #f9e9e7; }
.days > span.written:nth-child(7n + 1) i { background: #b34d48; }
.days > span.written:nth-child(7n) a { background: #e6eff9; }
.days > span.written:nth-child(7n) i { background: #3477ad; }
.days [aria-current="date"] { outline: 1px solid var(--sage); outline-offset: -2px; }
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
