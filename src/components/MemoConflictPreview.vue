<script setup lang="ts">
import { computed } from 'vue'
import { splitMemoContent } from '../lib/memo-html'
import type { Memo, MemoFolder } from '../lib/memo-repository'
const props = defineProps<{ value?: Memo | MemoFolder }>()
const content = computed(() => props.value && 'html' in props.value ? splitMemoContent(props.value.html, props.value.images) : null)
</script>
<template>
 <div class="memo-conflict-preview">
  <p v-if="!value">削除されています</p>
  <template v-else><h4>{{ 'title' in value ? value.title : value.name }}</h4><template v-if="content"><div v-html="content.html"></div><div class="conflict-photos"><img v-for="(image,i) in content.images" :key="i" :src="image" alt="メモの添付写真"></div></template></template>
 </div>
</template>
<style scoped>.memo-conflict-preview{max-height:260px;overflow:auto;overflow-wrap:anywhere;padding:10px;background:var(--surface);border-radius:10px}.memo-conflict-preview h4{margin:4px 0}.conflict-photos{display:flex;flex-wrap:wrap;gap:6px}.conflict-photos img{width:80px;height:80px;object-fit:cover;border-radius:8px}</style>
