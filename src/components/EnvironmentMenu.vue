<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import TrashIcon from './TrashIcon.vue';
const props = defineProps<{
  label: string;
  disabled?: boolean;
  updateDisabled?: boolean;
  align?: 'start' | 'end';
}>();
const emit = defineEmits<{ update: []; remove: [] }>();
const open = ref(false),
  root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  first = ref<HTMLButtonElement>(),
  last = ref<HTMLButtonElement>();
function close(focus = false) {
  open.value = false;
  if (focus) trigger.value?.focus();
}
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    (props.updateDisabled ? last.value : first.value)?.focus();
  }
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target))
    close();
}
function choose(action: 'update' | 'remove') {
  close(true);
  if (action === 'update') emit('update');
  else emit('remove');
}
function moveFocus(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  if (props.updateDisabled) last.value?.focus();
  else
    (document.activeElement === first.value
      ? last.value
      : first.value
    )?.focus();
}
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div
    ref="root"
    class="environment-menu"
    @pointerdown.stop
    @keydown.esc.stop.prevent="close(true)"
  >
    <button
      ref="trigger"
      type="button"
      class="environment-menu-trigger"
      :aria-label="label + 'のメニュー'"
      :title="label + 'のメニュー'"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled="disabled"
      @click="toggle"
      @keydown.down.prevent="toggle"
      ><AppIcon name="more"
    /></button>
    <Transition name="environment-menu">
      <div
        v-if="open"
        class="environment-menu-panel"
        :class="{ 'align-start': align === 'start' }"
        role="menu"
        :aria-label="label + 'の操作'"
        @keydown="moveFocus"
        @keydown.tab="close()"
      >
        <button
          ref="first"
          type="button"
          role="menuitem"
          :aria-label="label + 'を更新'"
          :disabled="disabled || updateDisabled"
          @click="choose('update')"
          ><AppIcon name="refresh" />更新</button
        >
        <button
          ref="last"
          type="button"
          role="menuitem"
          class="remove"
          :aria-label="label + 'の記録を外す'"
          :disabled="disabled"
          @click="choose('remove')"
          ><TrashIcon />削除</button
        >
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.environment-menu {
  position: relative;
  flex-shrink: 0;
}
.environment-menu .environment-menu-trigger {
  display: grid;
  place-items: center;
  width: 24px;
  min-width: 24px;
  min-height: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--sub);
  opacity: 0.65;
}
.environment-menu .environment-menu-trigger:hover,
.environment-menu .environment-menu-trigger:active,
.environment-menu .environment-menu-trigger[aria-expanded='true'] {
  background: transparent;
  opacity: 1;
}
.environment-menu .environment-menu-trigger :deep(.app-icon) {
  width: 14px;
  height: 14px;
  stroke-width: 2.5;
}
.environment-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  width: 104px;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 4px 14px rgba(32, 50, 44, 0.12);
  transform-origin: top right;
}
.environment-menu-panel.align-start {
  left: 0;
  right: auto;
  transform-origin: top left;
}
.environment-menu .environment-menu-panel button {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 0.75rem;
  white-space: nowrap;
}
.environment-menu .environment-menu-panel button:hover,
.environment-menu .environment-menu-panel button:active {
  background: transparent;
}
.environment-menu-panel :deep(.trash-icon) {
  width: 16px;
  height: 16px;
}
.environment-menu-panel .remove {
  color: #a6534b;
}
.environment-menu-enter-active,
.environment-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.environment-menu-enter-from,
.environment-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
  .environment-menu-enter-active,
  .environment-menu-leave-active {
    transition: none;
  }
  .environment-menu-enter-from,
  .environment-menu-leave-to {
    transform: none;
  }
}
</style>
