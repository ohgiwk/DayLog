<script setup lang="ts">
import { useStaggeredReveal } from '../lib/staggered-reveal';
import { createDialogMotion } from '../lib/dialog-motion';
import { useTemplateRef, computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { readRichText } from '../lib/rich-text';
import AppIcon from '../components/AppIcon.vue';
import EntryThumbnail from '../components/EntryThumbnail.vue';
import { weatherLabel } from '../lib/diary-weather';
import { filterRecords } from '../lib/records-search';
import { entries, settings } from '../stores/diary';
import { swipeDirection } from '../lib/calendar-swipe';
import { calendarDays, dateKey, moveCalendar } from '../lib/records-calendar';

const weekdayFormat = new Intl.DateTimeFormat('ja-JP', { weekday: 'long' });
const vReveal = useStaggeredReveal(() => settings.reducedMotion);
const searchText = ref(''),
  selectedTag = ref('');
const searchDialog = useTemplateRef('searchDialog');
const searchButton = useTemplateRef('searchButton');
const searchMotion = createDialogMotion();
function openSearch() {
  searchMotion.open(searchDialog.value);
}
async function closeSearch() {
  if (await searchMotion.close(searchDialog.value)) searchButton.value?.focus();
}
const availableTags = computed(() =>
  [...new Set(entries.value.flatMap((entry) => entry.tags))].sort((a, b) =>
    a.localeCompare(b, 'ja'),
  ),
);
const filteredEntries = computed(() =>
  filterRecords(entries.value, searchText.value, selectedTag.value),
);
function clearSearch() {
  searchText.value = '';
  selectedTag.value = '';
}
const mode = 'month' as const;
const calendarOpen = ref(false);
const calendarButton = useTemplateRef('calendarButton');
function toggleCalendar() {
  resetGesture();
  calendarOpen.value = !calendarOpen.value;
}
function closeCalendar() {
  resetGesture();
  calendarOpen.value = false;
}
function closeOnDate(event: MouseEvent) {
  if (
    event.target instanceof Element &&
    event.target.closest('a') &&
    !event.defaultPrevented
  )
    closeCalendar();
}
function escapeCalendar() {
  closeCalendar();
  calendarButton.value?.focus();
}
const anchor = ref(new Date());
const cells = computed(() => calendarDays(anchor.value, mode));
const entriesByDate = computed(
  () => new Map(entries.value.map((entry) => [entry.date, entry])),
);
const monthFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
});
const title = computed(() => monthFormat.format(anchor.value));
const viewport = useTemplateRef('viewport');
const track = useTemplateRef('track');
const dragging = ref(false),
  settling = ref(false);
let offset = 0;
let samples: { x: number; time: number }[] = [];
function setOffset(value: number) {
  offset = value;
  if (track.value)
    track.value.style.transform = `translate3d(calc(-100% + ${value}px), 0, 0)`;
}
const panels = computed(() =>
  [-1, 0, 1].map((direction) => ({
    direction,
    days: calendarDays(
      direction ? moveCalendar(anchor.value, mode, direction) : anchor.value,
      mode,
    ),
  })),
);
const calendarHeight = computed(
  () =>
    ((dragging.value || settling.value
      ? Math.max(...panels.value.map((panel) => panel.days.length))
      : cells.value.length) /
      7) *
    48,
);
let pointer: number | null = null,
  startX = 0,
  startY = 0,
  suppressClickUntil = 0;
