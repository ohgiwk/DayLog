<script setup lang="ts">
import AppIcon from "../components/AppIcon.vue"

import { computed } from 'vue';import { entries, todaysEntry } from '../stores/diary';import EntryThumbnail from '../components/EntryThumbnail.vue'
const now=new Date();const hour=now.getHours();const greeting=hour<11?'おはようございます':hour<18?'こんにちは':'こんばんは';const date=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(now)
const recent=computed(()=>entries.value.slice(0,3));const rate=computed(()=>Math.round(entries.value.filter(e=>(Date.now()-new Date(e.date).getTime())<28*86400000).length/28*100))
</script>
<template><div class="page home-page">
 <header class="home-hero"><div class="mist"></div><RouterLink to="/settings" class="home-settings-link"><AppIcon name="settings" /> 設定</RouterLink><p class="eyebrow">{{date}}</p><h1>{{greeting}}</h1><p>今日の心に、静かな居場所を。</p><div class="ripple r1"></div><div class="ripple r2"></div></header>
 <section class="today-card"><div><span class="leaf">⌁</span><p class="eyebrow">TODAY'S NOTE</p><h2>{{todaysEntry?'今日の記録があります':'今日はどんな一日でしたか？'}}</h2><p>{{todaysEntry?'あとから何度でも、そっと書き足せます。':'いくつかの質問から、一日をたどります。'}}</p></div><RouterLink class="primary-button" :to="todaysEntry?`/entry/${todaysEntry.id}`:'/journal'">{{todaysEntry?'記録を見る':'今日を残す'}} <span><AppIcon name="arrow-right" /></span></RouterLink></section>
 <section><div class="section-heading"><div><p class="eyebrow">YOUR RHYTHM</p><h2>あなたのペース</h2></div><strong>{{rate}}<small>%</small></strong></div><div class="soft-card rhythm"><div class="ring" :style="{'--p':rate+'%'}"><span>{{rate}}%</span></div><div><h3>直近4週間の記録率</h3><p>書けない日があっても大丈夫。戻ってきた日が、少しずつ積み重なっています。</p></div></div></section>
 <section v-if="recent.length"><div class="section-heading"><h2>最近の記録</h2><RouterLink to="/records">すべて見る</RouterLink></div><div class="recent-list"><RouterLink v-for="e in recent" :key="e.id" :to="`/entry/${e.id}`" class="entry-row"><EntryThumbnail :id="e.thumbnailImageId"/><div class="entry-icon" v-if="!e.thumbnailImageId"><AppIcon :name="['moon','leaf','sun','cloud','leaf'][e.mood-1]" /></div><div><small>{{new Intl.DateTimeFormat('ja-JP',{month:'short',day:'numeric',weekday:'short'}).format(new Date(e.date+'T12:00'))}}</small><h3>{{e.body}}</h3><p><span v-for="t in e.tags.slice(0,2)" :key="t">#{{t}} </span></p></div><b><AppIcon name="chevron-right" /></b></RouterLink></div></section>
</div></template>

<style scoped>
.home-settings-link{position:absolute;top:12px;right:22px;z-index:1;display:flex;align-items:center;gap:6px;min-height:40px;padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.8);color:var(--forest);font-size:.8rem;text-decoration:none}
.home-settings-link:hover{background:white}
.home-settings-link:focus-visible{outline:2px solid var(--forest);outline-offset:3px}
</style>
