<script setup lang="ts">
import { registerUpdatePreparation } from '../lib/update-preparation'
import LegacyMemoImport from '../components/LegacyMemoImport.vue'
import { setMemoEditingCheck, scheduleMemoSync } from '../lib/memo-sync'
import AppIcon from "../components/AppIcon.vue"

import { confirmDelete } from '../lib/delete-confirmation'
import TrashIcon from '../components/TrashIcon.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { accessLibrary, memoOwner, onMemoChange, type MemoLibrary, type Memo } from '../lib/memo-repository'
import { splitMemoContent } from '../lib/memo-html'
import { compressImage } from '../lib/image-repository'
const formatGroups: { label: string; items: { label: string; icon: string; command: string; value?: string }[] }[] = [
 { label: '文字装飾', items: [
  { label: '太字', icon: 'bold', command: 'bold' },
  { label: '斜体', icon: 'italic', command: 'italic' },
  { label: '下線', icon: 'underline', command: 'underline' },
 ] },
 { label: '段落', items: [
  { label: '見出し', icon: 'heading', command: 'formatBlock', value: 'h2' },
  { label: '本文', icon: 'paragraph', command: 'formatBlock', value: 'p' },
 ] },
 { label: 'リスト・引用', items: [
  { label: '箇条書き', icon: 'list-bullet', command: 'insertUnorderedList' },
  { label: '番号リスト', icon: 'list-number', command: 'insertOrderedList' },
  { label: '引用', icon: 'quote', command: 'formatBlock', value: 'blockquote' },
 ] },
 { label: '編集履歴', items: [
  { label: '元に戻す', icon: 'undo', command: 'undo' },
  { label: 'やり直す', icon: 'redo', command: 'redo' },
 ] },
]
const owner = memoOwner()
let disposed = false, loadSequence = 0
const library = ref<MemoLibrary>({ folders: [], notes: [] })
const loadFailed = ref(false)
const loading = ref(true), busy = ref(false), error = ref(''), status = ref('')
const folderId = ref(''), draft = ref<Memo | null>(null), dirty = ref(false)
const editor = ref<HTMLElement>()
const folderName = ref(''), memoTitle = ref(''), targetFolder = ref('')
const createKind = ref<'folder' | 'note' | 'rename'>('folder')
const createDialog = ref<HTMLDialogElement>(), nameInput = ref<HTMLInputElement>(), fab = ref<HTMLButtonElement>()
const dialogOpen = ref(false)
const formatMenuOpen = ref(false)
const formatMenu = ref<HTMLElement>(), formatMenuButton = ref<HTMLButtonElement>()
function closeFormatMenu(restoreFocus = false) {
 formatMenuOpen.value = false
 if (restoreFocus) formatMenuButton.value?.focus()
}
const folderMenuOpen = ref(false)
const folderMenu = ref<HTMLElement>(), folderMenuButton = ref<HTMLButtonElement>()
function closeFolderMenu(restoreFocus = false) {
 folderMenuOpen.value = false
 if (restoreFocus) folderMenuButton.value?.focus()
}
function dismissFolderMenu(event: PointerEvent) {
 if (event.target instanceof Node && !formatMenu.value?.contains(event.target)) closeFormatMenu()
 if (event.target instanceof Node && !folderMenu.value?.contains(event.target)) closeFolderMenu()
}
function escapeFolderMenu(event: KeyboardEvent) {
 if (event.key === 'Escape' && formatMenuOpen.value) { event.preventDefault(); closeFormatMenu(true) }
 if (event.key === 'Escape' && folderMenuOpen.value) { event.preventDefault(); closeFolderMenu(true) }
}
async function renameFolder() {
 closeFolderMenu(true)
 await showCreate('rename')
}
const canCreate = computed(() => !busy.value && (createKind.value === 'note'
 ? library.value.folders.some(f => f.id === targetFolder.value)
 : !!folderName.value.trim()))