let animation: Animation | undefined;
let generation = 0;
function resetGesture() {
  generation++;
  animation?.cancel();
  animation = undefined;
  const previous = pointer;
  pointer = null;
  if (previous !== null && viewport.value?.hasPointerCapture(previous))
    viewport.value.releasePointerCapture(previous);
  dragging.value = false;
  settling.value = false;
  setOffset(0);
}
async function move(direction: number) {
  if (settling.value) return;
  const width = viewport.value?.clientWidth || 0;
  if (!track.value || !width) return;
  const token = generation;
  settling.value = true;
  dragging.value = false;
  const reduced =
    settings.reducedMotion ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effect = track.value.animate(
    [
      { transform: `translate3d(calc(-100% + ${offset}px), 0, 0)` },
      { transform: `translate3d(calc(-100% + ${-direction * width}px), 0, 0)` },
    ],
    {
      duration: reduced ? 0 : 260,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'forwards',
    },
  );
  animation = effect;
  try {
    await effect.finished;
  } catch {
    return;
  }
  if (token !== generation) return;
  if (direction) anchor.value = moveCalendar(anchor.value, mode, direction);
  setOffset(0);
  await nextTick();
  effect.cancel();
  animation = undefined;
  settling.value = false;
}
function pointerDown(event: PointerEvent) {
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    settling.value ||
    pointer !== null
  )
    return;
  pointer = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  samples = [{ x: startX, time: event.timeStamp }];
}
function pointerMove(event: PointerEvent) {
  if (pointer !== event.pointerId || settling.value) return;
  const dx = event.clientX - startX,
    dy = event.clientY - startY;
  if (!dragging.value) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
    if (Math.abs(dy) > Math.abs(dx) * 1.3) {
      pointer = null;
      return;
    }
    if (Math.abs(dx) <= Math.abs(dy)) return;
    dragging.value = true;
    viewport.value?.setPointerCapture(event.pointerId);
  }
  const width = viewport.value?.clientWidth || 0;
  setOffset(Math.max(-width, Math.min(width, dx)));
  samples.push({ x: event.clientX, time: event.timeStamp });
  samples = samples.filter((sample) => event.timeStamp - sample.time <= 100);
  event.preventDefault();
}
function pointerLeave() {
  if (!dragging.value) pointer = null;
}
function pointerEnd(event: PointerEvent) {
  // Touch pointers initially belong to the tapped child. Its capture loss is not a cancelled swipe.
  if (event.type === 'lostpointercapture' && event.target !== viewport.value)
    return;
  if (pointer !== event.pointerId) return;
  pointer = null;
  if (!dragging.value) return;
  suppressClickUntil = Date.now() + 400;
  const sample = samples.find((value) => event.timeStamp - value.time <= 120);
  const elapsed = sample ? event.timeStamp - sample.time : 0;
  const velocity =
    sample && elapsed > 0 ? (event.clientX - sample.x) / elapsed : 0;
  const direction =
    event.type !== 'pointerup'
      ? 0
      : swipeDirection(offset, viewport.value?.clientWidth || 0, velocity);
  void move(direction);
}
function preventSwipeClick(event: MouseEvent) {
  if (Date.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
  }
}
onBeforeUnmount(() => {
  resetGesture();
  searchMotion.dispose();
});
function entryOn(day: Date) {
  return entriesByDate.value.get(dateKey(day));
}
</script>

