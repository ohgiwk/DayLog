<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { deleteConfirmation, finishDeleteConfirmation } from '../lib/delete-confirmation'
import { useRouter } from 'vue-router'
import TrashIcon from './TrashIcon.vue'
const dialog = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()
watch(deleteConfirmation, request => {
 if (request) { dialog.value?.showModal(); cancelButton.value?.focus() }
 else dialog.value?.close()
}, { flush: 'post' })
const stop = useRouter().afterEach(() => finishDeleteConfirmation(false))
onBeforeUnmount(() => { stop(); finishDeleteConfirmation(false) })
</script>
<template>
 <Teleport to="body">
  <dialog ref="dialog" class="delete-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" @cancel.prevent="finishDeleteConfirmation(false)">
   <div class="delete-dialog-icon"><TrashIcon /></div>
   <h2 id="delete-dialog-title">{{ deleteConfirmation?.title }}</h2>
   <p id="delete-dialog-description">{{ deleteConfirmation?.message }}</p>
   <div class="delete-dialog-actions">
    <button ref="cancelButton" type="button" class="cancel-delete" @click="finishDeleteConfirmation(false)">キャンセル</button>
    <button type="button" class="confirm-delete" @click="finishDeleteConfirmation(true)">削除する</button>
   </div>
  </dialog>
 </Teleport>
</template>
<style scoped>
.delete-dialog{width:min(360px,calc(100vw - 40px));max-height:calc(100dvh - 48px);overflow:auto;border:1px solid var(--line);border-radius:24px;padding:26px;background:white;color:var(--text);box-shadow:0 24px 80px #183d3540}
.delete-dialog::backdrop{background:rgba(25,45,39,.45);backdrop-filter:blur(4px)}
.delete-dialog-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:var(--gradient-card);color:var(--forest);margin-bottom:16px}
.delete-dialog h2{font-size:1.15rem;line-height:1.5;margin:0 0 10px}
.delete-dialog p{font-size:.85rem;line-height:1.8;color:var(--sub);margin:0;white-space:pre-line;overflow-wrap:anywhere}
.delete-dialog-actions{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
.delete-dialog-actions button{flex:1;min-height:46px;min-width:110px;padding:10px 12px;border-radius:13px;font-size:.85rem;font-weight:600;cursor:pointer}
.cancel-delete{border:1px solid var(--line);background:white;color:var(--forest)}
.confirm-delete{border:1px solid #a3463e;background:#a3463e;color:white}
.delete-dialog-actions button:focus-visible{outline:2px solid var(--forest);outline-offset:3px}
.confirm-delete:hover{background:#8c3932}
</style>
