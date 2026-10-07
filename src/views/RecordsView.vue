<script setup lang="ts">
import AppIcon from "../components/AppIcon.vue"

import { computed, ref } from 'vue';import { entries } from '../stores/diary';import EntryThumbnail from '../components/EntryThumbnail.vue'
const mode=ref<'calendar'|'list'>('calendar'),month=ref(new Date());const title=computed(()=>new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long'}).format(month.value));const monthEntries=computed(()=>entries.value.filter(e=>{const d=new Date(e.date+'T12:00');return d.getFullYear()===month.value.getFullYear()&&d.getMonth()===month.value.getMonth()}));const cells=computed(()=>{const y=month.value.getFullYear(),m=month.value.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();return [...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)]});function move(n:number){month.value=new Date(month.value.getFullYear(),month.value.getMonth()+n,1)}function getEntry(day:number){return monthEntries.value.find(e=>Number(e.date.slice(-2))===day)}
</script>
<template><div class="page"><header class="page-header"><p class="eyebrow">YOUR MOMENTS</p><div class="records-heading"><h1>記録</h1><div class="view-toggle" role="group" aria-label="記録の表示方法">
<button type="button" :aria-pressed="mode==='calendar'" aria-label="カレンダー表示" title="カレンダー表示" @click="mode='calendar'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2M7 18h2"/></svg></button>
<button type="button" :aria-pressed="mode==='list'" aria-label="リスト表示" title="リスト表示" @click="mode='list'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/></svg></button>
</div></div><p>書いた日も、休んだ日も。すべてあなたの歩幅です。</p></header>
<section v-if="mode==='calendar'" class="calendar-card"><div class="month-nav"><button aria-label="前の月" @click="move(-1)"><AppIcon name="chevron-left" /></button><h2>{{title}}</h2><button aria-label="次の月" @click="move(1)"><AppIcon name="chevron-right" /></button></div><div class="week"><span v-for="w in ['日','月','火','水','木','金','土']">{{w}}</span></div><div class="days"><span v-for="(d,i) in cells" :key="i" :class="{written:d&&getEntry(d)}"><template v-if="d"><RouterLink v-if="getEntry(d)" :to="`/entry/${getEntry(d)!.id}`">{{d}}<i></i></RouterLink><b v-else>{{d}}</b></template></span></div><div class="calendar-note"><span>● 記録した日</span><span>{{monthEntries.length}}日、言葉を残しました</span></div></section>
<section v-else class="recent-list"><p v-if="!entries.length" class="soft-card">まだ日記がありません。日記を書くと、ここに表示されます。</p><RouterLink v-for="e in entries" :key="e.id" :to="`/entry/${e.id}`" class="entry-row"><EntryThumbnail :id="e.thumbnailImageId"/><div class="entry-icon" v-if="!e.thumbnailImageId"><AppIcon :name="['moon','leaf','sun','cloud','leaf'][e.mood-1]" /></div><div><small>{{new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium'}).format(new Date(e.date+'T12:00'))}}</small><h3>{{e.body}}</h3><p><span v-for="t in e.tags" :key="t">#{{t}} </span></p></div><b><AppIcon name="chevron-right" /></b></RouterLink></section></div></template>

<style scoped>
.records-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.view-toggle { display: inline-flex; flex-shrink: 0; padding: 3px; border: 1px solid var(--line); border-radius: 15px; background: #e8eeea; }
.view-toggle button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 11px; background: transparent; color: var(--sub); cursor: pointer; }
.view-toggle button[aria-pressed="true"] { background: white; color: var(--forest); box-shadow: 0 2px 6px rgba(30,50,40,.1); }
.view-toggle button:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
.view-toggle svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
</style>
