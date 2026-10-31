<script setup lang="ts">
import { dateKey } from '../lib/records-calendar';
import { journalDate } from '../lib/journal-date';
import AppNotice from './AppNotice.vue';
import AppIcon from './AppIcon.vue';
import DiaryEnvironmentPanel from './DiaryEnvironmentPanel.vue';
import PhotoLightbox from './PhotoLightbox.vue';
import DiaryCover from './DiaryCover.vue';
import RichTextEditor from './RichTextEditor.vue';

import {
  useTemplateRef,
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import type { DiaryEntry, DiaryEnvironment } from '../types';
import { diaryScope, entries, saveEntry, deleteEntry } from '../stores/diary';
import { compressImage, imageRepository } from '../lib/image-repository';
import { confirmDelete } from '../lib/delete-confirmation';
import TrashIcon from './TrashIcon.vue';
import { buildGuess } from '../data/questions';
import { editAnswers } from '../lib/edit-answer';
import { registerUpdatePreparation } from '../lib/update-preparation';
import { hasDiaryContent } from '../lib/diary-content';
const props = defineProps<{
  initial: DiaryEntry;
  isNew?: boolean;
  compose?: boolean;
  readonly?: boolean;
}>();
const composing = computed(
  () => !props.readonly && (props.isNew || props.compose),
);
const emit = defineEmits<{ deleted: [] }>();
const owner = diaryScope.userId,
  ownerGeneration = diaryScope.generation;
const sameOwner = () =>
  owner === diaryScope.userId && ownerGeneration === diaryScope.generation;
const draft = reactive<DiaryEntry>(JSON.parse(JSON.stringify(props.initial)));
const suggestedTitle = computed(() => buildGuess(draft.answers).text);
const titleInput = computed({
  get: () =>
    props.isNew && draft.guess === suggestedTitle.value ? '' : draft.guess,
  set: (value: string) => {
    draft.guess = value;
  },
});
const tagDialog = useTemplateRef('tagDialog');
const tagTrigger = useTemplateRef('tagTrigger');
const tagInput = ref('');
const suggestedTags = computed(() =>
  [
    ...new Set(
      entries.value
        .filter((entry) => entry.id !== draft.id)
        .flatMap((entry) => entry.tags),
    ),
  ]
    .filter((tag) => !draft.tags.includes(tag))
    .sort((a, b) => a.localeCompare(b, 'ja')),
);
function selectTag(tag: string) {
  if (!draft.tags.includes(tag)) {
    draft.tags = [...draft.tags, tag];
    save();
  }
}
function openTags() {
  tagInput.value = '';
  tagDialog.value?.showModal();
}
function closeTags() {
  tagDialog.value?.close();
  tagInput.value = '';
  tagTrigger.value?.focus();
}
function addTag() {
  const tag = tagInput.value
    .normalize('NFKC')
    .trim()
    .replace(/^[#＃]+/, '')
    .trim();
  if (!tag) return;
  selectTag(tag);
  tagInput.value = '';
}
function removeTag(tag: string) {
  draft.tags = draft.tags.filter((value) => value !== tag);
  save();
}
const previewOrigin = ref<{
  left: number;
  top: number;
  width: number;
  height: number;
}>();
function openPhoto(id: string, event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  previewOrigin.value = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
  lightbox.value = id;
}
const photoPicker = useTemplateRef('photoPicker');
const cameraPicker = useTemplateRef('cameraPicker');
const photos = ref<{ id: string; url: string }[]>([]);
const coverId = computed(() =>
  draft.imageIds.includes(draft.thumbnailImageId || '')
    ? draft.thumbnailImageId!
    : draft.imageIds[0],
);
const coverUrl = computed(
  () => photos.value.find((photo) => photo.id === coverId.value)?.url || '',
);
const collectionPhotos = computed(() =>
  photos.value.filter((photo) => !coverUrl.value || photo.id !== coverId.value),
);
const dateLabel = computed(() => {
  const date = new Date(draft.date + 'T12:00:00');
  const day = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(
    date,
  );
  return `${day}（${weekday}）`;
});
const saveError = ref(''),
  photoError = ref(''),
  busy = ref(false),
  lightbox = ref('');
let unsaved = false,
  disposed = false,
  deleted = false,
  batchingChanges = false;
const persisted = ref(!props.isNew);
const saving = ref(false);
const recentlySaved = ref(false);
let saveFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
const photoSaveFailed = ref(false);
let pending: Promise<void> | undefined;
function save() {
  if (!sameOwner()) return false;
  if (deleted) return true;
  if (!persisted.value && !hasDiaryContent(draft)) {
    unsaved = false;
    saveError.value = '';
    return true;
  }
  saving.value = true;
  try {
    const timestamp = new Date().toISOString();
    saveEntry({
      ...draft,
      answers: { ...draft.answers },
      tags: [...draft.tags],
      imageIds: [...draft.imageIds],
      updatedAt: timestamp,
    });
    persisted.value = true;
    recentlySaved.value = true;
    clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = setTimeout(() => {
      recentlySaved.value = false;
    }, 1600);
    unsaved = false;
    saveError.value = '';
    return true;
  } catch {
    unsaved = true;
    saveError.value =
      '自動保存できませんでした。端末の空き容量やブラウザの保存設定を確認してください。';
    return false;
  } finally {
    saving.value = false;
  }
}
// Text is persisted synchronously on each input, including the last keystroke before leaving.
watch(
  () => [draft.guess, draft.body, draft.tomorrow, draft.thumbnailImageId],
  () => {
    if (!batchingChanges) save();
  },
  { flush: 'sync' },
);
onMounted(async () => {
  if (props.isNew) save();
  for (const id of draft.imageIds) {
    try {
      const photo = await imageRepository.get(id);
      if (disposed) return;
      if (photo)
        photos.value.push({ id, url: URL.createObjectURL(photo.blob) });
      else
        photoError.value =
          '読み込めない写真があります。保存されている写真の情報は保持しています。';
    } catch {
      if (!disposed)
        photoError.value =
          '写真を読み込めませんでした。画面を開き直してください。';
    }
  }
});
function addFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (busy.value || !files.length) return;
  if (draft.imageIds.length + files.length > 10) {
    photoError.value = '写真は10枚まで追加できます。';
    return;
  }
  busy.value = true;
  photoSaveFailed.value = false;
  photoError.value = '';
  pending = (async () => {
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/'))
          throw new Error('Unsupported image');
        const blob = await compressImage(file),
          id = crypto.randomUUID();
        if (disposed || !sameOwner()) return;
        await imageRepository.put(
          {
            id,
            entryId: draft.id,
            blob,
            type: blob.type,
            createdAt: new Date().toISOString(),
          },
          owner,
        );
        if (disposed || !sameOwner()) return;
        // Publish the image reference only after its transaction has committed.
        draft.imageIds.push(id);
        photos.value.push({ id, url: URL.createObjectURL(blob) });
        if (!draft.thumbnailImageId) draft.thumbnailImageId = id;
        save();
      } catch {
        photoSaveFailed.value = true;
        photoError.value =
          '写真を保存できませんでした。別の画像や端末の空き容量を確認して、もう一度追加してください。';
      }
    }
  })().finally(() => {
    busy.value = false;
    pending = undefined;
  });
}
async function removePhoto(id: string) {
  if (
    busy.value ||
    !(await confirmDelete({
      title: '写真を削除しますか？',
      message: 'この写真を日記から削除します。削除すると元に戻せません。',
    }))
  )
    return;
  if (disposed || !sameOwner()) return;
  const previous = [...draft.imageIds],
    thumbnail = draft.thumbnailImageId;
  const deletingCover = coverId.value === id;
  batchingChanges = true;
  draft.imageIds = draft.imageIds.filter((value) => value !== id);
  if (deletingCover) draft.thumbnailImageId = draft.imageIds[0];
  const saved = save();
  if (!saved) {
    draft.imageIds = previous;
    draft.thumbnailImageId = thumbnail;
  }
  batchingChanges = false;
  if (!saved) return;
  const photo = photos.value.find((p) => p.id === id);
  if (photo) URL.revokeObjectURL(photo.url);
  photos.value = photos.value.filter((p) => p.id !== id);
  // Cleanup follows the durable entry update; failure must not undo the user's edit.
  void imageRepository.delete(id, owner).catch(() => {});
}
async function removeDiary() {
  if (
    busy.value ||
    !(await confirmDelete({
      title: '日記を削除しますか？',
      message: 'この日の日記と写真を削除します。削除すると元に戻せません。',
    }))
  )
    return;
  if (disposed || !sameOwner()) return;
  try {
    await deleteEntry(draft.id);
    deleted = true;
    unsaved = false;
    emit('deleted');
  } catch {
    saveError.value = '削除できませんでした。もう一度お試しください。';
  }
}
function setEnvironment(value: DiaryEnvironment | undefined) {
  draft.environment = value;
  save();
}
function applyAnswers(answers: Record<string, string>) {
  batchingChanges = true;
  try {
    Object.assign(draft, editAnswers(draft, answers));
  } finally {
    batchingChanges = false;
  }
  return save();
}
const dateError = ref('');
function changeDate(event: Event) {
  const input = event.target as HTMLInputElement;
  const date = journalDate(input.value);
  if (
    entries.value.some((entry) => entry.id !== draft.id && entry.date === date)
  ) {
    dateError.value =
      'この日付には日記があります。記録画面から開いてください。';
    input.value = draft.date;
    return;
  }
  dateError.value = '';
  draft.date = date;
  save();
}
const saveState = computed(() => {
  if (busy.value || saving.value) return 'saving';
  if (saveError.value || photoSaveFailed.value) return 'error';
  return persisted.value ? 'saved' : 'empty';
});
const saveStatus = computed(() => {
  if (saveState.value === 'saving') return '保存中…';
  if (saveError.value) return '保存失敗';
  if (photoSaveFailed.value) return '写真の保存失敗';
  return persisted.value
    ? recentlySaved.value
      ? '保存しました'
      : '保存済み'
    : '未入力';
});
defineExpose({
  saveState,
  saveStatus,
  removeDiary,
  busy,
  applyAnswers,
  finishEditing: () => !busy.value && save(),
  getAnswers: () => ({ ...draft.answers }),
});
onBeforeRouteLeave(async () => {
  if (pending) await pending;
  return deleted || !unsaved || save();
});
const stopUpdatePreparation = registerUpdatePreparation(async () => {
  if (pending) await pending;
  return deleted || save();
});
function beforeUnload(event: BeforeUnloadEvent) {
  if (unsaved || busy.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => {
  clearTimeout(saveFeedbackTimer);
  stopUpdatePreparation();
  tagDialog.value?.close();
  disposed = true;
  window.removeEventListener('beforeunload', beforeUnload);
  photos.value.forEach((p) => URL.revokeObjectURL(p.url));
});
</script>
<template>
  <div
    class="diary-editor"
    :class="{
      'is-composing': composing,
      'is-reading-diary': readonly,
    }"
  >
    <AppNotice v-if="busy">写真を保存中…</AppNotice>
    <AppNotice v-if="saveError" error
      >{{ saveError }}
      <button class="text-button" @click="save">再試行</button></AppNotice
    >
    <div v-if="composing" class="compose-controls">
      <label class="compose-date"
        ><AppIcon name="calendar-month" /><span>{{ dateLabel }}</span
        ><AppIcon name="chevron-down" /><input
          type="date"
          :value="draft.date"
          :max="dateKey(new Date())"
          aria-label="日記の日付"
          @change="changeDate"
      /></label>
      <slot name="mode" />
    </div>
    <p v-if="dateError" class="error" role="alert">{{ dateError }}</p>
    <section
      v-if="!readonly || draft.imageIds.length"
      class="diary-photos"
      :class="{ 'photos-readonly': readonly }"
      aria-label="今日の写真"
    >
      <div class="photo-stage" :class="{ empty: !coverUrl }">
        <button
          v-if="composing && !coverUrl"
          type="button"
          class="photo-empty cover-placeholder"
          aria-label="写真を追加する"
          :disabled="busy || draft.imageIds.length >= 10"
          @click="photoPicker?.click()"
          ><AppIcon name="image" /><span class="placeholder-title"
            >この日の景色も、一緒に。</span
          ><span>写真を添えて、思い出を残しましょう</span></button
        >
        <span v-if="coverUrl && composing" class="compose-cover-badge"
          >表紙</span
        >
        <DiaryCover :src="coverUrl" @open="openPhoto(coverId || '', $event)" />
        <button
          v-if="!readonly && coverUrl"
          type="button"
          class="remove-cover"
          aria-label="代表写真を削除"
          title="代表写真を削除"
          :disabled="busy"
          @click="removePhoto(coverId!)"
          ><TrashIcon
        /></button>
      </div>
      <div
        v-if="!readonly || collectionPhotos.length"
        class="photo-collection"
        :class="{
          'is-reading': readonly,
          'empty-new-collection': isNew && !collectionPhotos.length,
        }"
      >
        <div
          v-if="collectionPhotos.length"
          class="photo-grid"
          :class="{ 'many-photos': collectionPhotos.length > 4 }"
        >
          <article
            v-for="(photo, index) in collectionPhotos"
            :key="photo.id"
            class="photo-card"
            :class="{ 'is-cover': draft.thumbnailImageId === photo.id }"
          >
            <button
              type="button"
              class="photo-preview"
              :aria-label="`写真${index + 1}を拡大する`"
              @click="openPhoto(photo.id, $event)"
              ><img :src="photo.url" alt="日記の写真" /><span
                v-if="draft.thumbnailImageId === photo.id"
                class="cover-badge"
                ><AppIcon name="check" />表紙</span
              ></button
            >
            <div v-if="!readonly" class="photo-card-actions"
              ><button
                type="button"
                class="set-cover"
                :disabled="busy || draft.thumbnailImageId === photo.id"
                @click="draft.thumbnailImageId = photo.id"
                >{{
                  draft.thumbnailImageId === photo.id ? '表紙' : '表紙にする'
                }}</button
              ><button
                type="button"
                class="remove-photo"
                :disabled="busy"
                :aria-label="`写真${index + 1}を削除`"
                @click="removePhoto(photo.id)"
                ><TrashIcon /></button
            ></div>
          </article>
        </div>
        <div
          v-else-if="!composing && !readonly && !coverUrl"
          class="photo-empty"
          ><AppIcon name="image" /><p>この日の景色も、一緒に。</p
          ><span>写真を添えて、思い出を残しましょう</span></div
        >
        <div
          v-if="!readonly && draft.imageIds.length < 10"
          class="collection-actions"
        >
          <button
            type="button"
            title="写真を追加"
            aria-label="写真を追加"
            class="add-photo"
            :disabled="busy"
            @click="photoPicker?.click()"
            ><AppIcon name="plus" /><span v-if="composing"
              >写真を追加</span
            ></button
          >
          <button
            type="button"
            title="撮影"
            aria-label="撮影"
            class="take-photo"
            :disabled="busy"
            @click="cameraPicker?.click()"
            ><AppIcon name="camera"
          /></button>
          <input
            ref="photoPicker"
            hidden
            aria-label="写真を選択"
            type="file"
            accept="image/*"
            multiple
            :disabled="busy"
            @change="addFiles"
          />
          <input
            ref="cameraPicker"
            hidden
            aria-label="撮影した写真を選択"
            type="file"
            accept="image/*"
            capture="environment"
            :disabled="busy"
            @change="addFiles"
          />
        </div>
      </div>

      <p v-if="photoError" class="error" role="alert">{{ photoError }}</p>
    </section>
    <div class="photo-caption">
      <p v-if="!composing" class="diary-date">{{ dateLabel }}</p>
      <div class="title-field"
        ><h1 v-if="readonly" class="read-title">{{
          draft.guess || '無題の日記'
        }}</h1
        ><input
          v-else
          v-model="titleInput"
          aria-label="タイトル"
          :placeholder="isNew ? suggestedTitle : '日記のタイトル'"
      /></div>
    </div>
    <div v-if="!composing && !readonly" class="body-heading">今日のこと</div
    ><RichTextEditor
      v-model="draft.body"
      :readonly="readonly"
      :compact="composing"
      @add-photo="photoPicker?.click()"
    />
    <section v-if="readonly && draft.tomorrow" class="read-tomorrow"
      ><h2 class="body-heading">明日やりたいこと</h2
      ><p>{{ draft.tomorrow }}</p></section
    >
    <div class="diary-meta">
      <section
        v-if="!readonly || draft.tags.length"
        class="diary-tags"
        aria-label="日記のタグ"
      >
        <h2 class="tags-label"
          ><AppIcon v-if="composing || readonly" name="tag" /><span v-else
            >タグ</span
          ></h2
        >
        <div v-if="draft.tags.length" class="tag-list"
          ><span v-for="tag in draft.tags" :key="tag"
            >{{ tag
            }}<button
              v-if="!readonly"
              type="button"
              :aria-label="`${tag}タグを削除`"
              @click="removeTag(tag)"
              >×</button
            ></span
          ></div
        >
        <button
          v-if="!readonly"
          ref="tagTrigger"
          type="button"
          class="edit-tags"
          aria-haspopup="dialog"
          @click="openTags"
          aria-label="タグを追加"
          title="タグを追加"
          >＋</button
        >
      </section>
      <DiaryEnvironmentPanel
        :readonly="readonly"
        :model-value="draft.environment"
        :date="draft.date"
        @update:model-value="setEnvironment"
      />
    </div>
    <label v-if="!readonly" class="tomorrow-field"
      ><span class="field-heading"
        ><AppIcon name="flag" />明日やりたいこと <small>任意</small></span
      ><input v-model="draft.tomorrow" placeholder="例：少し早く休む"
    /></label>
    <Teleport to="body">
      <dialog
        v-if="!readonly"
        ref="tagDialog"
        class="tag-dialog"
        aria-labelledby="tag-dialog-title"
        @cancel.prevent="closeTags"
        @click="$event.target === tagDialog && closeTags()"
      >
        <div class="tag-dialog-heading"
          ><h2 id="tag-dialog-title"><AppIcon name="tag" />タグを追加</h2
          ><button
            type="button"
            class="tag-dialog-close"
            aria-label="タグのダイアログを閉じる"
            @click="closeTags"
            >×</button
          ></div
        >
        <p class="tag-help">タグの追加・削除は自動保存されます。</p>
        <div class="tag-list"
          ><span v-for="tag in draft.tags" :key="tag"
            ># {{ tag
            }}<button
              type="button"
              :aria-label="`${tag}タグを削除`"
              @click="removeTag(tag)"
              >×</button
            ></span
          ></div
        >
        <p v-if="!draft.tags.length" class="tag-help">タグはまだありません。</p>
        <form class="tag-form" @submit.prevent="addTag"
          ><label for="diary-tag-input">タグを追加</label
          ><div
            ><input
              id="diary-tag-input"
              v-model="tagInput"
              placeholder="例：旅行"
              @keydown.enter="
                ($event.isComposing || $event.keyCode === 229) &&
                $event.preventDefault()
              "
            /><button type="submit" :disabled="!tagInput.trim()"
              >追加</button
            ></div
          ></form
        >
        <section
          v-if="suggestedTags.length"
          class="tag-suggestions"
          aria-label="他の日記のタグ"
        >
          <h3>他の日記から選ぶ</h3>
          <div
            ><button
              v-for="tag in suggestedTags"
              :key="tag"
              type="button"
              :aria-label="`${tag}タグを追加`"
              @click="selectTag(tag)"
              ># {{ tag }}</button
            ></div
          >
        </section>
        <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
      </dialog>
    </Teleport>
    <PhotoLightbox
      v-if="lightbox"
      :photos="photos"
      :initial-id="lightbox"
      :origin="previewOrigin"
      @close="lightbox = ''"
    />
  </div>
