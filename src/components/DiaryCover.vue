<script setup lang="ts">
defineProps<{ src: string }>()
</script>
<template><div v-if="src" class="diary-cover" aria-hidden="true"><img :src="src" alt="" /></div></template>
<style scoped>
.diary-cover{width:100%;pointer-events:none;mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)}
.diary-cover img{display:block;width:100%;height:auto}
</style>
