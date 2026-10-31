<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import LegacyMemoImport from './LegacyMemoImport.vue';
import MemoConflictPreview from './MemoConflictPreview.vue';
import { memoSyncState, syncMemos, chooseMemoConflict } from '../lib/memo-sync';
import { readMemoSnapshot } from '../lib/memo-repository';
import { mergeMemoLibraries } from '../lib/memo-sync-model';
import DiaryConflictPreview from './DiaryConflictPreview.vue';
import { account, authError, cloudConfigured } from '../stores/account';
import { supabase } from '../lib/supabase';
import {
  chooseConflict,
  importGuestDiaries,
  syncDiary,
  syncState,
} from '../lib/diary-sync';
import { guestEntries, readAccountSnapshot } from '../stores/diary';
const memoConflicts = computed(() => {
  const snapshot = memoSyncState.conflict;
  return snapshot?.conflict
    ? mergeMemoLibraries(
        snapshot.base,
        snapshot.library,
        snapshot.conflict.library,
      ).conflicts
    : [];
});
const syncing = computed(() => syncState.busy || memoSyncState.busy);
const pending = computed(() => syncState.pending + memoSyncState.pending);
const needsAttention = computed(
  () =>
    !!(
      syncState.error ||
      memoSyncState.error ||
      syncState.conflicts.length ||
      memoSyncState.conflict
    ),
);
const syncLabel = computed(() =>
  syncing.value
    ? '同期中…'
    : needsAttention.value
      ? '同期を確認'
      : pending.value
        ? '未同期あり'
        : syncState.lastSynced && memoSyncState.lastSynced
          ? '同期済み'
          : '確認中',
);
async function syncAll() {
  await Promise.all([syncDiary(), syncMemos()]);
}
const busy = ref(false),
  message = ref(''),
  error = ref('');
const guestCount = computed(() => {
  void account.user?.id;
  return guestEntries().length;
});
async function perform(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  error.value = '';
  try {
    await action();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : '操作を完了できませんでした。';
  } finally {
    busy.value = false;
  }
}
async function signOut() {
  await perform(async () => {
    // Keep offline edits recoverable instead of making the account disappear prematurely.
    await syncAll();
    if ((await readMemoSnapshot()).pending)
      throw new Error(
        '未同期のメモがあります。同期・重複の解決後にログアウトしてください。',
      );
    if (
      Object.keys(readAccountSnapshot().pending).length ||
      readAccountSnapshot().cleanup.length
    )
      throw new Error(
        '未同期の変更があります。同期・重複の解決後にログアウトしてください。',
      );
    const { error: failure } = await supabase!.auth.signOut({ scope: 'local' });
    if (failure) throw new Error(authError(failure));
  });
}
function localEntry(date: string) {
  return readAccountSnapshot().pending[date]?.entry ?? null;
}
</script>
<template>
  <section class="account-panel" aria-label="アカウントと同期">
    <template v-if="cloudConfigured && account.user">
      <div class="account-profile">
        <span class="account-avatar" aria-hidden="true"
          ><svg viewBox="0 0 64 64">
            <circle cx="32" cy="24" r="11" />
            <path d="M10 62v-5c0-13 9-22 22-22s22 9 22 22v5" /></svg
        ></span>
        <div class="account-identity"
          ><p class="account-email">{{ account.user.email }}</p
          ><span
            class="sync-status"
            :class="{ warning: needsAttention || pending, syncing }"
            role="status"
            ><AppIcon
              :name="
                syncing
                  ? 'refresh'
                  : needsAttention || pending
                    ? 'save-error'
                    : syncLabel === '同期済み'
                      ? 'check'
                      : 'more'
              "
            />{{ syncLabel }}</span
          ></div
        >
        <button
          type="button"
          class="sync-button"
          :disabled="busy || syncing"
          @click="syncAll"
          >{{ syncing ? '同期中…' : '今すぐ同期' }}</button
        >
      </div>
      <button
        type="button"
        class="account-logout"
        :disabled="busy || syncing"
        @click="signOut"
        ><AppIcon name="logout" /><span>ログアウト</span
        ><AppIcon name="chevron-right"
      /></button>
      <p v-if="syncState.error" class="error" role="alert">{{
        syncState.error
      }}</p>
      <p v-if="memoSyncState.error" class="error" role="alert">{{
        memoSyncState.error
      }}</p>
    </template>
    <p v-else-if="!cloudConfigured"
      >アカウント機能は準備中です。日記はこの端末に保存されています。</p
    >
    <p v-else>アカウント情報を確認しています。</p>
    <p v-if="message" role="status">{{ message }}</p
    ><p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
  <Teleport
    v-if="cloudConfigured && account.user"
    defer
    to="#settings-data-management"
  >
    <section class="account-data" aria-labelledby="account-data-title"
      ><h2 id="account-data-title">データ管理</h2
      ><div class="account-data-card">
        <details class="account-details">
          <summary>{{
            guestCount
              ? `端末の日記を取り込む（${guestCount}件）`
              : '同期するデータについて'
          }}</summary>
          <template v-if="guestCount">
            <p
              >ログイン前の日記と写真を、このアカウントへアップロードします。</p
            >
            <button
              class="outline-button"
              :disabled="busy || syncing"
              @click="
                perform(async () => {
                  message = await importGuestDiaries();
                })
              "
              >取り込む</button
            >
          </template>
          <p
            >日記・メモ・フォルダ・添付写真を同期します。表示設定は、この端末だけに保存されます。</p
          >
        </details>
        <LegacyMemoImport />
        <article v-if="memoConflicts.length" class="conflict-card">
          <h3>メモの変更が重複しています</h3>
          <p
            >重複した項目について残す内容を選んでください。それ以外の変更は両方取り込みます。</p
          >
          <div
            v-for="conflict in memoConflicts"
            :key="conflict.kind + conflict.id"
          >
            <details
              ><summary
                >この端末の{{
                  conflict.kind === 'folders' ? 'フォルダ' : 'メモ'
                }}</summary
              ><MemoConflictPreview :value="conflict.local"
            /></details>
            <details
              ><summary>同期先の内容</summary
              ><MemoConflictPreview :value="conflict.remote"
            /></details>
          </div>
          <div class="account-actions"
            ><button
              class="outline-button"
              :disabled="busy || syncing"
              @click="
                perform(async () => {
                  await chooseMemoConflict('local');
                })
              "
              >この端末を使う</button
            ><button
              class="outline-button"
              :disabled="busy || syncing"
              @click="
                perform(async () => {
                  await chooseMemoConflict('remote');
                })
              "
              >同期先を使う</button
            ></div
          >
        </article>
        <article
          v-for="conflict in syncState.conflicts"
          :key="conflict.date"
          class="conflict-card"
        >
          <h3>{{ conflict.date }}の変更が重複しています</h3>
          <p>本文・回答・写真を含め、残す日記を選んでください。</p>
          <details
            ><summary>この端末の内容</summary
            ><DiaryConflictPreview :entry="localEntry(conflict.date)"
          /></details>
          <details
            ><summary>同期先の内容</summary
            ><DiaryConflictPreview :entry="conflict.entry"
          /></details>
          <div class="account-actions"
            ><button
              class="outline-button"
              :disabled="busy || syncing"
              @click="
                perform(async () => {
                  await chooseConflict(conflict.date, 'local');
                })
              "
              >この端末を使う</button
            ><button
              class="outline-button"
              :disabled="busy || syncing"
              @click="
                perform(async () => {
                  await chooseConflict(conflict.date, 'remote');
                })
              "
              >同期先を使う</button
            ></div
          >
        </article>
      </div></section
    >
  </Teleport>
