<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
defineEmits<{ questions: [] }>();
</script>
<template>
  <div class="compose-mode" role="group" aria-label="日記の入力モード"
    ><button type="button" aria-pressed="true">自由に書く</button
    ><button type="button" :disabled="disabled" @click="$emit('questions')"
      >質問に答える</button
    ></div
  >
</template>
<style scoped>
.compose-mode {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 24px;
}
button {
  border: 0;
  border-radius: 22px;
  padding: 8px 20px;
  background: none;
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
}
button[aria-pressed='true'] {
  background: var(--forest);
  color: white;
}
button:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 3px;
}
@media (max-width: 460px) {
  button {
    padding: 7px 14px;
    font-size: 0.75rem;
  }
}
</style>
