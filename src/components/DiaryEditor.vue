<script setup lang="ts">
import AppNotice from './AppNotice.vue'
import AppIcon from "./AppIcon.vue"
import DiaryEnvironmentPanel from './DiaryEnvironmentPanel.vue'
import PhotoLightbox from './PhotoLightbox.vue'
import DiaryCover from './DiaryCover.vue'
import RichTextEditor from "./RichTextEditor.vue"

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { DiaryEntry, DiaryEnvironment } from '../types'
import { diaryScope, saveEntry, deleteEntry } from '../stores/diary'
import { compressImage, imageRepository } from '../lib/image-repository'
import { confirmDelete } from '../lib/delete-confirmation'
import TrashIcon from './TrashIcon.vue'
import { buildGuess } from '../data/questions'
import { editAnswers } from '../lib/edit-answer'
import { registerUpdatePreparation } from '../lib/update-preparation'
import { hasDiaryContent } from '../lib/diary-content'
const props = defineProps<{ initial: DiaryEntry; isNew?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ deleted: [] }>()
const owner = diaryScope.userId, ownerGeneration = diaryScope.generation
const sameOwner = () => owner === diaryScope.userId && ownerGeneration === diaryScope.generation
const draft = reactive<DiaryEntry>(JSON.parse(JSON.stringify(props.initial)))
const suggestedTitle = computed(() => buildGuess(draft.answers).text)
const titleInput = computed({
 get: () => props.isNew && draft.guess === suggestedTitle.value ? '' : draft.guess,
 set: (value: string) => { draft.guess = value },
})
const previewOrigin = ref<{left:number;top:number;width:number;height:number}>()
function openPhoto(id: string, event: MouseEvent) {
 const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
 previewOrigin.value = { left:bounds.left, top:bounds.top, width:bounds.width, height:bounds.height }
 lightbox.value = id
}
const photoPicker = ref<HTMLInputElement>()
const cameraPicker = ref<HTMLInputElement>()
const photos = ref<{id: string; url: string}[]>([])
const coverId = computed(() => draft.imageIds.includes(draft.thumbnailImageId || '') ? draft.thumbnailImageId! : draft.imageIds[0])
const coverUrl = computed(() => photos.value.find(photo => photo.id === coverId.value)?.url || '')
const collectionPhotos = computed(() => photos.value.filter(photo => !coverUrl.value || photo.id !== coverId.value))
const dateLabel = computed(() => {
 const date = new Date(draft.date + 'T12:00:00')
 const day = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
 const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(date)
 return `${day}（${weekday}）`
})
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
 const deletingCover = coverId.value === id
 changingPhoto = true
 draft.imageIds = draft.imageIds.filter(value => value !== id)
 if (deletingCover) draft.thumbnailImageId = draft.imageIds[0]
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
 <div class="diary-editor" :class="{ 'is-new': isNew }">
  <AppNotice v-if="busy">写真を保存中…</AppNotice>
  <AppNotice v-if="saveError" error>{{ saveError }} <button class="text-button" @click="save">再試行</button></AppNotice>
  <section class="diary-photos" :class="{'photos-readonly':readonly}" aria-label="今日の写真">
  <div class="photo-stage" :class="{empty:!coverUrl}">
   <button v-if="isNew && !readonly && !coverUrl" type="button" class="photo-empty cover-placeholder" aria-label="写真を追加する" :disabled="busy || draft.imageIds.length >= 10" @click="photoPicker?.click()"><AppIcon name="image" /><span class="placeholder-title">この日の景色も、一緒に。</span><span>写真を添えて、思い出を残しましょう</span></button>
   <DiaryCover :src="coverUrl" @open="openPhoto(coverId || '', $event)" />
   <button v-if="!readonly && coverUrl" type="button" class="remove-cover" aria-label="代表写真を削除" title="代表写真を削除" :disabled="busy" @click="removePhoto(coverId!)"><TrashIcon /></button>
  </div>
  <div v-if="!readonly || collectionPhotos.length" class="photo-collection" :class="{'is-reading':readonly,'empty-new-collection':isNew && !collectionPhotos.length}">

   <div v-if="collectionPhotos.length" class="photo-grid" :class="{'many-photos':collectionPhotos.length > 4}">
    <article v-for="(photo, index) in collectionPhotos" :key="photo.id" class="photo-card" :class="{'is-cover':draft.thumbnailImageId===photo.id}">
     <button type="button" class="photo-preview" :aria-label="`写真${index + 1}を拡大する`" @click="openPhoto(photo.id, $event)"><img :src="photo.url" alt="日記の写真" /><span v-if="draft.thumbnailImageId===photo.id" class="cover-badge"><AppIcon name="check" />表紙</span></button>
     <div v-if="!readonly" class="photo-card-actions"><button type="button" class="set-cover" :disabled="busy || draft.thumbnailImageId===photo.id" @click="draft.thumbnailImageId=photo.id">{{draft.thumbnailImageId===photo.id?'表紙':'表紙にする'}}</button><button type="button" class="remove-photo" :disabled="busy" :aria-label="`写真${index + 1}を削除`" @click="removePhoto(photo.id)"><TrashIcon /></button></div>
    </article>
   </div>
   <div v-else-if="!isNew && !readonly && !coverUrl" class="photo-empty"><AppIcon name="image" /><p>この日の景色も、一緒に。</p><span>写真を添えて、思い出を残しましょう</span></div>
   <div v-if="!readonly && draft.imageIds.length<10" class="collection-actions">
    <button type="button" title="写真を追加" aria-label="写真を追加" class="add-photo" :disabled="busy" @click="photoPicker?.click()"><AppIcon name="image" /></button>
    <button type="button" title="撮影" aria-label="撮影" class="take-photo" :disabled="busy" @click="cameraPicker?.click()"><AppIcon name="camera" /></button>
    <input ref="photoPicker" hidden aria-label="写真を選択" type="file" accept="image/*" multiple :disabled="busy" @change="addFiles">
    <input ref="cameraPicker" hidden aria-label="撮影した写真を選択" type="file" accept="image/*" capture="environment" :disabled="busy" @change="addFiles">
   </div>
  </div>

  <p v-if="photoError" class="error" role="alert">{{photoError}}</p>
  </section>
  <div class="photo-caption">
  <p class="diary-date">{{dateLabel}}</p>
  <div class="title-field"><h1 v-if="readonly" class="read-title">{{ draft.guess || '無題の日記' }}</h1><input v-else v-model="titleInput" aria-label="タイトル" :placeholder="isNew ? suggestedTitle : '日記のタイトル'"></div>

  </div>
  <div v-if="draft.tags.length" class="tag-list"><span v-for="tag in draft.tags" :key="tag"># {{tag}}</span></div>
  <div class="body-heading">今日のこと</div><RichTextEditor v-model="draft.body" :readonly="readonly"/>
  <section v-if="readonly && draft.tomorrow" class="read-tomorrow"><h2 class="body-heading">明日やりたいこと</h2><p>{{ draft.tomorrow }}</p></section>
  <label v-if="!readonly"><span class="field-heading">明日やりたいこと <small>任意</small></span><input v-model="draft.tomorrow" placeholder="例：少し早く休む"></label>
  <DiaryEnvironmentPanel :readonly="readonly" :model-value="draft.environment" :date="draft.date" @update:model-value="setEnvironment" />
  <PhotoLightbox v-if="lightbox" :photos="photos" :initial-id="lightbox" :origin="previewOrigin" @close="lightbox=''" />
 </div>
