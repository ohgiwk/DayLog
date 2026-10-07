<script setup lang="ts">
import { ref } from 'vue'
import TrashIcon from '../components/TrashIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import { diaryState } from '../stores/diary'
import DiaryEditor from '../components/DiaryEditor.vue'
import { baseQuestions, activityQuestions } from '../data/questions'
const route=useRoute(),router=useRouter(),entry=diaryState.entries.find(e=>e.id===route.params.id)
const editor = ref<InstanceType<typeof DiaryEditor>>()
const answers = [...baseQuestions, ...activityQuestions].flatMap(question => {
 const value = entry?.answers?.[question.id]
 if (value === undefined) return []
 const option = question.options.find(option => option.value === value)
 return [{ id: question.id, question: question.prompt, answer: value === 'skip' ? 'スキップ' : option?.label || '回答内容を表示できません', icon: option?.icon }]
})
</script>
<template><div v-if="entry" class="page detail-page"><header class="detail-nav"><button @click="router.back()" aria-label="戻る"><svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg></button><button class="diary-trash" aria-label="日記を削除" title="日記を削除" :disabled="!editor || editor.busy" @click="editor?.removeDiary()"><TrashIcon /></button></header><p class="eyebrow">{{new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(entry.date+'T12:00'))}}</p><h1>{{entry.guess}}</h1><div class="tag-list"><span v-for="tag in entry.tags" :key="tag"># {{tag}}</span></div><DiaryEditor ref="editor" :key="entry.id" :initial="entry" @deleted="router.push('/records')"/>
<details class="soft-card diary-answers">
 <summary>質問への回答<span class="answer-count">{{ answers.length }}件</span></summary>
 <dl v-if="answers.length"><div v-for="answer in answers" :key="answer.id"><dt>{{ answer.question }}</dt><dd><span v-if="answer.icon" aria-hidden="true">{{ answer.icon }} </span>{{ answer.answer }}</dd></div></dl>
 <p v-else>この日記には質問への回答が記録されていません。</p>
</details></div><div v-else class="page"><p>この日記は見つかりませんでした。</p><RouterLink to="/records">記録へ戻る</RouterLink></div></template>

<style scoped>
.detail-nav{align-items:center}
.back-icon{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.detail-nav>button{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;line-height:1}

.detail-nav .diary-trash{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;color:#a6534b}
.detail-nav .diary-trash:hover{background:#f9eeeb}
.detail-nav .diary-trash:disabled{opacity:.5;cursor:wait}
.diary-answers{margin-top:20px;padding:14px 16px;background:white;border-radius:16px}
.diary-answers summary{cursor:pointer;font-size:.9rem;font-weight:700;line-height:1.6;padding:6px 0}
.diary-answers summary:focus-visible{outline:2px solid var(--forest);outline-offset:4px;border-radius:4px}
.diary-answers[open] summary{margin-bottom:8px}
.answer-count{margin-left:8px;font-size:.75rem;font-weight:400;color:var(--sub)}
.diary-answers dl{margin:0}
.diary-answers dl>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.8fr);align-items:baseline;gap:12px;padding:8px 0}
.diary-answers dl>div+div{border-top:1px solid var(--line)}
.diary-answers dl>div:last-child{padding-bottom:0}
.diary-answers dt,.diary-answers p{font-size:.75rem;color:var(--sub);line-height:1.5;margin:0;overflow-wrap:anywhere}
.diary-answers dd{margin:0;font-size:.8rem;font-weight:600;line-height:1.5;text-align:right;overflow-wrap:anywhere}
</style>
