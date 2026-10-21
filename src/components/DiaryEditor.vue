<script setup lang="ts">
import AppIcon from "./AppIcon.vue"
import DiaryEnvironmentPanel from './DiaryEnvironmentPanel.vue'
import DiaryCover from './DiaryCover.vue'
import RichTextEditor from "./RichTextEditor.vue"

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { DiaryEntry, DiaryEnvironment } from '../types'
import { diaryScope, saveEntry, deleteEntry } from '../stores/diary'
import { compressImage, imageRepository } from '../lib/image-repository'
import { confirmDelete } from '../lib/delete-confirmation'
import TrashIcon from './TrashIcon.vue'
import { baseQuestions, activityQuestions } from '../data/questions'
import { editAnswer, editAnswers } from '../lib/edit-answer'
import { registerUpdatePreparation } from '../lib/update-preparation'
import { hasDiaryContent } from '../lib/diary-content'
const props = defineProps<{ initial: DiaryEntry; isNew?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ deleted: [] }>()
const owner = diaryScope.userId, ownerGeneration = diaryScope.generation
const sameOwner = () => owner === diaryScope.userId && ownerGeneration === diaryScope.generation
const draft = reactive<DiaryEntry>(JSON.parse(JSON.stringify(props.initial)))
const questions = computed(() => [...baseQuestions, ...activityQuestions].filter(q => !q.when || q.when(draft.answers)))
const answerSaved = ref(false)
function changeAnswer(id: string, event: Event) {
 const value = (event.target as HTMLSelectElement).value
 Object.assign(draft, editAnswer(draft, id, value))
 answerSaved.value = save()
}
const photos = ref<{id: string; url: string}[]>([])
const coverUrl = computed(() => photos.value.find(photo => photo.id === draft.thumbnailImageId)?.url || '')
const dateLabel = computed(() => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(draft.date + 'T12:00:00')))
const saveError = ref(''), photoError = ref(''), busy = ref(false), lightbox = ref('')
let unsaved = false, disposed = false, deleted = false, changingPhoto = false
let persisted = !props.isNew
let pending: Promise<void> | undefined
function save() {
 if (!sameOwner()) return false
 if (deleted) return true
 if (!persisted && !hasDiaryContent(draft)) {
  unsaved = false; saveError.value = ''; return true
 }
 try {
  saveEntry({ ...draft, answers: { ...draft.answers }, tags: [...draft.tags], imageIds: [...draft.imageIds], updatedAt: new Date().toISOString() })
  persisted = true
  unsaved = false; saveError.value = ''; return true
 } catch {
  unsaved = true; saveError.value = '自動保存できませんでした。端末の空き容量やブラウザの保存設定を確認してください。'; return false
 }
}
// Text is persisted synchronously on each input, including the last keystroke before leaving.
watch(() => [draft.guess, draft.body, draft.tomorrow, draft.thumbnailImageId], () => { if (!changingPhoto) save() }, { flush: 'sync' })
onMounted(async () => {
 if (props.isNew) save()
 for (const id of draft.imageIds) {
  try {
   const photo = await imageRepository.get(id)
   if (disposed) return
   if (photo) photos.value.push({ id, url: URL.createObjectURL(photo.blob) })
   else photoError.value = '読み込めない写真があります。保存されている写真の情報は保持しています。'
  } catch { if (!disposed) photoError.value = '写真を読み込めませんでした。画面を開き直してください。' }
 }
})
function addFiles(event: Event) {
 const input = event.target as HTMLInputElement
 const files = Array.from(input.files || []); input.value = ''
 if (busy.value || !files.length) return
 if (draft.imageIds.length + files.length > 10) { photoError.value = '写真は10枚まで追加できます。'; return }
 busy.value = true; photoError.value = ''
 pending = (async () => {
  for (const file of files) {
   try {
    if (!file.type.startsWith('image/')) throw new Error('Unsupported image')
    const blob = await compressImage(file), id = crypto.randomUUID()
    if (disposed || !sameOwner()) return
    await imageRepository.put({ id, entryId: draft.id, blob, type: blob.type, createdAt: new Date().toISOString() }, owner)
    if (disposed || !sameOwner()) return
    // Publish the image reference only after its transaction has committed.
    draft.imageIds.push(id)
    photos.value.push({ id, url: URL.createObjectURL(blob) })
    if (!draft.thumbnailImageId) draft.thumbnailImageId = id
    save()
   } catch { photoError.value = '写真を保存できませんでした。別の画像や端末の空き容量を確認して、もう一度追加してください。' }
  }
 })().finally(() => { busy.value = false; pending = undefined })
}
async function removePhoto(id: string) {
 if (busy.value || !await confirmDelete({ title: '写真を削除しますか？', message: 'この写真を日記から削除します。削除すると元に戻せません。' })) return
 if (disposed || !sameOwner()) return
 const previous = [...draft.imageIds], thumbnail = draft.thumbnailImageId
 changingPhoto = true
 draft.imageIds = draft.imageIds.filter(value => value !== id)
 if (thumbnail === id) draft.thumbnailImageId = draft.imageIds[0]
 const saved = save()
 if (!saved) { draft.imageIds = previous; draft.thumbnailImageId = thumbnail }
 changingPhoto = false
 if (!saved) return
 const photo = photos.value.find(p => p.id === id)
 if (photo) URL.revokeObjectURL(photo.url)
 photos.value = photos.value.filter(p => p.id !== id)
 // Cleanup follows the durable entry update; failure must not undo the user's edit.
 void imageRepository.delete(id, owner).catch(() => {})
}
async function removeDiary() {
 if (busy.value || !await confirmDelete({ title: '日記を削除しますか？', message: 'この日の日記と写真を削除します。削除すると元に戻せません。' })) return
 if (disposed || !sameOwner()) return
 try { await deleteEntry(draft.id); deleted = true; unsaved = false; emit('deleted') }
 catch { saveError.value = '削除できませんでした。もう一度お試しください。' }
}
function setEnvironment(value: DiaryEnvironment | undefined) {
 draft.environment = value
 save()
}
function applyAnswers(answers: Record<string, string>) {
 Object.assign(draft, editAnswers(draft, answers))
 return save()
}
defineExpose({ removeDiary, busy, applyAnswers, finishEditing: () => !busy.value && save(), getAnswers: () => ({ ...draft.answers }) })
onBeforeRouteLeave(async () => {
 if (pending) await pending
 return deleted || !unsaved || save()
})
const stopUpdatePreparation = registerUpdatePreparation(async () => {
 if (pending) await pending
 return deleted || save()
})
function beforeUnload(event: BeforeUnloadEvent) {
 if (unsaved || busy.value) { event.preventDefault(); event.returnValue = '' }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { stopUpdatePreparation(); disposed = true; window.removeEventListener('beforeunload', beforeUnload); photos.value.forEach(p => URL.revokeObjectURL(p.url)) })
