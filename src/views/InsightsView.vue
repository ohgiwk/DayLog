<script setup lang="ts">
import { computed } from 'vue';import { entries } from '../stores/diary';const total=computed(()=>entries.value.length),rate=computed(()=>Math.round(entries.value.filter(e=>Date.now()-new Date(e.date).getTime()<28*864e5).length/28*100));const moods=computed(()=>[1,2,3,4,5].map(n=>entries.value.filter(e=>e.mood===n).length));const max=computed(()=>Math.max(...moods.value,1))
</script>
<template><div class="page"><header class="page-header"><p class="eyebrow">A GENTLE LOOK BACK</p><h1>振り返り</h1><p>小さな記録から、あなたの心地よいリズムを見つけます。</p></header><div class="stat-grid"><article><span>直近4週間</span><strong>{{rate}}<small>%</small></strong><p>記録した日の割合</p></article><article><span>これまで</span><strong>{{total}}<small>日</small></strong><p>残した日々</p></article></div><section class="soft-card chart-card"><p class="eyebrow">MOOD BALANCE</p><h2>最近の気分</h2><p v-if="!total" class="question-help">まだ日記がありません。記録すると気分の変化を確認できます。</p><div v-else class="bars"><div v-for="(v,i) in moods"><i :style="{height:v/max*100+'%'}"></i><span>{{['🌙','🌧️','🌿','🙂','😌'][i]}}</span></div></div></section></div></template>

<style scoped>
.bars i{min-height:0}
</style>
