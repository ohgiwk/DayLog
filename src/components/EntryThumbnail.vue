<script setup lang="ts">
import { onWatcherCleanup, ref, watch } from 'vue';
import { imageRepository } from '../lib/image-repository';
const props = defineProps<{ id?: string; alt?: string }>();
const url = ref(''),
  failed = ref(false);
watch(
  () => props.id,
  async (id) => {
    let active = true;
    let current = '';
    onWatcherCleanup(() => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    });
    url.value = '';
    failed.value = false;
    if (!id) return;
    try {
      const img = await imageRepository.get(id);
      if (!active) return;
      if (img) {
        current = URL.createObjectURL(img.blob);
        url.value = current;
      } else failed.value = true;
    } catch {
      if (active) failed.value = true;
    }
  },
  { immediate: true },
);
</script>
<template>
  <img
    v-if="url"
    :src="url"
    :alt="alt || '日記の写真'"
    class="entry-thumb"
  /><span
    v-else-if="failed"
    class="entry-thumb"
    aria-label="写真を読み込めませんでした"
    >写真</span
  >
</template>
