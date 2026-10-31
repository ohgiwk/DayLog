<script setup lang="ts">
import {
  useTemplateRef,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';
import type { DiaryEntry } from '../types';
import DiaryComposeHeader from '../components/DiaryComposeHeader.vue';
import DiaryComposeMode from '../components/DiaryComposeMode.vue';
import AppIcon from '../components/AppIcon.vue';
import TrashIcon from '../components/TrashIcon.vue';
import { useRoute, useRouter } from 'vue-router';
import { diaryState } from '../stores/diary';
import DiaryEditor from '../components/DiaryEditor.vue';
import DiaryQuestions from '../components/DiaryQuestions.vue';
import { fadeView } from '../lib/fade-view';
const route = useRoute(),
  router = useRouter();
const deletingEntry = shallowRef<DiaryEntry>();
const entry = computed(
  () =>
    diaryState.entries.find((e) => e.id === route.params.id) ||
    deletingEntry.value,
);
const editing = computed(() => route.query.edit === '1');
watch(
  () => route.params.id,
  () => {
    questionsOpen.value = false;
    closeMenu();
  },
);
function toggleEditing() {
  if (!editor.value || editor.value.busy) return;
  if (editing.value && !editor.value.finishEditing()) return;
  const query = { ...route.query };
  if (editing.value) delete query.edit;
  else query.edit = '1';
  void router.replace({ path: route.path, query });
  closeMenu();
}
const editor = useTemplateRef('editor');
const page = useTemplateRef('page');
const switchingQuestions = ref(false);
const questionsOpen = ref(false);
const questionAnswers = ref<Record<string, string>>({});
let editorScroll = 0;
async function startQuestions() {
  if (
    !editing.value ||
    !editor.value ||
    editor.value.busy ||
    switchingQuestions.value
  )
    return;
  closeMenu();
  editorScroll = window.scrollY;
  questionAnswers.value = editor.value.getAnswers();
  switchingQuestions.value = true;
  try {
    await fadeView(page.value, async () => {
      questionsOpen.value = true;
      await nextTick();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  } finally {
    switchingQuestions.value = false;
  }
}
function saveQuestionAnswers(answers: Record<string, string>) {
  return editor.value?.applyAnswers(answers) ?? false;
}
async function finishQuestions(answers: Record<string, string>) {
  if (switchingQuestions.value) return;
  switchingQuestions.value = true;
  try {
    await fadeView(page.value, async () => {
      editor.value?.applyAnswers(answers);
      questionsOpen.value = false;
      await nextTick();
      window.scrollTo({ top: editorScroll, behavior: 'instant' });
    });
  } finally {
    switchingQuestions.value = false;
  }
}
const menuOpen = ref(false);
const menuRoot = useTemplateRef('menuRoot');
const menuButton = useTemplateRef('menuButton');
const deleteButton = useTemplateRef('deleteButton');
function closeMenu(restoreFocus = false) {
  menuOpen.value = false;
  if (restoreFocus) menuButton.value?.focus();
}
async function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) {
    await nextTick();
    deleteButton.value?.focus();
  }
}
function outsideMenu(event: PointerEvent) {
  if (event.target instanceof Node && !menuRoot.value?.contains(event.target))
    closeMenu();
}
onMounted(() => document.addEventListener('pointerdown', outsideMenu));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outsideMenu));
async function removeDiary() {
  closeMenu(true);
  const target = editor.value;
  if (!target || target.busy) return;
  // Keep the editor mounted until its deletion completes and emits the navigation event.
  deletingEntry.value = entry.value;
  try {
    await target.removeDiary();
  } finally {
    if (diaryState.entries.some((e) => e.id === deletingEntry.value?.id))
      deletingEntry.value = undefined;
  }
}
</script>
<template>
  <div
    v-if="entry"
    ref="page"
    class="page detail-page"
    :class="{ 'is-editing': editing }"
    ><DiaryQuestions
      v-if="questionsOpen"
      :initial-answers="questionAnswers"
      :save-answers="saveQuestionAnswers"
      @complete="finishQuestions"
    /><div v-show="!questionsOpen" class="detail-editor"
      ><DiaryComposeHeader
        v-if="editing"
        title="日記を編集"
        show-complete
        :complete-disabled="!editor || editor.busy"
        @complete="toggleEditing"
        :status="editor?.saveStatus"
        :state="editor?.saveState"
        @back="router.push('/records')"
      /><header v-else class="detail-nav"
        ><button @click="router.push('/records')" aria-label="戻る"
          ><svg
            class="back-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m15 5-7 7 7 7" /></svg></button
        ><span class="read-nav-title">日記</span
        ><button
          type="button"
          class="mode-toggle"
          :disabled="!editor || editor.busy"
          :aria-label="editing ? '編集を完了して閲覧モードへ' : '日記を編集'"
          @click="toggleEditing"
          >{{ editing ? '完了' : '編集' }}</button
        ><div
          ref="menuRoot"
          class="diary-menu"
          @pointerdown.stop
          @keydown.esc.stop.prevent="closeMenu(true)"
          ><button
            ref="menuButton"
            type="button"
            class="diary-menu-trigger"
            aria-label="日記のメニュー"
            title="日記のメニュー"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            aria-controls="diary-actions"
            @click="toggleMenu"
            @keydown.down.prevent="toggleMenu"
            ><AppIcon name="more" /></button
          ><Transition name="diary-menu"
            ><div
              v-if="menuOpen"
              id="diary-actions"
              class="diary-menu-panel"
              role="menu"
              aria-label="日記の操作"
              ><button
                ref="deleteButton"
                type="button"
                role="menuitem"
                class="diary-delete"
                :disabled="!editor || editor.busy"
                @click="removeDiary"
                ><TrashIcon />日記を削除</button
              ></div
            ></Transition
          ></div
        ></header
      ><DiaryEditor
        ref="editor"
        :key="entry.id"
        :initial="entry"
        :readonly="!editing"
        :compose="editing"
        @deleted="router.replace('/records')"
        ><template #mode
          ><DiaryComposeMode
            :disabled="!editor || editor.busy || switchingQuestions"
            @questions="startQuestions" /></template
      ></DiaryEditor>
    </div> </div
  ><div v-else class="page"
    ><p>この日記は見つかりませんでした。</p
    ><RouterLink to="/records">記録へ戻る</RouterLink></div
  >