async function showCreate(kind: 'folder' | 'note' | 'rename' = folder.value ? 'note' : 'folder') {
 if (busy.value || loading.value || loadFailed.value) return
 closeFolderMenu()
 createKind.value = kind
 folderName.value = kind === 'rename' ? folder.value?.name ?? '' : ''
 memoTitle.value = ''; targetFolder.value = folderId.value || library.value.folders[0]?.id || ''
 error.value = ''; dialogOpen.value = true
 await nextTick()
 createDialog.value?.showModal(); nameInput.value?.focus()
}
async function selectCreateKind(kind: 'folder' | 'note') {
 createKind.value = kind
 await nextTick(); nameInput.value?.focus()
}
function closeCreate() {
 if (busy.value) return
 createDialog.value?.close(); dialogOpen.value = false
}
async function createItem() {
 if (!canCreate.value) return
 if (createKind.value !== 'note') {
  if (await saveFolder()) closeCreate()
  return
 }
 const note: Memo = { id: crypto.randomUUID(), folderId: targetFolder.value, title: memoTitle.value.trim() || '無題のメモ', html: '', updatedAt: new Date().toISOString() }
 const value = JSON.parse(JSON.stringify(library.value)) as MemoLibrary
 value.notes.push(note)
 if (!await commit(value)) return
 folderId.value = note.folderId
 closeCreate()
 await openNote(note)
 editor.value?.focus()
}
const folder = computed(() => library.value.folders.find(f => f.id === folderId.value))
const notes = computed(() => library.value.notes.filter(n => n.folderId === folderId.value).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)))
let selection: Range | null = null
async function reloadLibrary() {
 const sequence = ++loadSequence
 try {
  const value = await accessLibrary(undefined, owner)
  if (!disposed && memoOwner() === owner && sequence === loadSequence && !draft.value && !dialogOpen.value && !busy.value) library.value = value
 } catch { if (!disposed) { loadFailed.value = true; error.value = 'メモを読み込めませんでした。画面を開き直してください。' } }
 finally { loading.value = false }
}
setMemoEditingCheck(() => !!draft.value || dialogOpen.value || busy.value)
const stopMemoChanges = onMemoChange(id => { if (id === owner && !draft.value && !dialogOpen.value && !busy.value) void reloadLibrary() })
watch(() => !!draft.value || dialogOpen.value || busy.value, active => { if (!active) { void reloadLibrary(); scheduleMemoSync() } })
onMounted(reloadLibrary)
async function commit(value: MemoLibrary) {
 busy.value = true; error.value = ''
 try { const saved = await accessLibrary(value, owner, JSON.parse(JSON.stringify(library.value))); if (disposed || memoOwner() !== owner) return false; library.value = saved; return true }
 catch (failure) { error.value = failure instanceof Error && failure.message === 'memo_local_conflict' ? '別の画面でこのメモが変更されています。入力内容を控えて、一覧から開き直してください。' : '保存できませんでした。端末の空き容量やブラウザの保存設定を確認して、もう一度お試しください。'; return false }
 finally { busy.value = false }
}
async function saveFolder() {
 const name = folderName.value.trim(); if (!name || busy.value) return false
 const value = JSON.parse(JSON.stringify(library.value)) as MemoLibrary
 let id = folderId.value
 if (createKind.value === 'rename') {
  const existing = value.folders.find(f => f.id === id)
  if (!existing) return false
  existing.name = name
 } else { id = crypto.randomUUID(); value.folders.push({ id, name }) }
 if (!await commit(value)) return false
 folderId.value = id; folderName.value = ''
 return true
}
function discard() { return !dirty.value || confirm('保存していない変更を破棄しますか？') }
function back() { if (busy.value || !discard()) return; draft.value = null; closeFormatMenu(); dirty.value = false; status.value = ''; selection = null }
async function openNote(note?: Memo) {
 draft.value = note ? { ...note, ...splitMemoContent(note.html, note.images) } : { images: [], id: crypto.randomUUID(), folderId: folderId.value, title: '', html: '', updatedAt: '' }
 dirty.value = !note; status.value = ''; selection = null
 await nextTick(); if (editor.value) editor.value.innerHTML = draft.value.html
}
function changed() { dirty.value = true; status.value = '' }
function remember() { const s = window.getSelection(); if (s?.rangeCount && editor.value?.contains(s.anchorNode)) selection = s.getRangeAt(0).cloneRange() }
function focusEditor() {
 editor.value?.focus(); const s = window.getSelection()
 if (selection && editor.value?.contains(selection.commonAncestorContainer)) { s?.removeAllRanges(); s?.addRange(selection) }
}
function format(command: string, value?: string) { closeFormatMenu(); focusEditor(); document.execCommand(command, false, value); remember(); changed() }
function paste(event: ClipboardEvent) {
 event.preventDefault()
 const images = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
 if (images.length) { void addImages(images); return }
 const html = event.clipboardData?.getData('text/html')
 if (html) {
  const content = splitMemoContent(html)
  if (draft.value && content.images.length) {
   draft.value.images = [...(draft.value.images || []), ...content.images]
   changed()
  }
  format('insertHTML', content.html)
 }
 else format('insertText', event.clipboardData?.getData('text/plain') || '')
}
async function addImages(files: File[]) {
 if (busy.value || !draft.value || !files.length) return
 busy.value = true; error.value = ''
 try {
  for (const file of files) {
   if (!file.type.startsWith('image/')) throw new Error('invalid image')
   const blob = await compressImage(file)
   const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
   draft.value.images = [...(draft.value.images || []), url]
   changed()
  }
 } catch { error.value = '画像を追加できませんでした。別の画像でお試しください。' }
 finally { busy.value = false }
}
async function addImageFiles(event: Event) {
 const input = event.target as HTMLInputElement
 await addImages(Array.from(input.files || []))
 input.value = ''
}
async function removeImage(index: number) {
 if (busy.value || !draft.value || !await confirmDelete({ title: '写真を削除しますか？', message: 'この写真をメモから取り除きます。メモを保存すると反映されます。' })) return
 draft.value.images = draft.value.images?.filter((_, i) => i !== index)
 changed()
}
async function save() {
 if (!draft.value || busy.value) return
 const note = { ...draft.value, title: draft.value.title.trim() || '無題のメモ', ...splitMemoContent(editor.value?.innerHTML || '', draft.value.images), updatedAt: new Date().toISOString() }
 const value = { folders: library.value.folders.map(f => ({ ...f })), notes: [...library.value.notes.filter(n => n.id !== note.id).map(n => ({ ...n })), note] }
 if (await commit(value)) { draft.value = { ...note }; dirty.value = false; folderId.value = note.folderId; status.value = '保存しました' }
}
async function removeNote() {
 if (!draft.value || !await confirmDelete({ title: 'メモを削除しますか？', message: `「${draft.value.title.trim() || '無題のメモ'}」を削除します。削除すると元に戻せません。` })) return
 if (await commit({ folders: library.value.folders.map(f => ({ ...f })), notes: library.value.notes.filter(n => n.id !== draft.value!.id).map(n => ({ ...n })) })) { dirty.value = false; back() }
}
async function removeFolder() {
 closeFolderMenu(true)
 if (!await confirmDelete({ title: 'フォルダを削除しますか？', message: `「${folder.value?.name}」と中のメモ${notes.value.length}件を削除します。削除すると元に戻せません。` })) return
 if (await commit({ folders: library.value.folders.filter(f => f.id !== folderId.value).map(f => ({ ...f })), notes: library.value.notes.filter(n => n.folderId !== folderId.value).map(n => ({ ...n })) })) { folderId.value = ''; folderName.value = '' }
}
const stopUpdatePreparation = registerUpdatePreparation(async () => {
 if (busy.value) return false
 if (dirty.value) await save()
 return !dirty.value
})
function beforeUnload(e: BeforeUnloadEvent) { if (dirty.value || busy.value) { e.preventDefault(); e.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
document.addEventListener('pointerdown', dismissFolderMenu)
document.addEventListener('keydown', escapeFolderMenu)
onBeforeUnmount(() => { stopUpdatePreparation(); disposed = true; stopMemoChanges(); setMemoEditingCheck(() => false); scheduleMemoSync(); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('pointerdown', dismissFolderMenu); document.removeEventListener('keydown', escapeFolderMenu); createDialog.value?.close() })
onBeforeRouteLeave(() => !busy.value && discard())
</script>

<template>
 <div class="page memos-page">
  <header class="page-header"><p class="eyebrow">MY NOTEBOOK</p><h1>メモ</h1><p>覚えておきたいこと、心に残ったこと。</p></header>
  <p v-if="loading" role="status">読み込み中…</p>
  <p v-if="error && !dialogOpen" class="error" role="alert">{{ error }}</p>
  <template v-if="!loading && !loadFailed">
   <template v-if="draft">
    <div class="memo-actions"><button class="outline-button" :disabled="busy" @click="back"><AppIcon name="chevron-left" /> 一覧へ</button><button class="text-button" :disabled="busy" aria-label="メモを削除" title="メモを削除" @click="removeNote"><TrashIcon /></button></div>
    <label class="memo-label">フォルダ<select v-model="draft.folderId" :disabled="busy" @change="changed"><option v-for="f in library.folders" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
    <label class="memo-label">タイトル<input v-model="draft.title" placeholder="無題のメモ" :disabled="busy" @input="changed"></label>
    <div class="memo-toolbar" role="toolbar" aria-label="本文の書式">
     <div class="memo-format-group" role="group" aria-label="文字装飾">
      <button v-for="item in formatGroups[0]!.items" :key="item.label" type="button" :aria-label="item.label" :title="item.label" :disabled="busy" @mousedown.prevent @click="format(item.command, item.value)"><AppIcon :name="item.icon" /></button>
     </div>
     <div ref="formatMenu" class="memo-format-menu" @focusout="!formatMenu?.contains($event.relatedTarget as Node | null) && closeFormatMenu()">
      <button ref="formatMenuButton" type="button" aria-label="段落・リストの書式" title="段落・リストの書式" :aria-expanded="formatMenuOpen" aria-controls="memo-format-options" :disabled="busy" @mousedown.prevent @click="formatMenuOpen = !formatMenuOpen"><AppIcon name="text" /><span class="format-caret" aria-hidden="true"></span></button>
      <div v-if="formatMenuOpen" id="memo-format-options" class="memo-format-options">
       <div v-for="group in formatGroups.slice(1, 3)" :key="group.label" role="group" :aria-label="group.label">
        <span class="format-group-label">{{ group.label }}</span>
        <div class="format-option-row"><button v-for="item in group.items" :key="item.label" type="button" :aria-label="item.label" :title="item.label" :disabled="busy" @mousedown.prevent @click="format(item.command, item.value)"><AppIcon :name="item.icon" /></button></div>
       </div>
      </div>
     </div>
     <div class="memo-format-group memo-history" role="group" aria-label="編集履歴">
      <button v-for="item in formatGroups[3]!.items" :key="item.label" type="button" :aria-label="item.label" :title="item.label" :disabled="busy" @mousedown.prevent @click="format(item.command, item.value)"><AppIcon :name="item.icon" /></button>
     </div>
    </div>
    <div ref="editor" class="memo-editor" :contenteditable="!busy" role="textbox" aria-label="メモ本文" aria-multiline="true" @input="changed" @keyup="remember" @mouseup="remember" @focusout="remember" @paste="paste" @drop.prevent></div>
    <section class="memo-attachments" aria-labelledby="memo-photos-title">
     <h2 id="memo-photos-title">添付写真 <small>{{ draft.images?.length || 0 }}枚</small></h2>
     <div v-if="draft.images?.length" class="memo-photo-grid">
      <div v-for="(image, index) in draft.images" :key="index" class="memo-photo">
       <img :src="image" :alt="`メモの添付写真 ${index + 1}`">
       <button type="button" :disabled="busy" :aria-label="`写真 ${index + 1} を削除`" title="写真を削除" @click="removeImage(index)"><TrashIcon /></button>
      </div>
     </div>
     <p v-else class="memo-hint">写真を本文とは別に添付できます。</p>
     <div class="photo-actions">
      <label class="outline-button"><AppIcon name="plus" /> 写真を選ぶ<input type="file" accept="image/*" multiple :disabled="busy" @change="addImageFiles"></label>
      <label class="outline-button"><AppIcon name="camera" /> カメラ<input type="file" accept="image/*" capture="environment" :disabled="busy" @change="addImageFiles"></label>
     </div>
     <p v-if="busy" class="memo-hint" role="status">処理中…</p>
    </section>
    <button class="primary-button full" :disabled="busy" @click="save">{{ busy ? '処理中…' : 'メモを保存' }}</button><p role="status" class="memo-hint">{{ status || (dirty ? '未保存の変更があります' : '') }}</p>
   </template>
   <template v-else>
    <LegacyMemoImport />
    <div v-if="folder" class="memo-actions">
     <button class="outline-button" :disabled="busy" @click="closeFolderMenu();folderId='';folderName=''"><AppIcon name="chevron-left" /> フォルダ一覧</button>
     <div ref="folderMenu" class="folder-menu" @focusout="!folderMenu?.contains($event.relatedTarget as Node | null) && closeFolderMenu()">
      <button ref="folderMenuButton" class="folder-menu-trigger" type="button" :disabled="busy" aria-label="フォルダの操作" :aria-expanded="folderMenuOpen" aria-controls="folder-actions" @click="folderMenuOpen = !folderMenuOpen"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg></button>
      <div v-if="folderMenuOpen" id="folder-actions" class="folder-menu-panel" role="group" aria-label="フォルダの操作">
       <button type="button" :disabled="busy" @click="renameFolder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5M4 15 16 3a3.54 3.54 0 0 1 5 5L9 20l-6 1 1-6Z" /></svg> 名前を変更</button>
       <button type="button" class="folder-menu-delete" :disabled="busy" @click="removeFolder"><TrashIcon /> フォルダを削除</button>
      </div>
     </div>
    </div>

    <template v-if="!folder"><p v-if="!library.folders.length" class="soft-card">右下の＋からフォルダを作って、最初のメモを残しましょう。</p><div class="memo-list"><button v-for="f in library.folders" :key="f.id" class="soft-card memo-row" :disabled="busy" @click="folderId=f.id;folderName='' "><b><AppIcon name="folder" /> {{ f.name }}</b><small>{{ library.notes.filter(n=>n.folderId===f.id).length }}件のメモ <AppIcon name="chevron-right" /></small></button></div></template>
    <template v-else><h2 class="folder-title">{{ folder.name }}</h2><p v-if="!notes.length" class="memo-hint">まだメモがありません。右下の＋から作成できます。</p><div class="memo-list"><button v-for="note in notes" :key="note.id" class="soft-card memo-row" :disabled="busy" @click="openNote(note)"><b>{{ note.title }}</b><small>{{ new Date(note.updatedAt).toLocaleString('ja-JP') }}</small></button></div></template>
    <button ref="fab" class="memo-fab" type="button" aria-label="フォルダ・メモを新規作成" aria-haspopup="dialog" :disabled="busy" @click="showCreate()"><AppIcon name="plus" /></button>
    <p class="memo-hint">メモと写真は端末に保存され、ログイン中のアカウントで同期されます。</p>
   </template>
  </template>
  <Teleport to="body">
   <dialog ref="createDialog" class="memo-create-dialog" aria-labelledby="memo-create-title" @cancel.prevent="closeCreate" @close="dialogOpen = false" @click="($event.target === createDialog) && closeCreate()">
    <form @submit.prevent="createItem">
     <div class="create-heading"><h2 id="memo-create-title">{{ createKind === 'rename' ? 'フォルダ名を変更' : '新しく作成' }}</h2><button type="button" class="create-close" aria-label="閉じる" :disabled="busy" @click="closeCreate"><AppIcon name="close" /></button></div>
     <div v-if="createKind !== 'rename'" class="create-options" role="group" aria-label="作成する種類">
      <button type="button" :aria-pressed="createKind === 'folder'" :disabled="busy" @click="selectCreateKind('folder')"><AppIcon name="folder" /> フォルダ</button>
      <button type="button" :aria-pressed="createKind === 'note'" :disabled="busy" @click="selectCreateKind('note')"><AppIcon name="note" /> メモ</button>
     </div>
     <template v-if="createKind === 'note'">
      <label class="memo-label">タイトル<input ref="nameInput" v-model="memoTitle" maxlength="200" placeholder="無題のメモ" :disabled="busy"></label>
      <label class="memo-label">保存先フォルダ<select v-model="targetFolder" required :disabled="busy || !library.folders.length"><option disabled value="">フォルダを選択</option><option v-for="f in library.folders" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
      <p v-if="!library.folders.length" class="memo-hint">先にフォルダを作成してください。</p>
     </template>
     <label v-else class="memo-label">フォルダ名<input ref="nameInput" v-model="folderName" required maxlength="100" placeholder="読書、映画、アイデアなど" :disabled="busy"></label>
     <p v-if="error" class="error" role="alert">{{ error }}</p>
     <div class="create-actions"><button type="button" class="outline-button" :disabled="busy" @click="closeCreate">キャンセル</button><button type="submit" class="primary-button" :disabled="!canCreate">{{ busy ? '保存中…' : createKind === 'rename' ? '変更する' : '作成する' }}</button></div>
    </form>
   </dialog>
  </Teleport>
 </div>
</template>

<style scoped>
.memo-actions{display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap}.memo-label{display:flex;flex-direction:column;gap:8px;font-size:.8rem;margin:16px 0;flex:1;min-width:0}.memo-label input,.memo-label select{width:100%;min-height:44px;padding:12px;border:1px solid var(--line);border-radius:12px;background:white;color:var(--text);font:inherit}.memo-list{display:grid;gap:12px;margin-top:20px}.memo-row{display:flex;flex-direction:column;text-align:left;gap:8px;width:100%;color:var(--text);cursor:pointer;overflow-wrap:anywhere}.memo-row small,.memo-hint{color:var(--sub);font-size:.75rem;line-height:1.7}.folder-title{overflow-wrap:anywhere}.memo-toolbar{display:flex;flex-wrap:wrap;gap:6px;background:var(--mist);padding:10px;border-radius:14px 14px 0 0}.memo-toolbar button{background:white;border:1px solid var(--line);padding:8px;border-radius:8px;color:var(--forest);min-height:40px;cursor:pointer;font-size:.75rem}.memo-editor{background:white;border:1px solid var(--line);border-radius:0 0 14px 14px;min-height:320px;padding:16px;line-height:1.9;overflow-wrap:anywhere}.memo-editor:focus{outline:2px solid var(--sage);outline-offset:2px}.memo-editor :deep(img){max-width:100%;height:auto;border-radius:8px}.memo-editor :deep(blockquote){border-left:3px solid var(--sage);margin-left:0;padding-left:14px;color:var(--sub)}button:disabled{opacity:.5;cursor:wait}
.memos-page{padding-bottom:100px}
.folder-menu{position:relative;margin-left:auto}
.folder-menu-trigger{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--forest);cursor:pointer}
.folder-menu-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:22;min-width:180px;padding:6px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 10px 30px #183d3520}
.folder-menu-panel button{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--text);font:inherit;font-size:.82rem;text-align:left;white-space:nowrap;cursor:pointer}
.folder-menu-panel button:hover{background:var(--mist)}
.folder-menu-panel .folder-menu-delete{color:#b34141}
.folder-menu button:focus-visible{outline:2px solid var(--sage);outline-offset:2px}
.memo-fab{position:fixed;z-index:21;right:max(18px,env(safe-area-inset-right,0px),calc((100vw - var(--app-width))/2 + 18px));bottom:calc(100px + env(safe-area-inset-bottom,0px));display:grid;place-items:center;width:56px;height:56px;border:1px solid rgba(255,255,255,.5);border-radius:20px;background:var(--gradient-action);color:white;box-shadow:0 8px 24px rgba(36,74,61,.25);cursor:pointer;transition:transform .18s}
.memo-fab:active{transform:scale(.94)}.memo-fab :deep(svg){width:26px;height:26px}
.memo-create-dialog{width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 48px);overflow:auto;border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--surface);color:var(--text);box-shadow:0 24px 80px #183d3540}
.memo-create-dialog::backdrop{background:rgba(25,45,39,.4);backdrop-filter:blur(4px)}
.create-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.create-heading h2{margin:0;font-size:1.15rem}
.create-close{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:var(--sub);cursor:pointer}
.create-options{display:flex;gap:6px;padding:4px;margin:14px 0;background:var(--mist);border-radius:14px}.create-options button{flex:1;min-height:44px;border:0;border-radius:10px;background:transparent;color:var(--sub);font-size:.82rem;cursor:pointer}.create-options button[aria-pressed=true]{background:white;color:var(--forest);box-shadow:0 2px 8px #183d3510;font-weight:700}
.memo-create-dialog .memo-label input,.memo-create-dialog .memo-label select{font-size:16px}
.create-actions{display:flex;gap:10px;margin-top:24px}.create-actions button{flex:1;min-height:48px;min-width:0;font-size:.82rem!important;border-radius:14px;cursor:pointer}
.memo-fab:focus-visible,.memo-create-dialog :is(input,select,button):focus-visible{outline:2px solid var(--sage);outline-offset:3px}
</style>

<style scoped>
.memo-toolbar{display:flex;flex-wrap:nowrap;gap:4px;padding:6px;align-items:center}
.memo-format-group{display:flex;flex:3;min-width:0;gap:0;padding:0}
.memo-history{flex:2;border-left:1px solid var(--line);padding-left:4px}
.memo-format-menu{position:relative;flex:1.2;min-width:0;border-left:1px solid var(--line);padding-left:4px}
.memo-format-menu>button{width:100%;display:flex!important;justify-content:center;gap:4px}
.format-caret{width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);margin-top:-3px}
.memo-format-options{position:absolute;z-index:23;top:calc(100% + 8px);right:0;width:168px;padding:10px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 24px #183d3520}
.format-group-label{display:block;color:var(--sub);font-size:.7rem;margin:2px 4px 4px}
.memo-format-options>div+div{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}
.format-option-row{display:flex}
.memo-toolbar button{display:grid;place-items:center;flex:1;min-width:0;min-height:44px;padding:6px;border:0;background:transparent}
.memo-toolbar button:hover:not(:disabled){background:var(--mist)}
.memo-toolbar button:focus-visible{outline:2px solid var(--sage);outline-offset:2px}
.memo-attachments{margin:20px 0;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.memo-attachments h2{margin:0 0 14px;font-size:.9rem}
.memo-attachments h2 small{margin-left:6px;color:var(--sub);font-weight:400}
.memo-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}
.memo-photo{position:relative;min-width:0}
.memo-photo img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}
.memo-photo button{position:absolute;top:4px;right:4px;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:12px;background:#fffffff0;color:#b34141;cursor:pointer}
</style>
