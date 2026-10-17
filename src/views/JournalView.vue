<script setup lang="ts">
import AppIcon from "../components/AppIcon.vue"

import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { baseQuestions, buildGuess, visibleActivityQuestions } from '../data/questions'
import { todaysEntry } from '../stores/diary'
import type { DiaryEntry, MoodValue, QuestionNode } from '../types'
import DiaryEditor from '../components/DiaryEditor.vue'
const router=useRouter(),step=ref(0),answers=ref<Record<string,string>>({}),stage=ref<'questions'|'finish'>('finish'),initial=ref<DiaryEntry>()
const editor=ref<InstanceType<typeof DiaryEditor>>()
onMounted(()=>{if(todaysEntry.value)router.replace(`/entry/${todaysEntry.value.id}`);else createEntry()})
function startQuestions(){
 if(editor.value?.busy)return
 answers.value=editor.value?.getAnswers()||{}
 step.value=0
 stage.value='questions'
 void nextTick(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}
const questions=computed(()=>[...baseQuestions,...visibleActivityQuestions(answers.value)])
const current=computed<QuestionNode|undefined>(()=>questions.value[step.value])
const progress=computed(()=>stage.value==='finish'?100:Math.min(88,14+step.value*10))
function createEntry(){
 const guess=buildGuess(answers.value),now=new Date().toISOString()
 initial.value={id:crypto.randomUUID(),date:now.slice(0,10),mood:(Number(answers.value.mood)||3) as MoodValue,condition:Number(answers.value.condition)||3,answers:{...answers.value},tags:guess.tags,guess:guess.text,body:'',tomorrow:'',imageIds:[],createdAt:now,updatedAt:now}
}
function finish(){
 editor.value?.applyAnswers(answers.value)
 stage.value='finish'
}
function answer(value:string){
 if(stage.value!=='questions'||!current.value)return
 answers.value={...answers.value,[current.value.id]:value}
 if(step.value>=questions.value.length-1||step.value>=8)finish()
 else step.value++
}
function skipAll(){
 if(stage.value!=='questions')return
 const next={...answers.value}
 for(const question of questions.value){
  if(next[question.id]===undefined)next[question.id]='skip'
 }
 answers.value=next
 finish()
}
function back(){if(stage.value==='finish'){router.push('/')}else if(step.value>0){const key=questions.value[step.value-1]?.id;const next={...answers.value};delete next[key];answers.value=next;step.value--}else finish()}
</script>
<template><div class="journal-page">
 <header class="journal-header"><button class="icon-button" @click="back" aria-label="戻る"><AppIcon name="chevron-left" /></button><div class="progress"><i :style="{width:progress+'%'}"></i></div><button v-if="stage==='questions'" class="text-button" @click="skipAll">スキップ</button></header>
 <Transition name="question" mode="out-in">
  <section v-if="stage==='questions'&&current" :key="current.id" class="question-pane"><div><p class="eyebrow">{{current.eyebrow||'今日を、もう少しだけ'}}</p><h1>{{current.prompt}}</h1><p class="question-help">考えすぎなくても大丈夫。近いものを選んでください。</p></div><div class="answer-grid" :class="{moods:current.id==='mood'}"><button v-for="o in current.options" :key="o.value" @click="answer(o.value)"><span v-if="o.icon"><AppIcon :name="o.icon" /></span>{{o.label}}<b><AppIcon name="chevron-right" /></b></button></div></section>

 </Transition>
 <section v-if="initial" v-show="stage==='finish'" class="finish-pane"><div><p class="eyebrow">あなたの言葉で</p><h1>今日を仕上げましょう</h1></div><DiaryEditor ref="editor" :initial="initial" is-new/></section>
 <button v-if="initial && stage==='finish'" type="button" class="question-fab" aria-label="質問モードを始める" title="質問モードを始める" :disabled="editor?.busy" @click="startQuestions"><AppIcon name="message-question" /></button>
</div></template>

<style scoped>
.finish-pane{padding-bottom:88px}
.question-fab{position:fixed;z-index:25;right:max(20px,calc((100vw - 620px)/2 + 20px));bottom:calc(20px + env(safe-area-inset-bottom));display:grid;place-items:center;width:56px;height:56px;padding:0;border:0;border-radius:50%;background:var(--forest);color:white;box-shadow:0 6px 20px rgba(36,74,61,.25);cursor:pointer}
.question-fab :deep(.app-icon){width:26px;height:26px}
.question-fab:hover{filter:brightness(1.1)}
.question-fab:focus-visible{outline:3px solid var(--sage);outline-offset:4px}
.question-fab:disabled{opacity:.5;cursor:wait}
@media(min-width:621px){.question-fab{bottom:44px}}
</style>
