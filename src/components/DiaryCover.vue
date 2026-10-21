<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { coverOpacity, coverOffset } from '../lib/cover-pull'
defineProps<{ src: string }>()
const space = ref<HTMLElement>()
const visible = ref(false)
const left = ref(0), width = ref(0), opacity = ref(coverOpacity(window.scrollY)), offset = ref(coverOffset(window.scrollY))
let observer: ResizeObserver | undefined, frame = 0
function measure() {
 const bounds = space.value?.getBoundingClientRect()
 visible.value = !!bounds && bounds.width > 0 && !!space.value?.getClientRects().length
 if (bounds && bounds.width > 0) { left.value = bounds.left; width.value = bounds.width }
}
function scroll() {
 if (frame) return
 frame = requestAnimationFrame(() => { opacity.value = coverOpacity(window.scrollY); offset.value = coverOffset(window.scrollY); frame = 0 })
}
onMounted(() => {
 measure()
 observer = new ResizeObserver(measure)
 if (space.value) observer.observe(space.value)
 window.addEventListener('resize',measure)
 window.addEventListener('scroll',scroll,{passive:true})
 scroll()
})
watch(space, node => {
 observer?.disconnect()
 if (node) { measure(); observer?.observe(node) }
}, {flush:'post'})
onBeforeUnmount(() => {
 observer?.disconnect()
 cancelAnimationFrame(frame)
 window.removeEventListener('resize',measure)
 window.removeEventListener('scroll',scroll)
})
</script>
<template>
 <div v-if="src" ref="space" class="diary-cover-space" aria-hidden="true">
  <div class="diary-cover" :class="{'status-photo-visible':visible}" :style="{left:left+'px',width:width?width+'px':'100%',height:'calc(360px + env(safe-area-inset-top,0px))',opacity,transform:`translate3d(0,${offset}px,0)`}"><img :src="src" alt="" /></div>
 </div>
</template>
<style scoped>
.diary-cover-space{width:100%;height:360px;pointer-events:none}
.diary-cover{position:fixed;top:0;z-index:-1;height:360px;overflow:hidden;pointer-events:none;mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%);will-change:opacity,transform}
.diary-cover img{display:block;width:100%;height:calc(360px + env(safe-area-inset-top,0px));object-fit:cover;object-position:center center}
@media(prefers-reduced-motion:reduce){.diary-cover-space,.diary-cover,.diary-cover img{transition:none}}
</style>
