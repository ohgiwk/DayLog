<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { DiaryEntry } from '../types'
import AppIcon from '../components/AppIcon.vue'
import TrashIcon from '../components/TrashIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import { diaryState } from '../stores/diary'
import DiaryEditor from '../components/DiaryEditor.vue'
const route=useRoute(),router=useRouter()
const deletingEntry = shallowRef<DiaryEntry>()
const entry = computed(() => diaryState.entries.find(e => e.id === route.params.id) || deletingEntry.value)
const editor = ref<InstanceType<typeof DiaryEditor>>()
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
<template><div v-if="entry" class="page detail-page"><header class="detail-nav"><button @click="router.back()" aria-label="戻る"><svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg></button><div ref="menuRoot" class="diary-menu" @pointerdown.stop @keydown.esc.stop.prevent="closeMenu(true)"><button ref="menuButton" type="button" class="diary-menu-trigger" aria-label="日記のメニュー" title="日記のメニュー" aria-haspopup="menu" :aria-expanded="menuOpen" aria-controls="diary-actions" @click="toggleMenu" @keydown.down.prevent="toggleMenu"><AppIcon name="more" /></button><div v-if="menuOpen" id="diary-actions" class="diary-menu-panel" role="menu" aria-label="日記の操作"><button ref="deleteButton" type="button" role="menuitem" class="diary-delete" :disabled="!editor || editor.busy" @click="removeDiary"><TrashIcon />日記を削除</button></div></div></header><p class="diary-date">{{new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(entry.date+'T12:00'))}}</p><DiaryEditor ref="editor" :key="entry.id" :initial="entry" @deleted="router.replace('/records')"/>
</div><div v-else class="page"><p>この日記は見つかりませんでした。</p><RouterLink to="/records">記録へ戻る</RouterLink></div></template>

<style scoped>
.detail-nav{align-items:center}
.diary-date{margin:0 0 16px;font-size:.8rem;line-height:1.6;color:var(--sub)}
.back-icon{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.detail-nav>button{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;line-height:1}

.diary-menu{position:relative}
.diary-menu-trigger{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;border:0;border-radius:12px;background:transparent;color:var(--forest);cursor:pointer}
.diary-menu-trigger :deep(.app-icon){width:24px;height:24px;stroke-width:3.5}
.diary-menu-trigger:hover,.diary-menu-trigger[aria-expanded="true"]{background:var(--mist)}
.diary-menu-panel{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:170px;padding:6px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow)}
.diary-menu .diary-delete{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:9px;background:transparent;color:#a6534b;font-size:.8rem;white-space:nowrap;cursor:pointer}
.diary-delete:hover{background:#f9eeeb}
.diary-delete:disabled{opacity:.5;cursor:wait}
.diary-menu button:focus-visible{outline:2px solid var(--forest);outline-offset:2px}
</style>