</template>

<style scoped>
.tag-dialog {
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 12px 36px rgba(31, 61, 50, 0.2);
}
.tag-dialog::backdrop {
  background: rgba(25, 45, 39, 0.4);
  backdrop-filter: blur(4px);
}
.tag-dialog h2 {
  margin: 0;
  font-size: 1.15rem;
}
.tag-help {
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--sub);
}
.edit-tags {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  font-size: 1.2rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--forest);
  cursor: pointer;
}
.tag-dialog :is(input, button):focus-visible,
.edit-tags:focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}
.tag-dialog-heading h2 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag-dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tag-dialog-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sub);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.tag-suggestions {
  margin-top: 20px;
}
.tag-suggestions h3 {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sub);
}
.tag-suggestions > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-suggestions button {
  min-height: 36px;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--mist);
  color: var(--forest);
  font-size: 0.78rem;
  cursor: pointer;
}
.tags-label {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
}
.diary-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 24px;
}
.diary-tags .tag-list {
  display: contents;
  margin: 0;
}
:is(.diary-tags, .tag-dialog) .tag-list > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow-wrap: anywhere;
  max-width: 100%;
}
:is(.diary-tags, .tag-dialog) .tag-list button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--forest);
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}
.tag-form label {
  display: block;
  font-size: 0.75rem;
  color: var(--sub);
  margin-bottom: 6px;
}
.tag-form > div {
  display: flex;
  gap: 8px;
}
.tag-form input {
  min-width: 0;
  flex: 1;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-size: 16px;
}
.tag-form button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--mist);
  color: var(--forest);
  cursor: pointer;
}

