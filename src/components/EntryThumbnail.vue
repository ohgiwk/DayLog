<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';import { imageRepository } from '../lib/image-repository'
const props=defineProps<{id?:string,alt?:string}>();const url=ref('');let current=''
watch(()=>props.id,async id=>{if(current)URL.revokeObjectURL(current);current='';url.value='';if(id){const img=await imageRepository.get(id);if(img){current=URL.createObjectURL(img.blob);url.value=current}}},{immediate:true});onBeforeUnmount(()=>current&&URL.revokeObjectURL(current))
</script>
<template><img v-if="url" :src="url" :alt="alt||'日記の写真'" class="entry-thumb" /></template>
