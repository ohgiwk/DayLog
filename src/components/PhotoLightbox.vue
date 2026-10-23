<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ photos: { id: string; url: string }[]; initialId: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const viewport = ref<HTMLElement>()
const selectedId = ref(props.initialId)
const index = computed(() => Math.max(0, props.photos.findIndex(photo => photo.id === selectedId.value)))
const dragging = ref(false)
let observer: ResizeObserver | undefined
let previousOverflow: string | undefined
let mouseStart: { id: number; x: number; scroll: number } | undefined
function slides() { return Array.from(viewport.value?.children || []) as HTMLElement[] }
function goTo(position: number, smooth = true) {
 const container = viewport.value, slide = slides()[position]
 if (!container || !slide) return
 const reduced = document.querySelector('.reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
 container.scrollTo({ left: slide.offsetLeft - (container.clientWidth - slide.clientWidth) / 2, behavior: smooth && !reduced ? 'smooth' : 'instant' })
}
function move(direction: number) {
 const next = index.value + direction
 if (props.photos[next]) goTo(next)
}
function onScroll() {
 const container = viewport.value
 if (!container) return
 const center = container.scrollLeft + container.clientWidth / 2
 const nearest = slides().reduce((best, slide, position, all) =>
  Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center) < Math.abs(all[best]!.offsetLeft + all[best]!.clientWidth / 2 - center) ? position : best, 0)
 if (props.photos[nearest]) selectedId.value = props.photos[nearest].id
}
function pointerDown(event: PointerEvent) {
 if (event.pointerType !== 'mouse' || event.button !== 0 || !viewport.value) return
 mouseStart = { id: event.pointerId, x: event.clientX, scroll: viewport.value.scrollLeft }
 dragging.value = true
 viewport.value.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
 if (!mouseStart || mouseStart.id !== event.pointerId || !viewport.value) return
 viewport.value.scrollLeft = mouseStart.scroll + mouseStart.x - event.clientX
}
function pointerEnd(event: PointerEvent) {
 if (!mouseStart || mouseStart.id !== event.pointerId) return
 mouseStart = undefined
 dragging.value = false
 if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId)
 goTo(index.value)
}
function close() { dialog.value?.close() }
function keydown(event: KeyboardEvent) {
 if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
  event.preventDefault()
  move(event.key === 'ArrowLeft' ? -1 : 1)
 }
}
watch(() => props.photos.map(item => item.id), async () => {
 if (!props.photos.length) { close(); return }
 if (!props.photos.some(photo => photo.id === selectedId.value)) selectedId.value = props.photos[0]!.id
 await nextTick()
 goTo(index.value, false)
})
onMounted(() => {
 dialog.value?.showModal()
 previousOverflow = document.body.style.overflow
 document.body.style.overflow = 'hidden'
 goTo(index.value, false)
 observer = new ResizeObserver(() => goTo(index.value, false))
 if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => {
 observer?.disconnect()
 dialog.value?.close()
 if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
})
</script>
<template>
 <Teleport to="body">
  <dialog ref="dialog" class="photo-viewer" aria-label="日記の写真" @close="emit('close')" @keydown="keydown" @click.self="close">
   <div ref="viewport" class="photo-viewer-stage" :class="{dragging}" aria-label="左右にスワイプして写真を切り替え" @scroll.passive="onScroll" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @dragstart.prevent>
    <div v-for="(photo, position) in photos" :key="photo.id" class="viewer-slide" :aria-hidden="position !== index">
     <img :src="photo.url" :alt="`日記の写真 ${position + 1} / ${photos.length}`" draggable="false">
    </div>
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
.photo-viewer{position:fixed;inset:0;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;background:rgba(14,24,20,.96);color:white;overflow:hidden}
.photo-viewer[open]{display:grid;place-items:center;animation:viewer-appear 220ms ease}
.photo-viewer::backdrop{background:transparent}
.photo-viewer-stage{position:relative;display:flex;align-items:center;gap:12px;width:100%;height:calc(100dvh - 160px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));padding:0 7%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;user-select:none;cursor:grab}
.photo-viewer-stage::-webkit-scrollbar{display:none}
.photo-viewer-stage.dragging{scroll-snap-type:none;cursor:grabbing}
.viewer-slide{flex:0 0 100%;min-width:0;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always}
.photo-viewer img{display:block;width:100%;max-height:100%;object-fit:contain;border-radius:6px;pointer-events:none}
.photo-viewer button{position:absolute;display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(255,255,255,.12);color:white;cursor:pointer;backdrop-filter:blur(12px)}
.photo-viewer button:focus-visible{outline:3px solid var(--sage);outline-offset:4px}
.photo-viewer button:disabled{opacity:.25;cursor:default}
.viewer-close{top:calc(16px + env(safe-area-inset-top,0px));right:calc(16px + env(safe-area-inset-right,0px))}
.viewer-previous{left:calc(24% - 22px);bottom:calc(22px + env(safe-area-inset-bottom,0px))}
.viewer-next{right:calc(24% - 22px);bottom:calc(22px + env(safe-area-inset-bottom,0px))}
.viewer-count{position:absolute;bottom:calc(34px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);margin:0;font-size:.85rem;letter-spacing:.12em;pointer-events:none}
@keyframes viewer-appear{from{opacity:0}to{opacity:1}}
:global(.reduce-motion) .photo-viewer[open]{animation:none}
@media(prefers-reduced-motion:reduce){.photo-viewer[open]{animation:none}}
</style>