.photo-caption .read-title {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: 0.02em;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.read-tomorrow p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
}
.diary-editor > label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 20px 0;
  font-size: 0.8rem;
  font-weight: 700;
}
.diary-editor > label small {
  font-weight: 400;
  color: var(--sub);
}
.diary-editor > label input {
  width: 100%;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: white;
  color: var(--text);
}
.diary-editor input:focus-visible {
  outline: 2px solid var(--sage);
}
.diary-editor button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.diary-photos {
  margin: 0 0 20px;
  padding: 0;
  border: 0;
  background: transparent;
}
.photo-stage {
  position: relative;
  padding-top: 0;
}
.remove-cover {
  position: absolute;
  right: max(14px, env(safe-area-inset-right, 0px));
  bottom: 14px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  color: var(--forest);
  box-shadow: 0 4px 16px rgba(36, 74, 61, 0.15);
  cursor: pointer;
}
.remove-cover:hover {
  color: #a3463d;
}
.remove-cover:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 3px;
}
.photo-stage.empty {
  padding-top: 80px;
  margin-bottom: 24px;
}

.is-composing .photo-stage.empty {
  padding-top: 0;
}
.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 320px;
  min-height: max(320px, 45svh);
  padding: calc(80px + env(safe-area-inset-top, 0px)) var(--page-right, 22px)
    48px var(--page-left, 22px);
  border: 0;
  border-radius: 0;
  background: var(--mist);
  color: var(--sub);
  font: inherit;
  cursor: pointer;
}
.cover-placeholder .placeholder-title {
  margin-top: 8px;
  color: var(--text);
  font-size: 0.85rem;
}
.cover-placeholder:focus-visible {
  outline: 3px solid var(--forest);
  outline-offset: -3px;
}
.photo-collection.empty-new-collection {
  padding: 0;
  border: 0;
  background: transparent;
}
.photo-caption {
  color: var(--text);
}
.diary-date {
  margin: 0 0 8px;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--sub);
}
.title-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--sub);
}
.title-field input {
  line-height: 1.6;
  width: 100%;
  color: var(--text);
  border-bottom: 1px solid var(--sage);
  font-size: 1.1rem;
}
.title-field input::placeholder {
  color: var(--sub);
  opacity: 0.55;
  font-weight: 400;
}
.title-field input:focus-visible {
  outline: none;
  border-bottom: 2px solid var(--sage);
  padding-bottom: 9px;
}
.body-heading {
  margin-top: 20px;
  font-size: 0.8rem;
  font-weight: 700;
}
.diary-editor > label,
.body-heading {
  color: var(--sub);
}
.field-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.photo-collection {
  padding: 14px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.55);
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 0;
}
.photo-grid.many-photos {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.photo-card {
  min-width: 0;
}
.photo-preview {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4/3;
  padding: 0;
  border: 0;
  border-radius: 14px;
  overflow: hidden;
  background: var(--mist);
  cursor: zoom-in;
}
.photo-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}
.photo-preview:hover img {
  transform: scale(1.04);
}
.cover-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 20px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--forest);
  font-size: 0.62rem;
}
.cover-badge .app-icon {
  width: 12px;
  height: 12px;
}
.photo-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding-top: 4px;
}
.photo-card-actions button {
  min-height: 32px;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.set-cover {
  padding: 0 3px;
  color: var(--forest);
  font-size: 0.68rem;
  text-align: left;
}
.photo-card-actions .set-cover:disabled {
  opacity: 1;
  color: var(--sub);
  cursor: default;
}
.remove-photo {
  display: grid;
  place-items: center;
  min-width: 32px;
  color: var(--sub);
  padding: 6px;
}
.remove-photo:hover {
  color: #a3463d;
  background: #f9edeb;
  border-radius: 12px;
}
.collection-actions {
  position: static;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}
.collection-actions button {
  appearance: none;
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  width: 48px;
  min-width: 48px;
  max-width: 48px;
  height: 48px;
  min-height: 48px;
  max-height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(36, 74, 61, 0.18);
}
.collection-actions input {
  display: none;
}
.collection-actions button:focus-visible,
.photo-preview:focus-visible,
.photo-card-actions button:focus-visible {
  outline: 2px solid var(--forest);
  outline-offset: 3px;
}
.collection-actions .app-icon {
  width: 22px;
  height: 22px;
}
.add-photo {
  background: var(--forest);
  color: white;
}
.collection-actions .take-photo {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--forest);
}
.collection-actions .disabled {
  opacity: 0.5;
  cursor: wait;
}
.photo-empty:not(.cover-placeholder) {
  text-align: center;
  padding: 16px 0 8px;
  color: var(--sub);
}
.photo-empty > .app-icon {
  width: 30px;
  height: 30px;
  color: var(--sage);
}
.photo-empty p {
  margin: 10px 0 5px;
  font-size: 0.85rem;
  color: var(--text);
}
.photo-empty span {
  font-size: 0.68rem;
}
.photos-readonly:has(.is-reading) {
  margin-bottom: 12px;
}
.photos-readonly:has(.is-reading) .photo-stage:not(.empty) {
  margin-bottom: 8px;
}
.is-reading {
  margin-left: calc(8px - var(--page-left, 22px));
  margin-right: calc(8px - var(--page-right, 22px));
  padding: 0;
  border: 0;
  background: transparent;
}
.is-reading .photo-preview {
  border-radius: 6px;
}
.is-reading .photo-grid {
  gap: 8px;
  display: grid;
}