<template>
  <div class="page records-page">
    <header class="page-header records-header">
      <div class="records-heading">
        <h1>DayLog</h1>
        <div class="records-header-actions">
          <button
            ref="calendarButton"
            class="calendar-switch"
            :class="{ active: calendarOpen }"
            type="button"
            :aria-label="
              calendarOpen ? 'カレンダーを閉じる' : 'カレンダーを開く'
            "
            :title="calendarOpen ? 'カレンダーを閉じる' : 'カレンダーを開く'"
            :aria-expanded="calendarOpen"
            aria-controls="records-calendar-panel"
            @click="toggleCalendar"
            ><AppIcon name="calendar-month"
          /></button>
          <button
            ref="searchButton"
            type="button"
            class="search-toggle"
            :class="{ active: searchText || selectedTag }"
            aria-label="検索・絞り込みを開く"
            title="検索・絞り込み"
            aria-haspopup="dialog"
            @click="openSearch"
            ><AppIcon name="search"
          /></button>
        </div>
      </div>
      <div
        id="records-calendar-panel"
        class="calendar-reveal"
        :class="{
          open: calendarOpen,
          'without-animation': settings.reducedMotion,
        }"
        :inert="!calendarOpen"
        :aria-hidden="!calendarOpen"
        @keydown.esc.stop.prevent="escapeCalendar"
      >
        <div class="calendar-reveal-inner">
          <section
            class="records-calendar"
            aria-label="記録カレンダー"
            @click="closeOnDate"
          >
            <div id="records-calendar-content">
              <div class="month-nav">
                <button type="button" aria-label="前の月" @click="move(-1)"
                  ><AppIcon name="chevron-left"
                /></button>
                <h2 aria-live="polite">{{ title }}</h2>
                <button type="button" aria-label="次の月" @click="move(1)"
                  ><AppIcon name="chevron-right"
                /></button>
              </div>
              <div class="week" aria-hidden="true"
                ><span
                  v-for="day in ['日', '月', '火', '水', '木', '金', '土']"
                  :key="day"
                  >{{ day }}</span
                ></div
              >
              <div
                ref="viewport"
                class="calendar-days"
                :class="{ dragging }"
                :style="{ height: `${calendarHeight}px` }"
                @pointerdown="pointerDown"
                @pointermove="pointerMove"
                @pointerleave="pointerLeave"
                @pointerup="pointerEnd"
                @pointercancel="pointerEnd"
                @lostpointercapture="pointerEnd"
                @click.capture="preventSwipeClick"
                @dragstart.prevent
              >
                <div ref="track" class="calendar-track">
                  <div
                    v-for="panel in panels"
                    :key="panel.direction"
                    class="days calendar-panel"
                    :aria-hidden="panel.direction !== 0 ? true : undefined"
                    :inert="panel.direction !== 0"
                  >
                    <span
                      v-for="(day, index) in panel.days"
                      :key="day ? dateKey(day) : `blank-${index}`"
                      :class="{ written: day && entryOn(day) }"
                    >
                      <template v-if="day">
                        <RouterLink
                          v-if="entryOn(day)"
                          :to="`/entry/${entryOn(day)!.id}`"
                          :aria-label="`${dateKey(day)}の日記`"
                          :aria-current="
                            dateKey(day) === dateKey(new Date())
                              ? 'date'
                              : undefined
                          "
                          >{{ day.getDate() }}<i></i
                        ></RouterLink>
                        <RouterLink
                          v-else-if="dateKey(day) <= dateKey(new Date())"
                          :to="{
                            path: '/journal',
                            query: { date: dateKey(day) },
                          }"
                          :aria-label="`${dateKey(day)}の日記を書く`"
                          :aria-current="
                            dateKey(day) === dateKey(new Date())
                              ? 'date'
                              : undefined
                          "
                          >{{ day.getDate() }}</RouterLink
                        >
                        <b
                          v-else
                          :aria-label="dateKey(day)"
                          :aria-current="
                            dateKey(day) === dateKey(new Date())
                              ? 'date'
                              : undefined
                          "
                          >{{ day.getDate() }}</b
                        >
                      </template>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </header>
    <section class="records-search" aria-label="日記を検索">
      <Teleport to="body">
        <dialog
          ref="searchDialog"
          class="records-search-dialog"
          aria-labelledby="records-search-title"
          @cancel.prevent="closeSearch"
          @click="$event.target === searchDialog && closeSearch()"
        >
          <div class="search-dialog-heading"
            ><h2 id="records-search-title"
              ><AppIcon name="search" />検索・絞り込み</h2
            ><button
              type="button"
              class="search-dialog-close"
              aria-label="検索・絞り込みを閉じる"
              @click="closeSearch"
              >×</button
            ></div
          >
          <div class="search-controls">
            <label
              >テキスト検索<input
                v-model="searchText"
                type="search"
                placeholder="タイトル・本文・場所など"
            /></label>
            <div
              v-if="availableTags.length"
              class="tag-filter"
              role="group"
              aria-label="タグで絞り込み"
            >
              <p>タグで絞り込み</p>
              <div class="tag-filter-buttons">
                <button
                  type="button"
                  :aria-pressed="selectedTag === ''"
                  @click="selectedTag = ''"
                  >すべて</button
                >
                <button
                  v-for="tag in availableTags"
                  :key="tag"
                  type="button"
                  :aria-pressed="selectedTag === tag"
                  @click="selectedTag = selectedTag === tag ? '' : tag"
                  ># {{ tag }}</button
                >
              </div>
            </div>
          </div>
          <div class="search-summary"
            ><span role="status">{{ filteredEntries.length }}件の日記</span
            ><button
              v-if="searchText || selectedTag"
              type="button"
              @click="clearSearch"
              >検索をクリア</button
            ></div
          >
          <button type="button" class="primary-button full" @click="closeSearch"
            >検索結果を表示</button
          >
        </dialog>
      </Teleport>
      <div class="search-summary"
        ><span role="status">{{ filteredEntries.length }}件の日記</span
        ><button
          v-if="searchText || selectedTag"
          type="button"
          @click="clearSearch"
          >検索をクリア</button
        ></div
      >
    </section>
    <section class="recent-list" aria-label="日記の一覧">
      <p v-if="!entries.length" class="soft-card"
        >まだ日記がありません。日記を書くと、ここに表示されます。</p
      >
      <p v-if="entries.length && !filteredEntries.length" class="soft-card"
        >条件に一致する日記がありません。検索条件を変えてお試しください。</p
      >
      <RouterLink
        v-for="e in filteredEntries"
        v-reveal
        :key="e.id"
        :to="`/entry/${e.id}`"
        class="entry-row"
        :class="{ 'has-photo': e.thumbnailImageId || e.imageIds[0] }"
        ><time class="timeline-date" :datetime="e.date"
          ><small>{{ Number(e.date.slice(5, 7)) }}月</small
          ><strong>{{ Number(e.date.slice(8, 10)) }}</strong
          ><span>{{
            weekdayFormat.format(new Date(e.date + 'T12:00'))
          }}</span></time
        ><div v-if="e.thumbnailImageId || e.imageIds[0]" class="entry-photo"
          ><EntryThumbnail
            :id="e.thumbnailImageId || e.imageIds[0]"
            alt="日記の代表写真" /></div
        ><div class="entry-content"
          ><h3>{{ e.guess.trim() || '無題の日記' }}</h3
          ><p class="entry-excerpt">{{ readRichText(e.body).text }}</p
          ><p v-if="e.tags.length"
            ><span v-for="t in e.tags" :key="t">#{{ t }} </span></p
          ></div
        ><div
          v-if="e.environment?.weather || e.environment?.place"
          class="entry-environment"
          ><span v-if="e.environment?.weather" class="entry-weather"
            ><AppIcon
              :name="e.environment.weather.code < 3 ? 'sun' : 'cloud'"
            /><span
              >{{ weatherLabel(e.environment.weather.code) }}
              <span class="high" aria-label="最高気温"
                >↑{{ Math.round(e.environment.weather.high) }}°</span
              >
              <span class="low" aria-label="最低気温"
                >↓{{ Math.round(e.environment.weather.low) }}°</span
              ></span
            ></span
          ><span v-if="e.environment?.place" class="entry-place"
            ><AppIcon name="pin" /><span>{{ e.environment.place }}</span></span
          ></div
        ></RouterLink
      >
    </section>
  </div>
