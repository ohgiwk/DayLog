<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { DiaryEntry } from '../types'
import AppIcon from '../components/AppIcon.vue'
import TrashIcon from '../components/TrashIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import { diaryState } from '../stores/diary'
import DiaryEditor from '../components/DiaryEditor.vue'
import DiaryQuestions from '../components/DiaryQuestions.vue'
import { fadeView } from '../lib/fade-view'
const route=useRoute(),router=useRouter()
const deletingEntry = shallowRef<DiaryEntry>()
const entry = computed(() => diaryState.entries.find(e => e.id === route.params.id) || deletingEntry.value)
const editor = ref<InstanceType<typeof DiaryEditor>>()
const page = ref<HTMLElement>()
const switchingQuestions = ref(false)
const questionsOpen = ref(false)
const questionAnswers = ref<Record<string, string>>({})
let editorScroll = 0
async function startQuestions() {
 if (!editor.value || editor.value.busy || switchingQuestions.value) return
 closeMenu()
 editorScroll = window.scrollY
 questionAnswers.value = editor.value.getAnswers()
 switchingQuestions.value = true
 try {
  await fadeView(page.value, async () => {
   questionsOpen.value = true
   await nextTick()
   window.scrollTo({ top: 0, behavior: 'instant' })
  })
 } finally { switchingQuestions.value = false }
}
function saveQuestionAnswers(answers: Record<string,string>) { return editor.value?.applyAnswers(answers) ?? false }
async function finishQuestions(answers: Record<string, string>) {
 if (switchingQuestions.value) return
 switchingQuestions.value = true
 try {
  await fadeView(page.value, async () => {
   editor.value?.applyAnswers(answers)
   questionsOpen.value = false
   await nextTick()
   window.scrollTo({ top: editorScroll, behavior: 'instant' })
  })
 } finally { switchingQuestions.value = false }
}
const menuOpen = ref(false)
const menuRoot = ref<HTMLElement>()
const menuButton = ref<HTMLButtonElement>()
const deleteButton = ref<HTMLButtonElement>()
function closeMenu(restoreFocus = false) {
 menuOpen.value = false
 if (restoreFocus) menuButton.value?.focus()
}
async function toggleMenu() {
 menuOpen.value = !menuOpen.value
 if (menuOpen.value) { await nextTick(); deleteButton.value?.focus() }
}
function outsideMenu(event: PointerEvent) {
 if (event.target instanceof Node && !menuRoot.value?.contains(event.target)) closeMenu()
}
onMounted(() => document.addEventListener('pointerdown', outsideMenu))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outsideMenu))
async function removeDiary() {
 closeMenu(true)
 const target = editor.value
 if (!target || target.busy) return
 // Keep the editor mounted until its deletion completes and emits the navigation event.
 deletingEntry.value = entry.value
 try { await target.removeDiary() }
 finally {
  if (diaryState.entries.some(e => e.id === deletingEntry.value?.id)) deletingEntry.value = undefined
 }
}
</script>
<template><div v-if="entry" ref="page" class="page detail-page"><DiaryQuestions v-if="questionsOpen" :initial-answers="questionAnswers" :save-answers="saveQuestionAnswers" @complete="finishQuestions" /><div v-show="!questionsOpen" class="detail-editor"><header class="detail-nav"><button @click="router.back()" aria-label="戻る"><svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg></button><div ref="menuRoot" class="diary-menu" @pointerdown.stop @keydown.esc.stop.prevent="closeMenu(true)"><button ref="menuButton" type="button" class="diary-menu-trigger" aria-label="日記のメニュー" title="日記のメニュー" aria-haspopup="menu" :aria-expanded="menuOpen" aria-controls="diary-actions" @click="toggleMenu" @keydown.down.prevent="toggleMenu"><AppIcon name="more" /></button><Transition name="diary-menu"><div v-if="menuOpen" id="diary-actions" class="diary-menu-panel" role="menu" aria-label="日記の操作"><button ref="deleteButton" type="button" role="menuitem" class="diary-delete" :disabled="!editor || editor.busy" @click="removeDiary"><TrashIcon />日記を削除</button></div></Transition></div></header><DiaryEditor ref="editor" :key="entry.id" :initial="entry" @deleted="router.replace('/records')"/>
<button type="button" class="question-fab" aria-label="質問モードを始める" title="質問モードを始める" :disabled="!editor || editor.busy || switchingQuestions" @click="startQuestions"><AppIcon name="message-question" /></button></div>
</div><div v-else class="page"><p>この日記は見つかりませんでした。</p><RouterLink to="/records">記録へ戻る</RouterLink></div></template>

