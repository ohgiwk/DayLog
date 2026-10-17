<script setup lang="ts">
defineProps<{ src: string; stretch?: number; pulling?: boolean }>()
</script>
<template><div v-if="src" class="diary-cover" :class="{pulling}" :style="{height:(360+(stretch||0))+'px','--cover-scale':1+(stretch||0)/360}" aria-hidden="true"><img :src="src" alt="" /></div></template>
<style scoped>
.diary-cover{width:100%;height:360px;overflow:hidden;pointer-events:none;transition:height 240ms cubic-bezier(.2,.7,.3,1);mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 55%,transparent 100%)}
.diary-cover img{display:block;width:100%;height:360px;transform:scale(var(--cover-scale,1));transform-origin:center top;transition:transform 240ms cubic-bezier(.2,.7,.3,1);object-fit:cover;object-position:center center}
.diary-cover.pulling,.diary-cover.pulling img{transition:none}
@media(prefers-reduced-motion:reduce){.diary-cover,.diary-cover img{transition:none}}
</style>
