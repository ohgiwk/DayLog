<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import UpdateNotice from './components/UpdateNotice.vue'
import { saveSettings, settings } from './stores/diary'
saveSettings()
const route=useRoute()
</script>
<template>
 <div class="app-shell">
  <UpdateNotice />
  <main>
   <RouterView v-slot="{ Component, route: currentRoute }">
    <Transition name="page-fade" mode="out-in">
     <component :is="Component" :key="currentRoute.fullPath" />
    </Transition>
   </RouterView>
  </main>
  <nav v-if="route.path!='/journal'" class="tabbar" aria-label="メインメニュー">
   <RouterLink to="/" aria-label="ホーム"><span>⌂</span><small>ホーム</small></RouterLink>
   <RouterLink to="/records" aria-label="記録"><span>▤</span><small>記録</small></RouterLink>
   <RouterLink to="/journal" class="write-tab" aria-label="日記を書く"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span><small>日記を書く</small></RouterLink>
   <RouterLink to="/insights" aria-label="振り返り"><span>◔</span><small>振り返り</small></RouterLink>
   <RouterLink to="/settings" aria-label="設定"><span>⚙</span><small>設定</small></RouterLink>
  </nav>
 </div>
</template>