</template>

<style scoped>
.records-search-dialog {
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 22px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 12px 36px rgba(31, 61, 50, 0.2);
}
.records-search-dialog::backdrop {
  background: rgba(25, 45, 39, 0.4);
  backdrop-filter: blur(4px);
}
.search-dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.search-dialog-heading h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.05rem;
}
.search-dialog-close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sub);
  font-size: 1.4rem;
  cursor: pointer;
}
.records-search-dialog label {
  display: grid;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--sub);
}
.records-search-dialog input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 16px;
}
.records-search-dialog :is(input, button):focus-visible,
.search-toggle:focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}
.search-controls {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}

.tag-filter p {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: var(--sub);
}
.tag-filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-filter-buttons button {
  max-width: 100%;
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  color: var(--forest);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.tag-filter-buttons button[aria-pressed='true'] {
  border-color: var(--forest);
  background: var(--forest);
  color: white;
}
.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--sub);
}
.search-summary button {
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--forest);
  cursor: pointer;
}
.records-search :is(input, button):focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}

.calendar-reveal {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 280ms cubic-bezier(0.2, 0.7, 0.3, 1),
    opacity 180ms ease;
}
.calendar-reveal.open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.calendar-reveal-inner {
  min-height: 0;
  overflow: hidden;
}
.calendar-reveal .records-calendar {
  margin-top: 12px;
  padding-bottom: 12px;
  transform: translateY(-16px);
  transition: transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
.calendar-reveal.open .records-calendar {
  transform: translateY(0);
}
.calendar-switch.active,
.search-toggle.active {
  background: var(--forest);
  color: white;
  border-color: var(--forest);
}
.calendar-reveal.without-animation,
.calendar-reveal.without-animation .records-calendar {
  transition: none;
}
:global(.reduce-motion) .calendar-reveal,
:global(.reduce-motion) .calendar-reveal .records-calendar {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .calendar-reveal,
  .calendar-reveal .records-calendar {
    transition: none;
  }
}

.calendar-switch,
.search-toggle {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  color: var(--forest);
  cursor: pointer;
}
.calendar-switch :deep(.app-icon),
.search-toggle :deep(.app-icon) {
  width: 22px;
  height: 22px;
}
.calendar-switch:focus-visible,
.search-toggle:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 2px;
}
/* Clipping must not create a separate scroll container for the sticky header. */
:global(.app-shell:has(.records-page)) {
  overflow: clip;
}
.entry-environment {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 0.7rem;
  line-height: 1.5;
  color: var(--sub);
}
.entry-weather,
.entry-place {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
}
.entry-environment :deep(.app-icon) {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 1px;
}
.entry-environment span {
  overflow-wrap: anywhere;
}
.entry-weather .high {
  color: #a35b49;
}
.entry-weather .low {
  color: #407995;
}
.records-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.days a:focus-visible,
.month-nav button:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 2px;
}
.records-calendar {
  border-top: 1px solid rgba(82, 110, 101, 0.16);
  padding-top: 8px;
}
.month-nav h2 {
  font-size: 0.95rem;
  text-align: center;
}
.month-nav button {
  flex-shrink: 0;
}
.calendar-days {
  touch-action: pan-y pinch-zoom;
  user-select: none;
  cursor: grab;
  overflow: hidden;
  transition: height 300ms cubic-bezier(0.22, 1, 0.36, 1);
}
.calendar-days.dragging {
  cursor: grabbing;
}
.calendar-track {
  transform: translate3d(-100%, 0, 0);
  will-change: transform;
  display: flex;
  width: 100%;
  align-items: flex-start;
}
.calendar-panel {
  flex: 0 0 100%;
  min-width: 0;
}
.days > span {
  height: 48px;
}
:global(.reduce-motion) .calendar-days {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .calendar-days {
    transition: none;
  }
}
.days a,
.days b {
  width: 42px;
  height: 42px;
}
.days .written a {
  background: var(--forest);
  color: white;
  border-radius: 50%;
}
.days .written i {
  background: rgba(255, 255, 255, 0.8);
}
.week > span:first-child,
.days > span:nth-child(7n + 1) a,
.days > span:nth-child(7n + 1) b {
  color: #b34d48;
}
.week > span:last-child,
.days > span:nth-child(7n) a,
.days > span:nth-child(7n) b {
  color: #3477ad;
}
.days > span.written:nth-child(7n + 1) a {
  background: #f9e9e7;
}
.days > span.written:nth-child(7n + 1) i {
  background: #b34d48;
}
.days > span.written:nth-child(7n) a {
  background: #e6eff9;
}
.days > span.written:nth-child(7n) i {
  background: #3477ad;
}
.days [aria-current='date'] {
  outline: 1px solid var(--sage);
  outline-offset: -2px;
}
.entry-row {
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}
.records-page .entry-row:active {
  background-color: var(--mist);
  border-color: var(--sage);
}
.records-page .entry-row:focus-visible {
  background-color: var(--mist);
  outline: 2px solid var(--forest);
  outline-offset: 3px;
}
:global(.reduce-motion) .entry-row {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .entry-row {
    transition: none;
  }
}
.entry-row > div {
  min-width: 0;
}
.entry-row p {
  overflow-wrap: anywhere;
}
.entry-photo {
  width: 100%;
  background: var(--mist);
  overflow: hidden;
}
.entry-photo :deep(.entry-thumb) {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0;
  object-fit: cover;
}
.entry-photo :deep(span.entry-thumb) {
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  color: var(--sub);
}
.records-header {
  padding-bottom: 4px;
  z-index: 15;
  top: env(safe-area-inset-top, 0px);
  position: sticky;
  padding-top: 0;
  box-shadow: none;
  background: var(--paper);
}
.records-heading h1 {
  font-family: Georgia, 'Yu Mincho', serif;
  color: var(--forest);
  font-size: 2.6rem;
  letter-spacing: -0.04em;
}
.records-header-actions {
  align-items: center;
  display: flex;
  gap: 12px;
}
.records-header .search-toggle {
  border: 0;
  background: none;
  width: 32px;
  padding: 4px;
}
.records-search {
  gap: 12px;
  display: grid;
  margin: 0 0 12px;
}
.recent-list {
  display: grid;
  gap: 18px;
  padding-bottom: 76px;
}
.records-page .entry-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-left: 84px;
  padding: 20px 18px;
  border: 1px solid #eeebe5;
  border-radius: 20px;
  background: #fffefdcc;
  overflow: visible;
  box-shadow: none;
}
.timeline-date {
  position: absolute;
  left: -84px;
  top: 18px;
  width: 54px;
  text-align: center;
  font-family: 'Yu Mincho', serif;
}
.timeline-date small {
  font-size: 0.8rem;
}
.timeline-date strong {
  display: block;
  color: var(--forest);
  font:
    3rem/1.05 Georgia,
    serif;
}
.timeline-date span {
  font-size: 0.7rem;
}
.records-page .entry-row::before {
  content: '';
  position: absolute;
  left: -16px;
  top: -20px;
  bottom: -20px;
  width: 1px;
  background: var(--line);
}
.records-page .entry-row::after {
  content: '';
  position: absolute;
  left: -20px;
  top: 36px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--forest);
  border: 2px solid var(--paper);
}
.records-page .entry-content {
  margin: 0;
  grid-column: 1;
  grid-row: 1;
}
.records-page .entry-row h3 {
  font-family: 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  font-size: 1.13rem;
  line-height: 1.6;
  margin: 0 0 10px;
}
.records-page .entry-excerpt {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.86rem;
  line-height: 1.85;
  color: #555650;
  margin: 0 0 14px;
  white-space: pre-line;
}
.records-page .entry-content p span {
  display: inline-block;
  border-radius: 20px;
  padding: 4px 10px;
  background: var(--mist);
  color: var(--forest);
  font-size: 0.72rem;
}
.records-page .entry-row.has-photo {
  grid-template-columns: minmax(0, 1fr) 39%;
}
.records-page .entry-photo {
  grid-column: 2;
  grid-row: 1;
  aspect-ratio: 1;
  height: clamp(96px, 24vw, 180px);
  max-height: 180px;
  min-height: 0;
  align-self: start;
  border-radius: 14px;
  display: block;
}
.records-page .entry-photo :deep(.entry-thumb) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.records-page .entry-environment {
  grid-column: 1 / -1;
  margin: 0;
  padding-top: 0;
  border: 0;
}
@media (max-width: 460px) {
  .records-heading h1 {
    font-size: 2rem;
  }
}
@media (max-width: 460px) {
  .records-page .entry-row.has-photo {
    grid-template-columns: minmax(0, 1fr) 36%;
    padding: 16px 12px;
    gap: 8px;
  }
  .records-page .entry-photo {
    grid-column: 2;
    grid-row: 1;
    min-height: 0;
    height: clamp(88px, 25vw, 120px);
    max-height: 120px;
  }
  .records-page .entry-row h3 {
    font-size: 1rem;
  }
  .records-page .entry-excerpt {
    font-size: 0.78rem;
  }
}
.entry-row[data-reveal-pending] {
  opacity: 0;
}
:global(.reduce-motion) .entry-row[data-reveal-pending] {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .entry-row[data-reveal-pending] {
    opacity: 1;
  }
}
</style>
