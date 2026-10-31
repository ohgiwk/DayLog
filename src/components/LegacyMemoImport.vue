<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  importLegacyMemos,
  legacyMemos,
  memoOwner,
  readMemoSnapshot,
} from '../lib/memo-repository';
import { syncMemos } from '../lib/memo-sync';
const available = ref(false),
  count = ref(0),
  busy = ref(false),
  error = ref('');
const owner = memoOwner();
onMounted(async () => {
  try {
    const [old, snapshot] = await Promise.all([
      legacyMemos(),
      readMemoSnapshot(owner),
    ]);
    count.value = old.notes.length;
    available.value =
      !snapshot.imported && !!(old.folders.length || old.notes.length);
  } catch {
    error.value = '以前のメモを確認できませんでした。再読み込みしてください。';
  }
});
async function importMemos() {
  if (busy.value || memoOwner() !== owner) return;
  busy.value = true;
  error.value = '';
  try {
    await importLegacyMemos(owner);
    available.value = false;
    await syncMemos();
  } catch {
    error.value =
      '取り込めませんでした。元のメモは端末に残っています。もう一度お試しください。';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div v-if="available || error" class="legacy-memos">
    <template v-if="available"
      ><p
        >この端末に以前のメモが{{
          count
        }}件あります。フォルダ・写真と一緒に、現在のアカウントへ取り込めます。</p
      ><button class="outline-button" :disabled="busy" @click="importMemos">{{
        busy ? '取り込み中…' : '以前のメモを取り込む'
      }}</button
      ><small>元の端末データは残ります。</small></template
    >
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.legacy-memos {
  padding: 12px;
  margin: 12px 0;
  border: 1px solid var(--line);
  border-radius: 14px;
}
.legacy-memos p {
  font-size: 0.78rem;
  line-height: 1.7;
}
.legacy-memos small {
  display: block;
  margin-top: 8px;
  color: var(--sub);
  font-size: 0.7rem;
}
.legacy-memos button {
  min-height: 44px;
}
</style>
