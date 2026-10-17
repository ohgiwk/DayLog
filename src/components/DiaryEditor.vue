<script setup lang="ts">
import AppIcon from "./AppIcon.vue"
import DiaryCover from './DiaryCover.vue'
import RichTextEditor from "./RichTextEditor.vue"

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { DiaryEntry } from '../types'
import { diaryScope, saveEntry, deleteEntry } from '../stores/diary'
import { compressImage, imageRepository } from '../lib/image-repository'
import { confirmDelete } from '../lib/delete-confirmation'
import TrashIcon from './TrashIcon.vue'
import { baseQuestions, activityQuestions } from '../data/questions'
import { editAnswer, editAnswers } from '../lib/edit-answer'
import { hasDiaryContent } from '../lib/diary-content'
const props = defineProps<{ initial: DiaryEntry; isNew?: boolean }>()
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
 if (draft.imageIds.length + files.length > 5) { photoError.value = '写真は5枚まで追加できます。'; return }
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
function applyAnswers(answers: Record<string, string>) {
 Object.assign(draft, editAnswers(draft, answers))
 return save()
}
defineExpose({ removeDiary, busy, applyAnswers, getAnswers: () => ({ ...draft.answers }) })
onBeforeRouteLeave(async () => {
 if (pending) await pending
 return deleted || !unsaved || save()
})
function beforeUnload(event: BeforeUnloadEvent) {
 if (unsaved || busy.value) { event.preventDefault(); event.returnValue = '' }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { disposed = true; window.removeEventListener('beforeunload', beforeUnload); photos.value.forEach(p => URL.revokeObjectURL(p.url)) })
</script>
<template>
 <div class="diary-editor">
  <div v-if="busy" class="editor-status"><p role="status">写真を保存中…</p></div>
  <p v-if="saveError" class="error" role="alert">{{ saveError }} <button class="text-button" @click="save">再試行</button></p>
  <section class="diary-photos" aria-label="今日の写真">
  <div class="photo-stage" :class="{empty:!coverUrl}"><DiaryCover :src="coverUrl" />
  <div class="photo-caption">
  <p class="diary-date">{{dateLabel}}</p>
  <div class="title-field"><input v-model="draft.guess" aria-label="タイトル" placeholder="日記のタイトル"></div>

  </div>
  </div>
  <div class="photo-heading">今日の写真 <small>{{ draft.imageIds.length }} / 5</small></div>
  <div class="photo-row">
  <div v-if="photos.length" class="detail-gallery"><div v-for="photo in photos" :key="photo.id" class="gallery-image" :class="{selected:draft.thumbnailImageId===photo.id}"><img :src="photo.url" alt="日記の写真" @click="lightbox=photo.url"><button :disabled="busy" aria-label="写真を削除" title="写真を削除" @click="removePhoto(photo.id)"><TrashIcon /></button><button @click="draft.thumbnailImageId=photo.id"><AppIcon v-if="draft.thumbnailImageId===photo.id" name="check" />{{draft.thumbnailImageId===photo.id?'代表写真':'代表にする'}}</button></div></div>
  <div v-if="draft.imageIds.length<5" class="photo-actions"><label class="outline-button"><AppIcon name="plus" /> 写真を選ぶ<input type="file" accept="image/*" multiple :disabled="busy" @change="addFiles"></label><label class="outline-button"><AppIcon name="camera" /> カメラ<input type="file" accept="image/*" capture="environment" :disabled="busy" @change="addFiles"></label></div>
  </div>

  <p v-if="photoError" class="error" role="alert">{{photoError}}</p>
  </section>
  <div v-if="draft.tags.length" class="tag-list"><span v-for="tag in draft.tags" :key="tag"># {{tag}}</span></div>
  <div class="body-heading">今日のこと</div><RichTextEditor v-model="draft.body"/>
  <label><span class="field-heading">明日やりたいこと <small>任意</small></span><input v-model="draft.tomorrow" placeholder="例：少し早く休む"></label>
  <details v-if="!isNew" class="soft-card diary-answers">
   <summary>質問への回答</summary>
   <p class="answer-help">選び直すと自動保存されます。</p>
   <label v-for="question in questions" :key="question.id" class="answer-field">
    <span>{{ question.prompt }}</span>
    <select :value="draft.answers[question.id] ?? ''" @change="changeAnswer(question.id, $event)">
     <option value="">未回答</option>
     <option v-if="draft.answers[question.id] && draft.answers[question.id] !== 'skip' && !question.options.some(o => o.value === draft.answers[question.id])" :value="draft.answers[question.id]" disabled>以前の回答（選び直せます）</option>
     <option v-for="option in question.options" :key="option.value" :value="option.value">{{ option.icon }} {{ option.label }}</option>
     <option value="skip">スキップ</option>
    </select>
   </label>
   <p v-if="answerSaved && !saveError" class="answer-help" role="status">回答を保存しました。</p>
  </details>
  <div v-if="lightbox" class="lightbox" @click="lightbox=''"><img :src="lightbox" alt="拡大した日記の写真"><button aria-label="画像を閉じる"><AppIcon name="close" /></button></div>
 </div>
</template>
<style scoped>
.editor-status{display:flex;align-items:center;justify-content:space-between;gap:12px}.editor-status p{font-size:.75rem;color:var(--sub)}.diary-editor>label{display:flex;flex-direction:column;gap:8px;margin:20px 0;font-size:.8rem;font-weight:700}.diary-editor>label small{font-weight:400;color:var(--sub)}.diary-editor textarea,.diary-editor>label input{width:100%;padding:15px;border:1px solid var(--line);border-radius:18px;background:white;color:var(--text)}.diary-editor textarea:focus-visible,.diary-editor input:focus-visible{outline:2px solid var(--sage)}.photo-heading{font-size:.8rem;margin-bottom:12px}.photo-actions{margin-top:12px}.diary-editor button:disabled{opacity:.5;cursor:wait}
.diary-editor textarea{min-height:260px;line-height:1.8}
.diary-photos{margin:0 0 20px;padding:0;border:0;background:transparent}
.photo-stage{position:relative;margin:0 calc(-1 * var(--page-right,22px)) 12px calc(-1 * var(--page-left,22px));min-height:300px}
.photo-stage.empty{height:300px;background:linear-gradient(145deg,var(--mist),transparent)}
.diary-photos .photo-heading{font-weight:700}
.diary-photos .photo-heading small{font-weight:400;color:var(--sub)}
.photo-row{display:flex;align-items:center;gap:10px}
.diary-photos .detail-gallery{flex:1;min-width:0;margin-bottom:0;scroll-snap-type:x mandatory}
.photo-row .photo-actions{display:flex;flex-direction:column;flex-shrink:0;gap:8px;margin:0}
.photo-row .outline-button{display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;cursor:pointer}
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
.answer-field select{width:100%;min-width:0;min-height:44px;padding:8px 4px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--text);font:inherit}
.answer-field select:focus-visible,.diary-answers summary:focus-visible{outline:2px solid var(--sage);outline-offset:3px}
</style>
