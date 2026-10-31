<script setup lang="ts">
import AppIcon from './AppIcon.vue';
withDefaults(
  defineProps<{
    title?: string;
    showComplete?: boolean;
    completeDisabled?: boolean;
    status?: string;
    state?: 'empty' | 'saving' | 'saved' | 'error';
  }>(),
  {
    title: '新しい日記',
    status: '確認中…',
    state: 'empty',
  },
);
defineEmits<{ back: []; complete: [] }>();
</script>
<template>
  <header class="compose-header" :class="{ 'has-complete': showComplete }"
    ><button type="button" aria-label="戻る" @click="$emit('back')"
      ><AppIcon name="chevron-left" /></button
    ><h1>{{ title }}</h1
    ><div class="header-actions"
      ><button
        v-if="showComplete"
        type="button"
        class="complete-button"
        :disabled="completeDisabled"
        @click="$emit('complete')"
        >完了</button
      ><span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :class="['save-status', state]"
        :title="state === 'saved' ? 'この端末に保存済みです' : undefined"
        ><AppIcon
          v-if="state !== 'empty'"
          :name="
            state === 'saved'
              ? 'check'
              : state === 'error'
                ? 'save-error'
                : 'more'
          "
        />{{ status }}</span
      ></div
    ></header
  >
</template>
<style scoped>
.compose-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  height: 60px;
  margin-bottom: 12px;
}
button {
  display: grid;
  place-items: center;
  justify-self: start;
  width: 44px;
  height: 44px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--forest);
  cursor: pointer;
}
.compose-header h1 {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: normal;
}
.save-status {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--forest);
}
.save-status .app-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--forest);
  color: white;
  padding: 3px;
}
.save-status.empty {
  color: var(--sub);
}
.save-status.error {
  color: #a6534b;
}
.save-status.error .app-icon {
  background: #a6534b;
}
.save-status.saving .app-icon {
  background: var(--mist);
  color: var(--forest);
}
.compose-header.has-complete {
  grid-template-columns: 44px minmax(0, 1fr) auto;
}
.header-actions {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-actions .complete-button {
  width: auto;
  height: 36px;
  padding: 0 12px;
  border-radius: 18px;
  background: var(--mist);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
.complete-button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible {
  outline: 2px solid var(--forest);
  border-radius: 8px;
}
@media (max-width: 460px) {
  .compose-header h1 {
    font-size: 1rem;
  }
  .save-status {
    font-size: 0.65rem;
  }
}
</style>
