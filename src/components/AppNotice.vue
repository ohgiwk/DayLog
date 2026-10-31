<script setup lang="ts">
import { inject } from 'vue';
defineProps<{ error?: boolean }>();
const target = inject<string | null>('app-notification-target', null);
</script>
<template>
  <Teleport :to="target || 'body'" :disabled="!target">
    <div
      class="app-notice"
      :class="{ 'is-error': error }"
      :role="error ? 'alert' : 'status'"
      ><slot
    /></div>
  </Teleport>
</template>
<style scoped>
.app-notice {
  flex-shrink: 0;
  pointer-events: auto;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 4px 18px rgba(31, 61, 50, 0.14);
  background: #edf4ef;
  color: var(--forest);
  font-size: 0.78rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.app-notice.is-error {
  background: #fff2dc;
  border-color: #ead6b5;
  color: #77551e;
}
</style>
