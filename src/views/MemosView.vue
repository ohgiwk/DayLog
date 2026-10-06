<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { accessLibrary, type MemoLibrary, type Memo } from '../lib/memo-repository'
import { cleanMemoHtml } from '../lib/memo-html'
import { compressImage } from '../lib/image-repository'
const library = ref<MemoLibrary>({ folders: [], notes: [] })
const loadFailed = ref(false), saving = ref(false)
const loading = ref(true), busy = ref(false), error = ref(''), status = ref('')
const folderId = ref(''), draft = ref<Memo | null>(null), dirty = ref(false)
const editor = ref<HTMLElement>(), fileInput = ref<HTMLInputElement>()
const folderName = ref(''), renaming = ref(false)
const folder = computed(() => library.value.folders.find(f => f.id === folderId.value))
const notes = computed(() => library.value.notes.filter(n => n.folderId === folderId.value).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)))
let selection: Range | null = null
onMounted(async () => { try { library.value = await accessLibrary() } catch { loadFailed.value = true; error.value = 'メモを読み込めませんでした。画面を開き直してください。' } finally { loading.value = false } })
async function commit(value: MemoLibrary) {
 busy.value = true; error.value = ''
 try { await accessLibrary(value); library.value = value; return true }
 catch { error.value = '保存できませんでした。端末の空き容量やブラウザの保存設定を確認して、もう一度お試しください。'; return false }
 finally { busy.value = false }
}
async function saveFolder() {
 const name = folderName.value.trim(); if (!name) return
 const value = JSON.parse(JSON.stringify(library.value)) as MemoLibrary
 if (renaming.value) { const f = value.folders.find(f => f.id === folderId.value); if (f) f.name = name }
 else { const id = crypto.randomUUID(); value.folders.push({ id, name }); if (await commit(value)) { folderId.value = id; folderName.value = '' }; return }
 if (await commit(value)) { renaming.value = false; folderName.value = '' }
}
function discard() { return !dirty.value || confirm('保存していない変更を破棄しますか？') }
function back() { if (busy.value || !discard()) return; draft.value = null; dirty.value = false; status.value = ''; selection = null }
async function openNote(note?: Memo) {
 draft.value = note ? { ...note } : { id: crypto.randomUUID(), folderId: folderId.value, title: '', html: '', updatedAt: '' }
 dirty.value = !note; status.value = ''; selection = null
 await nextTick(); if (editor.value) editor.value.innerHTML = cleanMemoHtml(draft.value.html)
}
function changed() { dirty.value = true; status.value = '' }
function remember() { const s = window.getSelection(); if (s?.rangeCount && editor.value?.contains(s.anchorNode)) selection = s.getRangeAt(0).cloneRange() }
function focusEditor() {
 editor.value?.focus(); const s = window.getSelection()
 if (selection && editor.value?.contains(selection.commonAncestorContainer)) { s?.removeAllRanges(); s?.addRange(selection) }
}
function format(command: string, value?: string) { focusEditor(); document.execCommand(command, false, value); remember(); changed() }
function paste(event: ClipboardEvent) {
 event.preventDefault()
 const images = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
 if (images.length) { remember(); void addImages(images); return }
 const html = event.clipboardData?.getData('text/html')
 if (html) format('insertHTML', cleanMemoHtml(html))
 else format('insertText', event.clipboardData?.getData('text/plain') || '')
}
async function addImages(files: File[]) {
 if (busy.value) return
 busy.value = true; error.value = ''
 try {
  for (const file of files) {
   if (!file.type.startsWith('image/')) throw new Error('invalid image')
   const blob = await compressImage(file)
   const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
   format('insertHTML', `<img src="${url}" alt="メモの画像"><p><br></p>`)
  }
 } catch { error.value = '画像を追加できませんでした。別の画像でお試しください。' }
 finally { busy.value = false; if (fileInput.value) fileInput.value.value = '' }
}
async function save() {
 if (!draft.value || busy.value) return
 const note = { ...draft.value, title: draft.value.title.trim() || '無題のメモ', html: cleanMemoHtml(editor.value?.innerHTML || ''), updatedAt: new Date().toISOString() }
 const value = { folders: library.value.folders.map(f => ({ ...f })), notes: [...library.value.notes.filter(n => n.id !== note.id).map(n => ({ ...n })), note] }
 saving.value = true
 if (await commit(value)) { draft.value = { ...note }; dirty.value = false; folderId.value = note.folderId; status.value = '保存しました' }
 saving.value = false
}
async function removeNote() {
 if (!draft.value || !confirm('このメモを削除しますか？')) return
 if (await commit({ folders: library.value.folders.map(f => ({ ...f })), notes: library.value.notes.filter(n => n.id !== draft.value!.id).map(n => ({ ...n })) })) { dirty.value = false; back() }
}
async function removeFolder() {
 if (!confirm(`「${folder.value?.name}」と中のメモ${notes.value.length}件を削除しますか？`)) return
 if (await commit({ folders: library.value.folders.filter(f => f.id !== folderId.value).map(f => ({ ...f })), notes: library.value.notes.filter(n => n.folderId !== folderId.value).map(n => ({ ...n })) })) { folderId.value = ''; renaming.value = false; folderName.value = '' }
}
function beforeUnload(e: BeforeUnloadEvent) { if (dirty.value || busy.value) { e.preventDefault(); e.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => !busy.value && discard())
</script>

<template>
 <div class="page memos-page">
  <header class="page-header"><p class="eyebrow">MY NOTEBOOK</p><h1>メモ</h1><p>覚えておきたいこと、心に残ったこと。</p></header>
  <p v-if="loading" role="status">読み込み中…</p>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="!loading && !loadFailed">
   <template v-if="draft">
    <div class="memo-actions"><button class="outline-button" :disabled="busy" @click="back">‹ 一覧へ</button><button class="text-button" :disabled="busy" @click="removeNote">メモを削除</button></div>
    <label class="memo-label">フォルダ<select v-model="draft.folderId" :disabled="busy" @change="changed"><option v-for="f in library.folders" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
    <label class="memo-label">タイトル<input v-model="draft.title" placeholder="無題のメモ" :disabled="busy" @input="changed"></label>
    <div class="memo-toolbar" role="toolbar" aria-label="本文の書式">
     <button v-for="item in [{label:'太字',command:'bold'},{label:'斜体',command:'italic'},{label:'下線',command:'underline'},{label:'見出し',command:'formatBlock',value:'h2'},{label:'本文',command:'formatBlock',value:'p'},{label:'箇条書き',command:'insertUnorderedList'},{label:'番号リスト',command:'insertOrderedList'},{label:'引用',command:'formatBlock',value:'blockquote'},{label:'元に戻す',command:'undo'},{label:'やり直す',command:'redo'}]" :key="item.label" :disabled="busy" @mousedown.prevent @click="format(item.command,'value' in item ? item.value : undefined)">{{ item.label }}</button>
     <button :disabled="busy" @mousedown.prevent @click="remember(); fileInput?.click()">＋ 画像</button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="addImages(Array.from(($event.target as HTMLInputElement).files || []))">
    <div ref="editor" class="memo-editor" :contenteditable="!saving" role="textbox" aria-label="メモ本文" aria-multiline="true" @input="changed" @keyup="remember" @mouseup="remember" @focusout="remember" @paste="paste" @drop.prevent></div>
    <p class="memo-hint">画像はカーソル位置に挿入されます。選択して削除キーで取り除けます。</p>
    <button class="primary-button full" :disabled="busy" @click="save">{{ busy ? '処理中…' : 'メモを保存' }}</button><p role="status" class="memo-hint">{{ status || (dirty ? '未保存の変更があります' : '') }}</p>
   </template>
   <template v-else>
    <div v-if="folder" class="memo-actions"><button class="outline-button" :disabled="busy" @click="folderId='';renaming=false;folderName=''">‹ フォルダ一覧</button><button class="text-button" :disabled="busy" @click="renaming=!renaming;folderName=folder.name">名前を変更</button><button class="text-button" :disabled="busy" @click="removeFolder">削除</button></div>
    <form v-if="!folder || renaming" class="folder-form" @submit.prevent="saveFolder"><label class="memo-label">{{ renaming ? 'フォルダ名を変更' : '新しいフォルダ' }}<input v-model="folderName" required maxlength="100" placeholder="読書、映画、アイデアなど" :disabled="busy"></label><button class="outline-button" :disabled="busy || !folderName.trim()">{{ renaming ? '変更' : '作成' }}</button></form>
    <template v-if="!folder"><p v-if="!library.folders.length" class="soft-card">フォルダを作って、最初のメモを残しましょう。</p><div class="memo-list"><button v-for="f in library.folders" :key="f.id" class="soft-card memo-row" :disabled="busy" @click="folderId=f.id;folderName='' "><b>▱ {{ f.name }}</b><small>{{ library.notes.filter(n=>n.folderId===f.id).length }}件のメモ　›</small></button></div></template>
    <template v-else><h2 class="folder-title">{{ folder.name }}</h2><button class="primary-button full" :disabled="busy" @click="openNote()">＋ メモを作成</button><p v-if="!notes.length" class="memo-hint">このフォルダにはまだメモがありません。</p><div class="memo-list"><button v-for="note in notes" :key="note.id" class="soft-card memo-row" :disabled="busy" @click="openNote(note)"><b>{{ note.title }}</b><small>{{ new Date(note.updatedAt).toLocaleString('ja-JP') }}</small></button></div></template>
    <p class="memo-hint">メモと画像はこの端末のブラウザに保存されます。</p>
   </template>
  </template>
 </div>
</template>

<style scoped>
.memo-actions{display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap}.memo-label{display:flex;flex-direction:column;gap:8px;font-size:.8rem;margin:16px 0;flex:1;min-width:0}.memo-label input,.memo-label select{width:100%;min-height:44px;padding:12px;border:1px solid var(--line);border-radius:12px;background:white;color:var(--text);font:inherit}.folder-form{display:flex;align-items:center;gap:10px}.folder-form button{margin-top:24px}.memo-list{display:grid;gap:12px;margin-top:20px}.memo-row{display:flex;flex-direction:column;text-align:left;gap:8px;width:100%;color:var(--text);cursor:pointer;overflow-wrap:anywhere}.memo-row small,.memo-hint{color:var(--sub);font-size:.75rem;line-height:1.7}.folder-title{overflow-wrap:anywhere}.memo-toolbar{display:flex;flex-wrap:wrap;gap:6px;background:var(--mist);padding:10px;border-radius:14px 14px 0 0}.memo-toolbar button{background:white;border:1px solid var(--line);padding:8px;border-radius:8px;color:var(--forest);min-height:40px;cursor:pointer;font-size:.75rem}.memo-editor{background:white;border:1px solid var(--line);border-radius:0 0 14px 14px;min-height:320px;padding:16px;line-height:1.9;overflow-wrap:anywhere}.memo-editor:focus{outline:2px solid var(--sage);outline-offset:2px}.memo-editor :deep(img){max-width:100%;height:auto;border-radius:8px}.memo-editor :deep(blockquote){border-left:3px solid var(--sage);margin-left:0;padding-left:14px;color:var(--sub)}button:disabled{opacity:.5;cursor:wait}
</style>