</template>
<style scoped>
.photo-caption .read-title{margin:0;font-size:1.5rem;letter-spacing:.02em;line-height:1.65;overflow-wrap:anywhere}
.read-tomorrow p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}
.editor-status{display:flex;align-items:center;justify-content:space-between;gap:12px}.editor-status p{font-size:.75rem;color:var(--sub)}.diary-editor>label{display:flex;flex-direction:column;gap:8px;margin:20px 0;font-size:.8rem;font-weight:700}.diary-editor>label small{font-weight:400;color:var(--sub)}.diary-editor textarea,.diary-editor>label input{width:100%;padding:15px;border:1px solid var(--line);border-radius:18px;background:white;color:var(--text)}.diary-editor textarea:focus-visible,.diary-editor input:focus-visible{outline:2px solid var(--sage)}.photo-heading{font-size:.8rem;margin-bottom:12px}.photo-actions{margin-top:12px}.diary-editor button:disabled{opacity:.5;cursor:wait}
.diary-editor textarea{min-height:260px;line-height:1.8}
.diary-photos{margin:0 0 20px;padding:0;border:0;background:transparent}
.photo-stage{position:relative;margin:0 calc(-1 * var(--page-right,22px)) 24px calc(-1 * var(--page-left,22px));padding-top:0}
.remove-cover{position:absolute;right:max(14px,env(safe-area-inset-right,0px));bottom:14px;display:grid;place-items:center;width:44px;height:44px;padding:11px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.94);color:var(--forest);box-shadow:0 4px 16px rgba(36,74,61,.15);cursor:pointer}
.remove-cover:hover{color:#a3463d}
.remove-cover:focus-visible{outline:2px solid var(--forest);outline-offset:3px}
.photo-stage.empty{padding-top:80px;margin-bottom:24px}
.is-new .photo-stage{margin-top:calc(-1 * env(safe-area-inset-top,0px))}
.is-new .photo-stage.empty{padding-top:0}
.cover-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;min-height:320px;min-height:max(320px,45svh);padding:calc(80px + env(safe-area-inset-top,0px)) var(--page-right,22px) 48px var(--page-left,22px);border:0;border-radius:0;background:var(--mist);color:var(--sub);font:inherit;cursor:pointer}
.cover-placeholder .placeholder-title{margin-top:8px;color:var(--text);font-size:.85rem}
.cover-placeholder:focus-visible{outline:3px solid var(--forest);outline-offset:-3px}
.photo-collection.empty-new-collection{padding:0;border:0;background:transparent}
.photo-caption{margin-bottom:24px;color:var(--text)}
.diary-date{margin:0 0 8px;font-size:.8rem;line-height:1.6;color:var(--sub)}
.title-field{display:flex;flex-direction:column;gap:4px;margin:0;font-size:.72rem;line-height:1.5;color:var(--sub)}
.title-field input{padding:4px 0 10px;line-height:1.6;border:0;width:100%;color:var(--text);border-bottom:1px solid var(--sage);border-radius:0;background:transparent;font-size:1.1rem;font-weight:700}
.title-field input::placeholder{color:var(--sub);opacity:.55;font-weight:400}
.title-field input:focus-visible{outline:none;border-bottom:2px solid var(--sage);padding-bottom:9px}
.body-heading{margin-top:20px;font-size:.8rem;font-weight:700}
.diary-editor>label,.body-heading,.photo-heading{color:var(--sub)}
.field-heading{display:flex;align-items:baseline;gap:8px;white-space:nowrap}
</style>

