<script setup lang="ts">
import AppIcon from "../components/AppIcon.vue"
import EntryThumbnail from '../components/EntryThumbnail.vue'

import { computed } from 'vue';import { entries, todaysEntry } from '../stores/diary'
const todayImage = computed(() => todaysEntry.value?.thumbnailImageId || todaysEntry.value?.imageIds[0])
const now=new Date();const hour=now.getHours();const greeting=hour<11?'おはようございます':hour<18?'こんにちは':'こんばんは';const date=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(now)
const rate=computed(()=>Math.round(entries.value.filter(e=>(Date.now()-new Date(e.date).getTime())<28*86400000).length/28*100))
</script>
<template><div class="page home-page">
 <header class="home-hero"><RouterLink to="/settings" class="home-settings-link"><AppIcon name="settings" /> 設定</RouterLink><p class="eyebrow">{{date}}</p><h1>{{greeting}}</h1><p>今日の心に、静かな居場所を。</p></header>
 <section class="today-card">
  <div class="today-note">
   <p class="eyebrow">TODAY'S NOTE</p>
   <template v-if="todaysEntry">
    <div v-if="todayImage" class="today-photo"><EntryThumbnail :id="todayImage" alt="今日の日記の代表写真" /><span v-if="todaysEntry.imageIds.length > 1" class="today-photo-count"><AppIcon name="image" />{{ todaysEntry.imageIds.length }}枚</span></div>
    <h2 class="today-title">{{ todaysEntry.guess || '今日の日記' }}</h2>
    <div v-if="todaysEntry.tags.length" class="today-tags"><span v-for="tag in todaysEntry.tags" :key="tag"># {{ tag }}</span></div>
   </template>
   <template v-else><span class="leaf">⌁</span><h2>今日はどんな一日でしたか？</h2><p>今日のできごとや気持ちを、自由に残せます。</p></template>
  </div>
  <RouterLink class="primary-button" :to="todaysEntry?`/entry/${todaysEntry.id}`:'/journal'">{{todaysEntry?'日記を見る':'今日を残す'}} <span><AppIcon name="arrow-right" /></span></RouterLink>
 </section>
 <section><div class="section-heading"><div><p class="eyebrow">YOUR RHYTHM</p><h2>あなたのペース</h2></div><strong>{{rate}}<small>%</small></strong></div><div class="soft-card rhythm"><div class="ring" :style="{'--p':rate+'%'}"><span>{{rate}}%</span></div><div><h3>直近4週間の日記作成率</h3><p>書けない日があっても大丈夫。戻ってきた日が、少しずつ積み重なっています。</p></div></div></section>
</div></template>

<style scoped>
.today-note{min-width:0}
.today-photo{position:relative;margin:16px 0;overflow:hidden;border-radius:18px;background:var(--mist);aspect-ratio:16/9}
.today-photo :deep(.entry-thumb){display:block;width:100%;height:100%;object-fit:cover}
.today-photo :deep(span.entry-thumb){display:grid;place-items:center;color:var(--sub);font-size:.8rem}
.today-photo-count{position:absolute;right:10px;bottom:10px;display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:10px;background:rgba(255,255,255,.9);color:var(--forest);font-size:.7rem}
.today-photo-count :deep(.app-icon){width:15px;height:15px}
.today-title{overflow-wrap:anywhere;line-height:1.6;max-height:3.2em;overflow:hidden}
.today-tags{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:12px;color:var(--forest);font-size:.72rem}

.home-settings-link{position:absolute;top:12px;right:var(--page-right);z-index:1;display:flex;align-items:center;gap:6px;min-height:40px;padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.8);color:var(--forest);font-size:.8rem;text-decoration:none}
.home-settings-link:hover{background:white}
.home-settings-link:focus-visible{outline:2px solid var(--forest);outline-offset:3px}
</style>