</script>
<template>
 <div class="diary-editor">
  <div v-if="busy" class="editor-status"><p role="status">写真を保存中…</p></div>
  <p v-if="saveError" class="error" role="alert">{{ saveError }} <button class="text-button" @click="save">再試行</button></p>
  <section class="diary-photos" aria-label="今日の写真">
  <div class="photo-stage" :class="{empty:!coverUrl}"><DiaryCover :src="coverUrl" />
  <div class="photo-caption">
  <p class="diary-date">{{dateLabel}}</p>
  <div class="title-field"><h1 v-if="readonly" class="read-title">{{ draft.guess || '無題の日記' }}</h1><input v-else v-model="draft.guess" aria-label="タイトル" placeholder="日記のタイトル"></div>

  </div>
  </div>
  <div v-if="!readonly || draft.imageIds.length" class="photo-heading">今日の写真 <small>{{ draft.imageIds.length }} / 10</small></div>
  <div class="photo-row">
  <div v-if="photos.length" class="detail-gallery"><div v-for="photo in photos" :key="photo.id" class="gallery-image" :class="{selected:draft.thumbnailImageId===photo.id}"><img :src="photo.url" alt="日記の写真" @click="lightbox=photo.url"><button v-if="!readonly" :disabled="busy" aria-label="写真を削除" title="写真を削除" @click="removePhoto(photo.id)"><TrashIcon /></button><button v-if="!readonly" @click="draft.thumbnailImageId=photo.id"><AppIcon v-if="draft.thumbnailImageId===photo.id" name="check" />{{draft.thumbnailImageId===photo.id?'代表写真':'代表にする'}}</button></div></div>
  <div v-if="!readonly && !draft.imageIds.length" class="photo-placeholder" aria-hidden="true"><AppIcon name="camera" /><span>写真はあとからでも</span></div>
  <div v-if="!readonly && draft.imageIds.length<10" class="photo-actions"><label class="outline-button" aria-label="写真を選ぶ" title="写真を選ぶ"><AppIcon name="image" /><input aria-label="写真を選ぶ" type="file" accept="image/*" multiple :disabled="busy" @change="addFiles"></label><label class="outline-button" aria-label="カメラ" title="カメラ"><AppIcon name="camera" /><input aria-label="カメラ" type="file" accept="image/*" capture="environment" :disabled="busy" @change="addFiles"></label></div>
  </div>

  <p v-if="photoError" class="error" role="alert">{{photoError}}</p>
  </section>
  <div v-if="draft.tags.length" class="tag-list"><span v-for="tag in draft.tags" :key="tag"># {{tag}}</span></div>
  <DiaryEnvironmentPanel :readonly="readonly" :model-value="draft.environment" :date="draft.date" @update:model-value="setEnvironment" />
  <div class="body-heading">今日のこと</div><RichTextEditor v-model="draft.body" :readonly="readonly"/>
  <section v-if="readonly && draft.tomorrow" class="read-tomorrow"><h2 class="body-heading">明日やりたいこと</h2><p>{{ draft.tomorrow }}</p></section>
  <label v-if="!readonly"><span class="field-heading">明日やりたいこと <small>任意</small></span><input v-model="draft.tomorrow" placeholder="例：少し早く休む"></label>
  <details v-if="!isNew" class="soft-card diary-answers">
   <summary>質問への回答</summary>
   <p v-if="!readonly" class="answer-help">選び直すと自動保存されます。</p>
   <label v-for="question in questions" :key="question.id" class="answer-field">
    <span>{{ question.prompt }}</span>
    <span v-if="readonly" class="read-answer">{{ question.options.find(option => option.value === draft.answers[question.id])?.label || (draft.answers[question.id] === 'skip' ? 'スキップ' : draft.answers[question.id] ? '以前の回答' : '未回答') }}</span>
    <select v-else :value="draft.answers[question.id] ?? ''" @change="changeAnswer(question.id, $event)">
     <option value="">未回答</option>
     <option v-if="draft.answers[question.id] && draft.answers[question.id] !== 'skip' && !question.options.some(o => o.value === draft.answers[question.id])" :value="draft.answers[question.id]" disabled>以前の回答（選び直せます）</option>
     <option v-for="option in question.options" :key="option.value" :value="option.value">{{ option.icon }} {{ option.label }}</option>
     <option value="skip">スキップ</option>
    </select>
   </label>
   <p v-if="answerSaved && !saveError" class="answer-help" role="status">回答を保存しました。</p>
  </details>
  <Transition name="photo-lightbox"><div v-if="lightbox" class="lightbox" @click="lightbox=''"><img :src="lightbox" alt="拡大した日記の写真"><button aria-label="画像を閉じる"><AppIcon name="close" /></button></div></Transition>
 </div>