</template>

<style scoped>
/* Clip without creating a scroll container that doubles the iOS sticky inset. */
:global(.app-shell:has(.detail-page)) {
  overflow: clip;
}

.detail-page {
  position: relative;
  isolation: isolate;
  padding-top: 0;
}
.detail-editor {
  padding-bottom: 80px;
}
.detail-nav {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 12px 0;
  background: var(--paper);
}
.read-nav-title {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}
.detail-nav > .mode-toggle {
  width: auto;
  padding: 0 18px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--surface);
  color: var(--forest);
  font-size: 0.85rem;
}
.diary-date {
  margin: 0 0 16px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--sub);
}
.back-icon {
  display: block;
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.diary-menu {
  position: relative;
}
.diary-menu-trigger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--forest);
  cursor: pointer;
  transition:
    transform 160ms ease,
    background-color 160ms ease;
}
.diary-menu-trigger:active {
  transform: scale(0.88);
}
.diary-menu-trigger :deep(.app-icon) {
  width: 24px;
  height: 24px;
  stroke-width: 3.5;
}
.diary-menu-trigger:hover,
.diary-menu-trigger:active,
.diary-menu-trigger[aria-expanded='true'] {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.diary-menu-enter-active,
.diary-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
  transform-origin: top right;
}
.diary-menu-enter-from,
.diary-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.94);
}
.diary-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 170px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.diary-menu .diary-delete {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #a6534b;
  font-size: 0.8rem;
  white-space: nowrap;
  cursor: pointer;
}
.diary-delete:hover {
  background: #f9eeeb;
}
.diary-delete:disabled {
  opacity: 0.5;
  cursor: wait;
}
.diary-menu button:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .diary-menu-trigger,
  .diary-menu-enter-active,
  .diary-menu-leave-active {
    transition: none;
  }
  .diary-menu-trigger:active,
  .diary-menu-enter-from,
  .diary-menu-leave-to {
    transform: none;
  }
}
:global(.reduce-motion) .diary-menu-trigger,
:global(.reduce-motion) .diary-menu-enter-active,
:global(.reduce-motion) .diary-menu-leave-active {
  transition: none;
}
:global(.reduce-motion) .diary-menu-trigger:active,
:global(.reduce-motion) .diary-menu-enter-from,
:global(.reduce-motion) .diary-menu-leave-to {
  transform: none;
}

.detail-nav > button {
  line-height: 1;
  padding: 0;
  min-height: 44px;
  height: 44px;
  width: 44px;
  place-items: center;
  display: grid;
  transition:
    transform 160ms ease,
    background-color 160ms ease;
}
.detail-nav > button:active {
  transform: scale(0.88);
}
@media (prefers-reduced-motion: reduce) {
  .detail-nav > button {
    transition: none;
  }
  .detail-nav > button:active {
    transform: none;
  }
}
:global(.reduce-motion) .detail-nav > button {
  transition: none;
}
:global(.reduce-motion) .detail-nav > button:active {
  transform: none;
}
.detail-page.is-editing {
  background: var(--paper);
}
.is-editing .detail-editor {
  padding-bottom: max(18px, env(safe-area-inset-bottom));
}
</style>
