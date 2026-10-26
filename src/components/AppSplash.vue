<script setup lang="ts">
defineProps<{ error?: string }>()
</script>
<template>
 <section class="app-splash" role="status" :aria-busy="!error" aria-label="DayLogを起動しています">
  <div class="splash-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18M11 8h6M11 12h6M11 16h4" /></svg></div>
  <h1 class="splash-title">DayLog</h1>
  <p class="splash-caption">あなたの日々を、ここに。</p>
  <div v-if="!error" class="splash-progress" aria-hidden="true"><span></span><span></span><span></span></div>
  <p v-if="error" class="splash-message" role="alert">{{ error }}</p>
 </section>
</template>