</template>
<style scoped>
.photo-caption .read-title{margin:0;font-size:1.1rem;line-height:1.6;overflow-wrap:anywhere}
.read-tomorrow p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}
.read-answer{color:var(--text)}
.editor-status{display:flex;align-items:center;justify-content:space-between;gap:12px}.editor-status p{font-size:.75rem;color:var(--sub)}.diary-editor>label{display:flex;flex-direction:column;gap:8px;margin:20px 0;font-size:.8rem;font-weight:700}.diary-editor>label small{font-weight:400;color:var(--sub)}.diary-editor textarea,.diary-editor>label input{width:100%;padding:15px;border:1px solid var(--line);border-radius:18px;background:white;color:var(--text)}.diary-editor textarea:focus-visible,.diary-editor input:focus-visible{outline:2px solid var(--sage)}.photo-heading{font-size:.8rem;margin-bottom:12px}.photo-actions{margin-top:12px}.diary-editor button:disabled{opacity:.5;cursor:wait}
.photo-lightbox-enter-active,.photo-lightbox-leave-active{transition:opacity 220ms ease}
.photo-lightbox-enter-active img,.photo-lightbox-leave-active img{transition:transform 220ms cubic-bezier(.2,.7,.3,1)}
.photo-lightbox-enter-from,.photo-lightbox-leave-to{opacity:0}
.photo-lightbox-enter-from img,.photo-lightbox-leave-to img{transform:scale(.94)}
@media(prefers-reduced-motion:reduce){.photo-lightbox-enter-active,.photo-lightbox-leave-active,.photo-lightbox-enter-active img,.photo-lightbox-leave-active img{transition:none}.photo-lightbox-enter-from img,.photo-lightbox-leave-to img{transform:none}}
:global(.reduce-motion) .photo-lightbox-enter-from img,:global(.reduce-motion) .photo-lightbox-leave-to img{transform:none}
.lightbox>button{top:calc(env(safe-area-inset-top,0px) + 16px);right:calc(env(safe-area-inset-right,0px) + 16px);display:grid;place-items:center;padding:0;line-height:1}
.diary-editor textarea{min-height:260px;line-height:1.8}
.diary-photos{margin:0 0 20px;padding:0;border:0;background:transparent}
.photo-stage{position:relative;margin:0 calc(-1 * var(--page-right,22px)) 12px calc(-1 * var(--page-left,22px));min-height:300px}
.photo-stage.empty{min-height:0;padding:88px var(--page-right,22px) 24px var(--page-left,22px);margin-bottom:20px;background:linear-gradient(150deg,#e4efea 0%,#f0f4ed 48%,var(--paper) 100%)}
.photo-stage.empty .photo-caption{position:static;padding:0;border:0;border-radius:0;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none}
.photo-placeholder{flex:1;min-width:0;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--line);border-radius:12px;background:rgba(255,255,255,.45);color:var(--sub)}
.photo-placeholder :deep(.app-icon){width:26px;height:26px;opacity:.6}
.photo-placeholder span{font-size:.64rem;text-align:center}
.diary-photos .photo-heading{font-weight:700}
.diary-photos .photo-heading small{font-weight:400;color:var(--sub)}
.photo-row{display:flex;align-items:center;gap:10px}
.diary-photos .detail-gallery{flex:1;min-width:0;margin-bottom:0;scroll-snap-type:x mandatory}
.photo-row .photo-actions{display:flex;flex-direction:column;flex-shrink:0;gap:8px;margin:0}
.photo-row .outline-button{width:44px;height:44px;padding:10px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;cursor:pointer}
.diary-photos .gallery-image{flex:0 0 112px;height:96px;border:0;border-radius:12px;scroll-snap-align:start}
.diary-photos .gallery-image.selected{outline:3px solid var(--sage);outline-offset:-3px}
.photo-caption{position:absolute;bottom:16px;left:var(--page-left,22px);right:var(--page-right,22px);padding:14px 16px;border:1px solid rgba(255,255,255,.65);border-radius:18px;background:rgba(255,255,255,.78);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:var(--text)}
.diary-date{margin:0 0 8px;font-size:.8rem;line-height:1.6;color:var(--sub)}
.title-field{display:flex;flex-direction:column;gap:4px;margin:0;font-size:.72rem;line-height:1.5;color:var(--sub)}
.title-field input{padding:4px 0 10px;line-height:1.6;border:0;width:100%;color:var(--text);border-bottom:1px solid var(--sage);border-radius:0;background:transparent;font-size:1.1rem;font-weight:700}
.title-field input:focus-visible{outline:none;border-bottom:2px solid var(--sage);padding-bottom:9px}
.body-heading{margin-top:20px;font-size:.8rem;font-weight:700}
.diary-editor>label,.body-heading,.photo-heading,.answer-field>span{color:var(--sub)}
.field-heading{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
.diary-answers{margin-top:20px;padding:10px 14px;background:white;border-radius:16px}
.diary-answers summary{cursor:pointer;font-size:.9rem;font-weight:700;line-height:1.6;padding:10px 0}
.answer-help{margin:2px 0 8px;font-size:.72rem;color:var(--sub);line-height:1.5}
.answer-field{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:10px;padding:5px 0;font-size:.75rem;line-height:1.5}
.answer-field>span{overflow-wrap:anywhere}
.answer-field+.answer-field{border-top:1px solid var(--line)}
.answer-field select{width:100%;min-width:0;min-height:44px;padding:8px 4px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--text);font:inherit;font-size:max(16px,1rem)}
.answer-field select:focus-visible,.diary-answers summary:focus-visible{outline:2px solid var(--sage);outline-offset:3px}
</style>
