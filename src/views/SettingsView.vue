<script setup lang="ts">
import { formatReleaseDate } from '../lib/app-version';
const releasedAt = __APP_RELEASE_DATE__;
const versionLabel = formatReleaseDate(releasedAt);
import { seasons, seasonForDate } from '../lib/season-theme';
import AccountPanel from '../components/AccountPanel.vue';
import AppIcon from '../components/AppIcon.vue';
import { saveSettings, settings } from '../stores/diary';
function toggle(key: keyof typeof settings) {
  if (typeof settings[key] === 'boolean') {
    (settings[key] as boolean) = !settings[key];
    saveSettings();
  }
}
</script>
<template>
  <div class="page settings-page"
    ><header class="page-header sticky-page-header"><h1>設定</h1></header
    ><AccountPanel />
    <section class="settings-group season-settings">
      <h2>表示・テーマ</h2>
      <div class="season-panel">
        <div class="season-heading"
          ><AppIcon name="leaf" /><b>季節のテーマ</b
          ><span>{{
            settings.seasonTheme === 'auto' ? '自動' : '手動'
          }}</span></div
        >
        <div class="season-options" role="group" aria-label="季節のテーマ">
          <button
            v-for="season in seasons"
            :key="season.id"
            :style="{ '--season-color': season.color }"
            :aria-pressed="
              (settings.seasonTheme === 'auto'
                ? seasonForDate()
                : settings.seasonTheme) === season.id
            "
            @click="
              settings.seasonTheme = season.id;
              saveSettings();
            "
            ><AppIcon :name="season.icon" />{{ season.label
            }}<span class="season-radio"></span
          ></button>
        </div>
        <button
          class="season-auto"
          role="switch"
          :aria-checked="settings.seasonTheme === 'auto'"
          @click="
            settings.seasonTheme =
              settings.seasonTheme === 'auto' ? seasonForDate() : 'auto';
            saveSettings();
          "
          ><span
            ><b>日付に合わせて自動で切り替える</b
            ><small
              >春 3〜5月 · 夏 6〜8月 · 秋 9〜11月 · 冬 12〜2月</small
            ></span
          ><i
            class="switch"
            :class="{ on: settings.seasonTheme === 'auto' }"
          ></i
        ></button>
      </div> </section
    ><section class="settings-group"
      ><h2>記録のサポート</h2
      ><button
        v-for="item in [
          {
            k: 'notifications',
            i: 'bell',
            t: 'やさしい通知',
            d: '書きたい時間にそっとお知らせ',
          },
          { k: 'location', i: 'pin', t: '位置情報', d: '市区町村までを記録' },
          {
            k: 'weather',
            i: 'cloud',
            t: '天気の記録',
            d: '現在地から天気と気温を取得',
          },
        ]"
        :key="item.k"
        @click="toggle(item.k as keyof typeof settings)"
        ><span class="setting-icon"><AppIcon :name="item.i" /></span
        ><span
          ><b>{{ item.t }}</b
          ><small>{{ item.d }}</small></span
        ><i
          class="switch"
          :class="{ on: settings[item.k as keyof typeof settings] }"
        ></i></button></section
    ><section class="settings-group"
      ><h2>見やすさ</h2
      ><button @click="toggle('largeText')"
        ><span class="setting-icon"><AppIcon name="text" /></span
        ><span
          ><b>文字を大きくする</b><small>読みやすいサイズで表示</small></span
        ><i class="switch" :class="{ on: settings.largeText }"></i></button
      ><button @click="toggle('reducedMotion')"
        ><span class="setting-icon"><AppIcon name="motion" /></span
        ><span
          ><b>動きを減らす</b
          ><small>画面のアニメーションを控えめに</small></span
        ><i
          class="switch"
          :class="{ on: settings.reducedMotion }"
        ></i></button></section
    ><div id="settings-data-management"></div
    ><p class="version"
      >DayLog<br />バージョン：<time
        :datetime="releasedAt"
        title="プッシュ日時（日本時間）"
        >{{ versionLabel }}</time
      ></p
    ></div
  >
</template>

<style scoped>
.settings-group h2 {
  color: #69716f;
  font-size: 0.9rem;
  margin: 24px 4px 12px;
}
.settings-group > button {
  border-radius: 0;
  background: var(--surface);
  margin: 0;
  padding: 18px;
  border-bottom: 1px solid var(--line);
}
.settings-group > button:first-of-type {
  border-radius: 18px 18px 0 0;
}
.settings-group > button:last-child {
  border-radius: 0 0 18px 18px;
  border-bottom: 0;
}
.setting-icon {
  background: none;
  color: var(--text);
}
.switch.on {
  background: var(--forest);
}
.season-panel {
  border-radius: 18px;
  padding: 18px;
  background: var(--surface);
}
.season-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.season-heading > span {
  margin-left: auto;
  color: var(--sub);
  font-size: 0.8rem;
}
.season-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.season-options button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 54px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--season-color);
  background: color-mix(in srgb, var(--season-color) 11%, white);
  cursor: pointer;
}
.season-options button[aria-pressed='true'] {
  border-color: var(--season-color);
}
.season-radio {
  width: 14px;
  height: 14px;
  border: 1px solid #a9adac;
  border-radius: 50%;
  background: white;
}
[aria-pressed='true'] .season-radio {
  background: var(--season-color);
  box-shadow: inset 0 0 0 3px white;
  border-color: var(--season-color);
}
.season-auto {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 18px 0 0;
  margin-top: 18px;
  border: 0;
  border-top: 1px solid var(--line);
  background: none;
  color: var(--text);
  cursor: pointer;
}
.season-auto > span {
  flex: 1;
}
.season-auto small {
  display: block;
  margin-top: 8px;
  font-size: 0.66rem;
  color: var(--sub);
  line-height: 1.7;
}
@media (max-width: 460px) {
  .season-options button {
    gap: 5px;
    padding: 8px 4px;
  }
  .season-options .app-icon {
    width: 18px;
  }
  .season-radio {
    display: none;
  }
}
.settings-page .account-panel {
  border: 0;
  border-radius: 18px;
  box-shadow: none;
  background: var(--surface);
}
</style>
