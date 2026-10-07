<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryEntry } from '../types'
import { baseQuestions, activityQuestions } from '../data/questions'
import EntryThumbnail from './EntryThumbnail.vue'
const props = defineProps<{ entry: DiaryEntry | null }>()
const answers = computed(() => [...baseQuestions, ...activityQuestions].flatMap(q => {
 const value = props.entry?.answers[q.id]
 return value ? [{ label: q.prompt, answer: value === 'skip' ? 'スキップ' : q.options.find(o => o.value === value)?.label ?? '以前の回答' }] : []
}))
</script>
<template><div class="comparison"><template v-if="entry"><p><strong>{{ entry.guess }}</strong></p><p class="body">{{ entry.body || '本文なし' }}</p><p>明日：{{ entry.tomorrow || '未入力' }}</p><dl><div v-for="answer in answers" :key="answer.label"><dt>{{ answer.label }}</dt><dd>{{ answer.answer }}</dd></div></dl><div class="photos"><EntryThumbnail v-for="id in entry.imageIds" :key="id" :id="id"/></div><p>写真 {{ entry.imageIds.length }}枚</p></template><p v-else>削除済み</p></div></template>
<style scoped>
.comparison{padding:10px;background:var(--paper);border-radius:10px;font-size:.75rem}.comparison p{line-height:1.7;overflow-wrap:anywhere}.body{white-space:pre-wrap;max-height:200px;overflow:auto}dl>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px 0}dd{margin:0}.photos{display:flex;gap:6px;flex-wrap:wrap}
</style>