<style scoped>
.photo-collection{padding:14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.55)}
.collection-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
.collection-eyebrow{font-size:.58rem;letter-spacing:.18em;color:var(--sub)}
.collection-heading h2{margin:5px 0 0;font-size:.9rem;font-weight:600}
.collection-heading small{margin-left:6px;font-size:.7rem;font-weight:400;color:var(--sub)}
.photo-limit{font-size:.65rem;color:var(--sub)}
.collection-help{font-size:.7rem;line-height:1.8;color:var(--sub);margin:12px 0 16px}
.photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:0}
.photo-grid.many-photos{grid-template-columns:repeat(3,minmax(0,1fr))}
.photo-card{min-width:0}
.photo-preview{position:relative;display:block;width:100%;aspect-ratio:4/3;padding:0;border:0;border-radius:14px;overflow:hidden;background:var(--mist);cursor:zoom-in}
.photo-preview img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
.photo-preview:hover img{transform:scale(1.04)}
.cover-badge{position:absolute;bottom:8px;left:8px;display:flex;align-items:center;gap:4px;border-radius:20px;padding:4px 8px;background:rgba(255,255,255,.94);color:var(--forest);font-size:.62rem}
.cover-badge .app-icon{width:12px;height:12px}
.photo-card-actions{display:flex;align-items:center;justify-content:space-between;gap:4px;padding-top:4px}
.photo-card-actions button{min-height:32px;border:0;background:transparent;cursor:pointer}
.set-cover{padding:0 3px;color:var(--forest);font-size:.68rem;text-align:left}
.photo-card-actions .set-cover:disabled{opacity:1;color:var(--sub);cursor:default}
.remove-photo{display:grid;place-items:center;min-width:32px;color:var(--sub);padding:6px}
.remove-photo:hover{color:#a3463d;background:#f9edeb;border-radius:12px}
.collection-actions{position:fixed;z-index:25;left:max(20px,calc((100vw - var(--app-width,430px))/2 + 20px));bottom:calc(102px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:10px;margin:0}
.is-new .collection-actions{bottom:calc(20px + env(safe-area-inset-bottom,0px))}
.collection-actions button{appearance:none;position:relative;display:grid;place-items:center;flex:0 0 48px;width:48px;min-width:48px;max-width:48px;height:48px;min-height:48px;max-height:48px;margin:0;padding:0;border:0;border-radius:50%;line-height:1;cursor:pointer;box-shadow:0 4px 16px rgba(36,74,61,.18)}
.collection-actions input{display:none}
.collection-actions button:focus-visible,.photo-preview:focus-visible,.photo-card-actions button:focus-visible{outline:2px solid var(--forest);outline-offset:3px}
.collection-actions .app-icon{width:22px;height:22px}
.add-photo{background:var(--forest);color:white}
.collection-actions .take-photo{border:1px solid var(--line);background:var(--paper);color:var(--forest)}
.collection-actions .disabled{opacity:.5;cursor:wait}
.photo-empty:not(.cover-placeholder){text-align:center;padding:16px 0 8px;color:var(--sub)}
.photo-empty>.app-icon{width:30px;height:30px;color:var(--sage)}
.photo-empty p{margin:10px 0 5px;font-size:.85rem;color:var(--text)}
.photo-empty span{font-size:.68rem}
.photos-readonly:has(.is-reading){margin-bottom:12px}
.photos-readonly:has(.is-reading) .photo-stage:not(.empty){margin-bottom:8px}
.is-reading{margin-left:calc(8px - var(--page-left,22px));margin-right:calc(8px - var(--page-right,22px));padding:0;border:0;background:transparent}
.is-reading .photo-grid{gap:8px}
.is-reading .photo-preview{border-radius:6px}
.is-reading .photo-grid{display:grid}

.is-reading .cover-badge{display:none}
@media(prefers-reduced-motion:reduce){.photo-preview img{transition:none}}
</style>
