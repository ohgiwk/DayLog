<script setup lang="ts">
defineProps<{ src: string }>()
defineEmits<{ open: [event: MouseEvent] }>()
</script>
<template>
 <button v-if="src" type="button" class="diary-cover" aria-label="代表写真を拡大する" @click="$emit('open', $event)">
  <img :src="src" alt="日記の代表写真" />
 </button>
</template>
<style scoped>
.diary-cover{display:block;width:100%;padding:0;border:0;background:var(--mist);cursor:zoom-in}
.diary-cover img{display:block;width:100%;height:auto}
.diary-cover:focus-visible{outline:3px solid var(--forest);outline-offset:-3px}
</style>
