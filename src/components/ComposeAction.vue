<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import ComposePlusIcon from './ComposePlusIcon.vue';
defineProps<{ to?: RouteLocationRaw; disabled?: boolean }>();
</script>
<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    :disabled="to ? undefined : disabled"
    class="compose-action"
    ><ComposePlusIcon /><span><slot /></span
  ></component>
</template>
<style scoped>
.compose-action {
  position: fixed;
  z-index: 25;
  right: max(
    18px,
    env(safe-area-inset-right, 0px),
    calc((100vw - var(--app-width)) / 2 + 18px)
  );
  bottom: calc(var(--tabbar-height) + 14px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: max-content;
  max-width: calc(100vw - 32px);
  min-height: 54px;
  padding: 12px 28px;
  border: 0;
  border-radius: 32px;
  background: var(--forest);
  color: white;
  font-size: 1rem;
  line-height: 1.5;
  white-space: nowrap;
  text-decoration: none;
  box-shadow: 0 6px 22px #453b2514;
  cursor: pointer;
  transition: transform 180ms ease;
}
.compose-action > span {
  flex-shrink: 0;
}
.compose-action:active {
  transform: scale(0.96);
}
.compose-action:disabled {
  opacity: 0.5;
  cursor: wait;
}
.compose-action:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 3px;
}
:global(.reduce-motion) .compose-action {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .compose-action {
    transition: none;
  }
}
</style>
