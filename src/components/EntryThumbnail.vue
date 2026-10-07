<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { imageRepository } from '../lib/image-repository'
const props = defineProps<{ id?: string; alt?: string }>()
const url = ref(''), failed = ref(false)
let current = '', generation = 0
watch(() => props.id, async id => {
 const request = ++generation
 if (current) URL.revokeObjectURL(current)
 current = ''; url.value = ''; failed.value = false
 if (!id) return
 try {
  const img = await imageRepository.get(id)
  if (request !== generation) return
  if (img) { current = URL.createObjectURL(img.blob); url.value = current }
  else failed.value = true
 } catch { if (request === generation) failed.value = true }
}, { immediate: true })
onBeforeUnmount(() => { generation++; if (current) URL.revokeObjectURL(current) })
</script>
<template><img v-if="url" :src="url" :alt="alt || '日記の写真'" class="entry-thumb"/><span v-else-if="failed" class="entry-thumb" aria-label="写真を読み込めませんでした">写真</span></template>