.is-reading .cover-badge {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .photo-preview img {
    transition: none;
  }
}
.diary-editor .photo-stage {
  margin: 0 0 14px;
  border-radius: 16px;
  overflow: hidden;
}
.diary-editor .photo-stage :deep(img) {
  border-radius: 16px;
}
.diary-editor .title-field input {
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  font-weight: 500;
}
.diary-editor :deep(.rich-text-editor) {
  border-radius: 14px;
  background: var(--surface);
}
.diary-editor .photo-caption {
  margin-bottom: 16px;
}
.diary-editor .photo-collection {
  border-radius: 14px;
}

/* The compose layout follows the photo, writing, metadata, tomorrow sequence. */
.compose-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 14px;
}
.compose-date {
  position: relative;
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem !important;
  font-weight: 400 !important;
  min-height: 38px;
}
.compose-date input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}
.compose-date input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  cursor: pointer;
}
.compose-date:focus-within {
  outline: 2px solid var(--forest);
  outline-offset: 3px;
  border-radius: 8px;
}
.compose-date .app-icon {
  color: var(--forest);
  width: 23px;
  height: 23px;
}
.compose-cover-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  color: white;
  background: var(--forest);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 0.75rem;
}
.diary-editor.is-composing .photo-stage {
  margin: 0 0 10px;
  padding-top: 0;
}
.is-composing .photo-stage :deep(.diary-cover img) {
  height: clamp(190px, 40vw, 310px);
  object-fit: cover;
}
.is-composing .cover-placeholder {
  min-height: 200px;
  border: 1px dashed var(--line);
  background: var(--mist);
}
.is-composing .remove-cover {
  top: 12px;
  bottom: auto;
  right: 12px;
}
.diary-editor.is-composing .photo-collection {
  display: flex;
  gap: 10px;
  padding: 0;
  border: 0;
  background: none;
  overflow-x: auto;
}
.is-composing .photo-grid,
.is-composing .photo-grid.many-photos {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.is-composing .photo-card {
  width: 174px;
}
.is-composing .photo-preview {
  height: 110px;
  aspect-ratio: auto;
}
.diary-editor.is-composing .collection-actions {
  position: static;
  align-self: flex-start;
  gap: 8px;
}
.diary-editor.is-composing .collection-actions .add-photo {
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 170px;
  max-width: none;
  flex: 0 0 170px;
  height: 110px;
  max-height: none;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: transparent;
  color: var(--sub);
  box-shadow: none;
  font-size: 0.85rem;
}
.is-composing .collection-actions .take-photo {
  align-self: center;
  box-shadow: none;
}
.is-composing .photo-card-actions {
  padding-top: 0;
}
.is-composing .photo-card-actions button {
  min-height: 24px;
}
.diary-editor.is-composing .photo-caption {
  margin: 0 0 12px;
}
.is-composing .title-field {
  position: relative;
}
.is-composing .title-field input {
  font-size: 1.1rem;
  font-weight: 400;
}
.is-composing :deep(.rich-text-editor) {
  overflow: visible;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.is-composing :deep(.format-tools) {
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 12px 12px 0 0;
  padding: 6px 12px;
  gap: 8px;
  background: transparent;
}
.is-composing :deep(.format-tools > button) {
  width: 40px;
  min-height: 36px;
  border: 0;
  background: transparent;
  color: #777;
}
.is-composing :deep(.rich-text-field) {
  min-height: 185px;
  border: 0;
  padding: 18px 20px;
  font-size: 1rem;
  line-height: 1.9;
}
.diary-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}
.is-composing .diary-meta {
  margin: 16px 0;
}
.is-composing .diary-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  margin: 0;
  flex: 1;
}
.is-composing .tags-label {
  flex-basis: auto;
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--forest);
}
.is-composing .tags-label .app-icon {
  width: 21px;
}
.is-composing .tag-list {
  margin: 0;
  gap: 6px;
}
.is-composing .tag-list span {
  padding: 8px 12px;
  border-radius: 24px;
  background: var(--mist);
  color: var(--forest);
}
.is-composing .edit-tags {
  width: 44px;
  height: 36px;
  border: 1px dashed var(--sage);
  border-radius: 24px;
  background: transparent;
}
.is-composing .diary-meta :deep(.environment-area) {
  margin: 0;
  flex: 1;
  min-width: 250px;
}
.is-composing .diary-meta :deep(.environment-panel) {
  border-radius: 24px;
  background: transparent;
  padding: 6px 10px;
  min-height: 38px;
}
.is-composing .diary-meta :deep(.environment-sources) {
  font-size: 0.65rem;
  margin-top: 8px;
}
.is-composing .tomorrow-field {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  font-weight: 400;
}
.is-composing .tomorrow-field .field-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--forest);
}
.is-composing .tomorrow-field input {
  border-radius: 10px;
  padding: 10px 14px;
}
@media (max-width: 460px) {
  .compose-controls {
    gap: 8px;
  }
  .compose-date {
    font-size: 0.8rem !important;
  }
  .is-composing :deep(.format-tools) {
    gap: 2px;
    padding: 6px;
  }
  .is-composing :deep(.format-tools > button) {
    width: 34px;
  }
  .is-composing .diary-meta :deep(.environment-area) {
    flex-basis: 100%;
  }
}

