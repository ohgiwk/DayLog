<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { blockShortcut, inlineShortcut } from '../lib/markdown-shortcuts'
import { readRichText, sanitizeRichText, writeRichText } from '../lib/rich-text'
const props = defineProps<{ modelValue: string; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const field = ref<HTMLDivElement>()
let lastEmitted: string | undefined
let selection: Range | undefined
function rememberSelection() {
 const current = window.getSelection()
 if (current?.rangeCount && field.value?.contains(current.anchorNode)) selection = current.getRangeAt(0).cloneRange()
}
const menu = ref<'heading' | 'size' | null>(null)
const headings = [{ value: 'p', label: '標準の本文' }, { value: 'h2', label: '大見出し' }, { value: 'h3', label: '中見出し' }, { value: 'h4', label: '小見出し' }]
const sizes = [{ value: '2', label: '小さめ' }, { value: '3', label: '標準' }, { value: '5', label: '大きめ' }]
const tools = [
 { command: 'bold', label: '太字', icon: 'bold' },
 { command: 'italic', label: '斜体', icon: 'italic' },
 { command: 'underline', label: '下線', icon: 'underline' },
 { command: 'insertUnorderedList', label: '箇条書き', icon: 'list-bullet' },
 { command: 'insertOrderedList', label: '番号付きリスト', icon: 'list-number' },
 { command: 'removeFormat', label: '文字の装飾を解除', icon: 'clear-format' },
]
function load() {
 if (!field.value) return
 lastEmitted = undefined
 selection = undefined
 const value = readRichText(props.modelValue)
 if (value.html !== undefined) field.value.innerHTML = sanitizeRichText(value.html)
 else field.value.textContent = value.text
}
function update() {
 if (props.readonly) return
 if (!field.value) return
 lastEmitted = writeRichText(field.value.innerHTML, field.value.innerText)
 emit('update:modelValue', lastEmitted)
}
function format(command: string, value?: string) {
 menu.value = null
 field.value?.focus()
 if (selection && field.value?.contains(selection.commonAncestorContainer)) {
  const current = window.getSelection()
  current?.removeAllRanges()
  current?.addRange(selection)
 }
 document.execCommand('styleWithCSS', false, 'false')
 document.execCommand(command, false, value)
 rememberSelection()
 update()
}
let composing = false, converting = false
function convertMarkdown() {
 const root = field.value, current = window.getSelection()
 if (!root || composing || converting || !current?.isCollapsed || !current.rangeCount) return
 const range = current.getRangeAt(0), node = range.startContainer
 if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return
 const text = (node.textContent || '').slice(0, range.startOffset)
 if ((node.parentElement?.closest('code,pre'))) return
 const block = node.parentElement?.closest('p,div,h2,h3,h4,li,blockquote')
 const before = document.createRange()
 before.setStart(block && root.contains(block) ? block : root, 0)
 before.setEnd(node, range.startOffset)
 const shortcut = blockShortcut(before.toString())
 const inline = inlineShortcut(text)
 if (!shortcut && !inline) return
 converting = true
 try {
  const replacement = range.cloneRange()
  if (shortcut) {
   // Do not toggle an existing list off when typing another list marker.
   if (node.parentElement?.closest('li') || before.toString() !== text) return
   replacement.setStart(node, range.startOffset - before.toString().length)
  } else replacement.setStart(node, inline!.start)
  current.removeAllRanges()
  current.addRange(replacement)
  if (shortcut) {
   document.execCommand('delete')
   document.execCommand(shortcut.command, false, shortcut.value)
  } else {
   document.execCommand('insertHTML', false, inline!.html)
   // Continue outside the new inline formatting.
   const active = window.getSelection()
   const parent = active?.anchorNode?.parentElement
   const formatted = parent?.closest('strong,b,em,i,s,code')
   if (formatted && root.contains(formatted)) {
    const after = document.createRange()
    after.setStartAfter(formatted); after.collapse(true)
    active?.removeAllRanges(); active?.addRange(after)
   }
  }
  rememberSelection()
  update()
 } finally { converting = false }
}
function input(event: Event) {
 update()
 if (!(event as InputEvent).isComposing && !composing && !converting) queueMicrotask(convertMarkdown)
}
function compositionStart() { composing = true }
function compositionEnd() {
 composing = false
 queueMicrotask(() => { convertMarkdown(); update() })
}
function paste(event: ClipboardEvent) {
 if (props.readonly) return
 event.preventDefault()
 const html = event.clipboardData?.getData('text/html')
 if (html) document.execCommand('insertHTML', false, sanitizeRichText(html))
 else document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') || '')
 update()
}
onMounted(load)
watch(() => props.modelValue, value => { if (value !== lastEmitted) load() })
</script>
<template>
 <div class="rich-text-editor" :class="{ readonly }">
  <div v-if="!readonly" class="format-tools" role="group" aria-label="本文の書式">
   <button v-for="tool in tools" :key="tool.command" type="button" :aria-label="tool.label" :title="tool.label" @mousedown.prevent @click="format(tool.command)"><AppIcon :name="tool.icon" /></button>
   <span class="tool-divider" aria-hidden="true"></span>
   <button type="button" aria-label="見出し" title="見出し" :aria-expanded="menu==='heading'" @mousedown.prevent @click="menu=menu==='heading'?null:'heading'"><AppIcon name="heading" /></button>
   <button type="button" aria-label="文字サイズ" title="文字サイズ" :aria-expanded="menu==='size'" @mousedown.prevent @click="menu=menu==='size'?null:'size'"><AppIcon name="text" /></button>
   <div v-if="menu" class="format-menu" role="group" :aria-label="menu==='heading'?'見出しを選択':'文字サイズを選択'" @keydown.esc="menu=null">
    <template v-if="menu==='heading'"><button v-for="item in headings" :key="item.value" type="button" @mousedown.prevent @click="format('formatBlock',item.value)"><AppIcon :name="item.value==='p'?'paragraph':'heading'" />{{item.label}}</button></template>
    <template v-else><button v-for="item in sizes" :key="item.value" type="button" @mousedown.prevent @click="format('fontSize',item.value)"><AppIcon name="text" />{{item.label}}</button></template>
   </div>
  </div>
  <div ref="field" class="rich-text-field" :contenteditable="!readonly" :role="readonly ? undefined : 'textbox'" :aria-readonly="readonly || undefined" aria-label="今日のこと" aria-multiline="true" :data-placeholder="readonly ? '本文はまだありません。' : '今日のできごとや気持ちを自由に書いてください'" @focus="menu=null" @keydown.esc="menu=null" @input="input" @compositionstart="compositionStart" @compositionend="compositionEnd" @keyup="rememberSelection" @mouseup="rememberSelection" @focusout="rememberSelection" @paste="paste" @drop.prevent></div>
 </div>
</template>
<style scoped>
.rich-text-editor{margin:8px 0 20px;border:1px solid var(--line);border-radius:18px;background:white;overflow:hidden}
.rich-text-editor.readonly{border:0;background:transparent;overflow:visible}
.readonly .rich-text-field{min-height:0;padding:8px 0}
.rich-text-editor:focus-within{outline:2px solid var(--sage)}
.format-tools{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:6px;border-bottom:1px solid var(--line);background:var(--paper)}
.format-tools button{border:0;border-radius:8px;background:transparent;color:var(--forest);display:grid;place-items:center;width:32px;height:36px;flex-shrink:0;padding:6px;font-size:.78rem;cursor:pointer}
.format-tools button:hover{background:var(--mist)}
.format-tools button:focus-visible{outline:2px solid var(--sage)}
.tool-divider{height:18px;width:1px;background:var(--line);margin:0 2px}
.format-tools button[aria-expanded="true"]{background:var(--mist)}
.format-menu{position:absolute;z-index:5;top:calc(100% - 2px);right:6px;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--line);border-radius:12px;background:white;box-shadow:var(--shadow)}
.format-menu button{display:flex;justify-content:flex-start;gap:8px;width:auto;min-width:130px;padding:6px 10px;white-space:nowrap}
.rich-text-field{min-height:260px;padding:15px;outline:none;font-size:max(16px,1rem);line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
.rich-text-field:empty:before{content:attr(data-placeholder);color:var(--sub);pointer-events:none}
.rich-text-field :deep(p),.rich-text-field :deep(div){margin:0}
.rich-text-field :deep(ul),.rich-text-field :deep(ol){padding-left:1.5em;margin:8px 0}
.rich-text-field :deep(h2){font-size:1.6em;line-height:1.5;margin:16px 0 8px}
.rich-text-field :deep(h3){font-size:1.3em;line-height:1.5;margin:14px 0 6px}
.rich-text-field :deep(h4){font-size:1.1em;line-height:1.5;margin:12px 0 6px}
.rich-text-field :deep(font[size="2"]){font-size:.8em}
.rich-text-field :deep(font[size="3"]){font-size:1em}
.rich-text-field :deep(font[size="5"]){font-size:1.4em}
.rich-text-field :deep(blockquote){margin:10px 0;padding-left:12px;border-left:3px solid var(--sage);color:var(--sub)}
.rich-text-field :deep(code){padding:2px 5px;border-radius:4px;background:var(--mist);font-family:monospace}
</style>
