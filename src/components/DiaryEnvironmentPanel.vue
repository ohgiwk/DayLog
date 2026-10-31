<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import EnvironmentMenu from './EnvironmentMenu.vue';
import { settings } from '../stores/diary';
import { recordEnvironment, weatherLabel } from '../lib/diary-weather';
import type { DiaryEnvironment } from '../types';
const props = defineProps<{
  date: string;
  readonly?: boolean;
}>();
const modelValue = defineModel<DiaryEnvironment>();
type Kind = 'location' | 'weather';
const loading = ref<Kind | null>(null),
  error = ref('');
let controller: AbortController | undefined;
let disposed = false;
async function record(kind: Kind) {
  if (loading.value || !settings[kind]) return;
  loading.value = kind;
  error.value = '';
  controller = new AbortController();
  const timeout = setTimeout(() => controller?.abort(), 20000);
  try {
    const result = await recordEnvironment(
      props.date,
      { location: kind === 'location', weather: kind === 'weather' },
      controller.signal,
    );
    if (!disposed)
      modelValue.value = {
        ...modelValue.value,
        recordedAt: result.recordedAt,
        ...(kind === 'location'
          ? { place: result.place }
          : { weather: result.weather }),
      };
  } catch (cause) {
    if (!disposed)
      error.value = controller.signal.aborted
        ? '取得に時間がかかっています。もう一度お試しください。'
        : cause instanceof Error
          ? cause.message
          : '取得できませんでした。';
  } finally {
    clearTimeout(timeout);
    if (!disposed) loading.value = null;
  }
}
function remove(kind: Kind) {
  error.value = '';
  const next = { ...modelValue.value } as DiaryEnvironment;
  if (kind === 'location') delete next.place;
  else delete next.weather;
  modelValue.value = next.place || next.weather ? next : undefined;
}
onBeforeUnmount(() => {
  disposed = true;
  controller?.abort();
});
</script>
<template>
  <div
    v-if="!readonly || modelValue?.place || modelValue?.weather"
    class="environment-area"
  >
    <div class="environment-panels">
      <div
        v-if="!readonly || modelValue?.place"
        class="environment-panel"
        aria-label="現在地の記録"
        :aria-busy="loading === 'location'"
      >
        <span v-if="modelValue?.place" class="place"
          ><AppIcon name="pin" />{{ modelValue.place }}</span
        >
        <button
          v-if="!modelValue?.place"
          type="button"
          :disabled="!!loading || !settings.location"
          aria-label="現在地を記録"
          title="現在地を記録"
          @click="record('location')"
          ><AppIcon name="pin" />{{
            loading === 'location' ? '取得中…' : '現在地を記録'
          }}</button
        >
        <EnvironmentMenu
          v-else-if="!readonly"
          label="現在地"
          align="start"
          :disabled="!!loading"
          :update-disabled="!settings.location"
          @update="record('location')"
          @remove="remove('location')"
        />
      </div>
      <div
        v-if="!readonly || modelValue?.weather"
        class="environment-panel"
        aria-label="天気の記録"
        :aria-busy="loading === 'weather'"
      >
        <span v-if="modelValue?.weather" class="weather"
          ><AppIcon :name="modelValue.weather.code < 3 ? 'sun' : 'cloud'" />{{
            weatherLabel(modelValue.weather.code)
          }}<span class="high" aria-label="最高気温"
            >↑{{ Math.round(modelValue.weather.high) }}°</span
          ><span class="low" aria-label="最低気温"
            >↓{{ Math.round(modelValue.weather.low) }}°</span
          ></span
        >
        <button
          v-if="!modelValue?.weather"
          type="button"
          :disabled="!!loading || !settings.weather"
          aria-label="天気を記録"
          title="天気を記録"
          @click="record('weather')"
          ><AppIcon name="cloud" />{{
            loading === 'weather' ? '取得中…' : '天気を記録'
          }}</button
        >
        <EnvironmentMenu
          v-else-if="!readonly"
          label="天気"
          :disabled="!!loading"
          :update-disabled="!settings.weather"
          @update="record('weather')"
          @remove="remove('weather')"
        />
      </div>
    </div>
    <p v-if="loading" class="environment-help" role="status"
      >{{ loading === 'location' ? '現在地' : '天気' }}を取得中…</p
    >
    <p
      v-if="!readonly && (!settings.location || !settings.weather)"
      class="environment-help"
      >無効な項目は<RouterLink to="/settings">設定</RouterLink
      >で有効にできます。</p
    >
    <p v-if="error" class="environment-error" role="alert">{{ error }}</p>
    <details v-if="modelValue" class="environment-sources"
      ><summary>取得情報</summary
      ><p
        >現在地をもとに、日記の日付の天気を記録しています。当日の気温は予報値です。場所は市区町村までを保存します。</p
      ><p
        >天気：<a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          >Open-Meteo</a
        >
        · 地名：<a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          >© OpenStreetMap contributors</a
        ></p
      ></details
    >
  </div>
</template>
<style scoped>
.environment-area {
  margin: 16px 0 20px;
}
.environment-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}
.environment-panel {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 0.72rem;
  color: var(--sub);
}
.environment-panel > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.place {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weather {
  flex: 1;
  flex-wrap: wrap;
  font-size: 0.65rem;
}
.environment-panel :deep(.app-icon) {
  width: 16px;
  height: 16px;
}
.environment-panel button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  min-width: 22px;
  flex-shrink: 0;
  padding: 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--forest);
  cursor: pointer;
  font-size: inherit;
}
.environment-panel button:hover {
  background: var(--mist);
}
.environment-panel button:focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}
.environment-panel button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.high {
  color: #a35b49;
}
.low {
  color: #407995;
}
.environment-help,
.environment-error,
.environment-sources {
  font-size: 0.65rem;
  line-height: 1.6;
  margin: 6px 2px 0;
  color: var(--sub);
}
.environment-error {
  color: #a6534b;
}
.environment-sources summary {
  cursor: pointer;
}
.environment-sources p {
  margin: 4px 0;
}
.environment-area a {
  color: var(--forest);
}
</style>