/* Reading mode has a quiet article hierarchy and no editor chrome. */
.diary-editor.is-reading-diary {
  display: flex;
  flex-direction: column;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--surface);
}
.is-reading-diary .photo-caption {
  order: 0;
  margin: 0 0 24px;
}
.is-reading-diary .diary-date {
  margin: 0 0 10px;
  color: var(--forest);
  font-size: 0.85rem;
  letter-spacing: 0.02em;
}
.is-reading-diary .photo-caption .read-title {
  font-family: 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  font-size: 1.85rem;
  line-height: 1.6;
  color: var(--text);
}
.is-reading-diary .diary-photos {
  order: 1;
  margin: 0 0 24px;
}
.is-reading-diary .photo-stage {
  margin: 0 0 10px;
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
}
.is-reading-diary .photo-stage :deep(.diary-cover img) {
  max-height: 360px;
  width: 100%;
  object-fit: cover;
}
.is-reading-diary .photo-collection.is-reading {
  margin: 0;
  padding: 0;
  border: 0;
}
.is-reading-diary .photo-grid,
.is-reading-diary .photo-grid.many-photos {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.is-reading-diary .photo-card {
  flex: 0 0 130px;
}
.is-reading-diary .photo-preview {
  height: 90px;
  border-radius: 10px;
  aspect-ratio: auto;
}
.is-reading-diary :deep(.rich-text-editor.readonly) {
  order: 2;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.is-reading-diary :deep(.rich-text-field) {
  padding: 0;
  font-size: 1rem;
  line-height: 2;
  color: var(--text);
}
.is-reading-diary .diary-meta {
  order: 3;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 24px 0 0;
}
.is-reading-diary .diary-meta:has(> :first-child) {
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.is-reading-diary .diary-tags {
  margin: 0;
  gap: 8px;
}
.is-reading-diary .tags-label {
  flex-basis: auto;
  display: flex;
  align-items: center;
  color: var(--forest);
}
.is-reading-diary .tags-label .app-icon {
  width: 20px;
  height: 20px;
}
.is-reading-diary .tag-list span {
  background: var(--mist);
  color: var(--forest);
  border-radius: 24px;
  padding: 6px 12px;
  font-size: 0.8rem;
}
.is-reading-diary .diary-meta :deep(.environment-area) {
  width: 100%;
  margin: 0;
}
.is-reading-diary .diary-meta :deep(.environment-panels) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.is-reading-diary .diary-meta :deep(.environment-panel) {
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: var(--paper);
  font-size: 0.8rem;
}
.is-reading-diary .diary-meta :deep(.weather) {
  font-size: 0.8rem;
}
.is-reading-diary .read-tomorrow {
  order: 4;
  margin: 24px 0 0;
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--mist);
}
.is-reading-diary .read-tomorrow .body-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: var(--forest);
  font-weight: 500;
}
.is-reading-diary .read-tomorrow .app-icon {
  width: 18px;
  height: 18px;
}
.is-reading-diary .read-tomorrow p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.9;
}
@media (max-width: 460px) {
  .diary-editor.is-reading-diary {
    padding: 18px 16px;
    border-radius: 18px;
  }
  .is-reading-diary .photo-caption .read-title {
    font-size: 1.5rem;
  }
  .is-reading-diary .photo-stage :deep(.diary-cover img) {
    max-height: 240px;
  }
}
</style>