<style scoped>
.detail-page{position:relative;isolation:isolate;padding-top:0}
.detail-editor{padding-bottom:80px}
.question-fab{position:fixed;z-index:25;right:max(20px,calc((100vw - var(--app-width,430px))/2 + 20px));bottom:calc(102px + env(safe-area-inset-bottom,0px));display:grid;place-items:center;width:56px;height:56px;padding:0;border:0;border-radius:50%;background:var(--forest);color:white;box-shadow:0 6px 20px rgba(36,74,61,.25);cursor:pointer}
.question-fab :deep(.app-icon){width:26px;height:26px}
.question-fab:hover{filter:brightness(1.1)}
.question-fab:focus-visible{outline:3px solid var(--sage);outline-offset:4px}
.question-fab:disabled{opacity:.5;cursor:wait}
.detail-nav{position:fixed;top:calc(env(safe-area-inset-top,0px) + 16px);left:50%;right:auto;transform:translateX(-50%);width:min(var(--app-width,430px),100%);padding:0 var(--page-right,22px) 0 var(--page-left,22px);z-index:30;align-items:center;margin:0;pointer-events:none}
.detail-nav>button,.detail-nav>.diary-menu{pointer-events:auto}
.detail-nav>button,.detail-nav .diary-menu-trigger{background:rgba(255,255,255,.5);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 2px 10px rgba(32,50,44,.08)}
.detail-nav>button,.diary-menu-trigger{background:rgba(255,255,255,.85);border-radius:50%}
.diary-date{margin:0 0 16px;font-size:.8rem;line-height:1.6;color:var(--sub)}
.back-icon{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.detail-nav>button{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;line-height:1}

.diary-menu{position:relative}
.diary-menu-trigger{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--forest);cursor:pointer;transition:transform 160ms ease,background-color 160ms ease}
.diary-menu-trigger:active{transform:scale(.88)}
.diary-menu-trigger :deep(.app-icon){width:24px;height:24px;stroke-width:3.5}
.diary-menu-trigger:hover,.diary-menu-trigger:active,.diary-menu-trigger[aria-expanded="true"]{background:rgba(255,255,255,.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.diary-menu-enter-active,.diary-menu-leave-active{transition:opacity 160ms ease,transform 160ms ease;transform-origin:top right}
.diary-menu-enter-from,.diary-menu-leave-to{opacity:0;transform:translateY(-6px) scale(.94)}
.diary-menu-panel{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:170px;padding:6px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
.diary-menu .diary-delete{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:9px;background:transparent;color:#a6534b;font-size:.8rem;white-space:nowrap;cursor:pointer}
.diary-delete:hover{background:#f9eeeb}
.diary-delete:disabled{opacity:.5;cursor:wait}
.diary-menu button:focus-visible{outline:2px solid var(--forest);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.diary-menu-trigger,.diary-menu-enter-active,.diary-menu-leave-active{transition:none}.diary-menu-trigger:active,.diary-menu-enter-from,.diary-menu-leave-to{transform:none}}
:global(.reduce-motion) .diary-menu-trigger,:global(.reduce-motion) .diary-menu-enter-active,:global(.reduce-motion) .diary-menu-leave-active{transition:none}
:global(.reduce-motion) .diary-menu-trigger:active,:global(.reduce-motion) .diary-menu-enter-from,:global(.reduce-motion) .diary-menu-leave-to{transform:none}

.detail-nav>button{transition:transform 160ms ease,background-color 160ms ease}
.detail-nav>button:active{transform:scale(.88)}
@media(prefers-reduced-motion:reduce){.detail-nav>button{transition:none}.detail-nav>button:active{transform:none}}
:global(.reduce-motion) .detail-nav>button{transition:none}
:global(.reduce-motion) .detail-nav>button:active{transform:none}
</style>
