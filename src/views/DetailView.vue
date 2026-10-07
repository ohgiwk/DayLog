<script setup lang="ts">
import { computed, ref } from 'vue'
import TrashIcon from '../components/TrashIcon.vue'
import { useRoute, useRouter } from 'vue-router'
import { diaryState } from '../stores/diary'
import DiaryEditor from '../components/DiaryEditor.vue'
const route=useRoute(),router=useRouter()
const entry = computed(() => diaryState.entries.find(e => e.id === route.params.id))
const editor = ref<InstanceType<typeof DiaryEditor>>()
</script>
<template><div v-if="entry" class="page detail-page"><header class="detail-nav"><button @click="router.back()" aria-label="戻る"><svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7" /></svg></button><button class="diary-trash" aria-label="日記を削除" title="日記を削除" :disabled="!editor || editor.busy" @click="editor?.removeDiary()"><TrashIcon /></button></header><p class="eyebrow">{{new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(entry.date+'T12:00'))}}</p><h1>{{entry.guess}}</h1><div class="tag-list"><span v-for="tag in entry.tags" :key="tag"># {{tag}}</span></div><DiaryEditor ref="editor" :key="entry.id" :initial="entry" @deleted="router.push('/records')"/>
</div><div v-else class="page"><p>この日記は見つかりませんでした。</p><RouterLink to="/records">記録へ戻る</RouterLink></div></template>

<style scoped>
.detail-nav{align-items:center}
.back-icon{display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.detail-nav>button{display:grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;line-height:1}

.detail-nav .diary-trash{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;color:#a6534b}
.detail-nav .diary-trash:hover{background:#f9eeeb}
.detail-nav .diary-trash:disabled{opacity:.5;cursor:wait}
</style>
