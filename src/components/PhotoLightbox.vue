<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ photos: { id: string; url: string }[]; initialId: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const selectedId = ref(props.initialId)
const index = computed(() => props.photos.findIndex(photo => photo.id === selectedId.value))
const photo = computed(() => props.photos[index.value])
function move(direction: number) {
 const next = props.photos[index.value + direction]
 if (next) selectedId.value = next.id
}
let touchStart: { x: number; y: number } | undefined
function startSwipe(event: TouchEvent) {
 const touch = event.touches[0]
 touchStart = touch ? { x: touch.clientX, y: touch.clientY } : undefined
}
function finishSwipe(event: TouchEvent) {
 const touch = event.changedTouches[0], start = touchStart
 touchStart = undefined
 if (!touch || !start) return
 const dx = touch.clientX - start.x, dy = touch.clientY - start.y
 if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
}
function close() { dialog.value?.close() }
function keydown(event: KeyboardEvent) {
 if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
  event.preventDefault()
  move(event.key === 'ArrowLeft' ? -1 : 1)
 }
}
watch(() => props.photos.map(item => item.id), () => {
 if (!photo.value) {
  if (props.photos[0]) selectedId.value = props.photos[0].id
  else close()
 }
})
let previousOverflow: string | undefined
onMounted(() => {
 dialog.value?.showModal()
 previousOverflow = document.body.style.overflow
 document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
 dialog.value?.close()
 if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
})
</script>
<template>
 <Teleport to="body">
  <dialog ref="dialog" class="photo-viewer" aria-label="日記の写真" @close="emit('close')" @keydown="keydown" @click.self="close">
   <div v-if="photo" class="photo-viewer-stage" @touchstart.passive="startSwipe" @touchend.passive="finishSwipe" @touchcancel="touchStart=undefined" @dragstart.prevent>
    <img :src="photo.url" :alt="`日記の写真 ${index + 1} / ${photos.length}`" draggable="false">
   </div>
   <button type="button" class="viewer-close" aria-label="画像を閉じる" autofocus @click="close"><AppIcon name="close" /></button>
   <template v-if="photos.length > 1">
    <button type="button" class="viewer-previous" aria-label="前の写真" :disabled="index <= 0" @click="move(-1)"><AppIcon name="chevron-left" /></button>
    <button type="button" class="viewer-next" aria-label="次の写真" :disabled="index >= photos.length - 1" @click="move(1)"><AppIcon name="chevron-right" /></button>
    <p class="viewer-count" role="status" aria-live="polite">{{ index + 1 }} / {{ photos.length }}</p>
   </template>
  </dialog>
 </Teleport>
</template>
<style scoped>
.photo-viewer{position:fixed;inset:0;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;background:rgba(14,24,20,.94);color:white;overflow:hidden}
.photo-viewer[open]{display:grid;place-items:center;animation:viewer-appear 220ms ease}
.photo-viewer::backdrop{background:transparent}
.photo-viewer-stage{display:flex;align-items:center;justify-content:center;max-width:100%;max-height:100%;user-select:none}
.photo-viewer img{display:block;max-width:100%;max-height:calc(100dvh - 140px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));object-fit:contain;border-radius:12px}
.photo-viewer button{position:absolute;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.9);color:var(--forest);cursor:pointer}
.photo-viewer button:focus-visible{outline:3px solid var(--sage);outline-offset:4px}
.photo-viewer button:disabled{opacity:.3;cursor:default}
.viewer-close{top:calc(16px + env(safe-area-inset-top,0px));right:calc(16px + env(safe-area-inset-right,0px))}
.viewer-previous{left:calc(12px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%)}
.viewer-next{right:calc(12px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%)}
.viewer-count{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);margin:0;font-size:.85rem;pointer-events:none}
@keyframes viewer-appear{from{opacity:0}to{opacity:1}}
:global(.reduce-motion) .photo-viewer[open]{animation:none}
@media(prefers-reduced-motion:reduce){.photo-viewer[open]{animation:none}}
</style>