</template>
<style scoped>
.account-panel {
  margin-bottom: 24px;
  padding: 20px 24px 0;
  border-radius: 18px;
  background: var(--surface);
}
.account-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 0 20px;
}
.account-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e9e9e7;
  overflow: hidden;
}
.account-avatar svg {
  width: 100%;
  height: 100%;
  fill: #b1b4b3;
}
.account-identity {
  flex: 1;
  min-width: 0;
}
.account-panel .account-email {
  margin: 0 0 8px;
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
}
.sync-status {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--sub);
  font-size: 0.85rem;
}
.sync-status .app-icon {
  width: 20px;
  height: 20px;
  padding: 3px;
  border-radius: 50%;
  color: white;
  background: #84ac96;
}
.sync-status.warning .app-icon {
  background: #b18a54;
}
.sync-status.syncing .app-icon {
  background: var(--forest);
}
.sync-button {
  flex-shrink: 0;
  border: 0;
  border-radius: 12px;
  padding: 14px 20px;
  min-height: 48px;
  background: var(--mist);
  color: var(--forest);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.account-logout {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 62px;
  padding: 16px 0;
  border: 0;
  border-top: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}
.account-logout > .app-icon:last-child {
  margin-left: auto;
  color: #a0a5a3;
  width: 18px;
}
.account-panel p {
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--sub);
  margin: 8px 0;
}
.account-data h2 {
  color: #69716f;
  font-size: 0.9rem;
  margin: 24px 4px 12px;
}
.account-data-card {
  padding: 8px 20px 16px;
  border-radius: 18px;
  background: var(--surface);
}
@media (max-width: 460px) {
  .account-panel {
    padding: 16px 16px 0;
  }
  .account-profile {
    gap: 12px;
    flex-wrap: wrap;
  }
  .account-avatar {
    flex-basis: 50px;
    width: 50px;
    height: 50px;
  }
  .account-panel .account-email {
    font-size: 0.88rem;
  }
  .sync-button {
    padding: 10px 14px;
    font-size: 0.8rem;
  }
}
.account-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.account-actions > button,
.account-details > button {
  min-height: 44px;
  cursor: pointer;
}
.account-actions > .outline-button {
  padding: 8px 12px;
  border-radius: 12px;
}
.account-actions > .text-button {
  margin-left: auto;
  padding: 8px;
  font-size: 0.72rem;
}
.account-panel button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.account-panel .error {
  color: #9d594e;
}
.account-details {
  margin-top: 0;
}
.account-details > summary {
  min-height: 44px;
  padding: 13px 0 8px;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--sub);
  cursor: pointer;
}
.conflict-card {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.conflict-card h3 {
  font-size: 0.82rem;
  margin: 4px 0;
}
.conflict-card summary {
  padding: 12px 0;
  font-size: 0.75rem;
  cursor: pointer;
}
.account-panel :is(button, summary):focus-visible,
.account-data :is(button, summary):focus-visible {
  outline: 2px solid var(--sage);
  outline-offset: 2px;
}
</style>
