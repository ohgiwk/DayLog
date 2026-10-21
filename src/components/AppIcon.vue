<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ name: string }>()
const aliases: Record<string, string> = { '😌':'smile', '🙂':'smile', '🌿':'leaf', '🌧️':'cloud', '🌙':'moon', '☀️':'sun', '☁️':'cloud', '🍃':'leaf', '○':'circle', '◌':'circle-dashed', '—':'minus', '…':'more', '🚶':'walk', '🏃':'walk', '🧘':'person', '🏸':'activity' }
const paths: Record<string, string> = {
 'calendar-month':'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 2v4M17 2v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01M17 18h.01',
 'calendar-week':'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 2v4M17 2v4M3 10h18M7 15h10',
 'calendar-hidden':'M9 4h10a2 2 0 0 1 2 2v10M17 2v4M3 10h7M3 7v12a2 2 0 0 0 2 2h12M3 3l18 18',
 refresh:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3',
 image:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 13 5-5 4 4 3-3 6 6M9 7h.01',
 'message-question':'M5 3h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8l-5 3V5a2 2 0 0 1 2-2ZM9.8 8a2.2 2.2 0 0 1 4.4 0c0 1.5-2.2 1.8-2.2 3.5M12 15h.01',
 'clear-format':'M4 4h13M10 4v10m-4 4h5m3-4 6 6m0-6-6 6',
 bold:'M6 4h7a4 4 0 0 1 0 8H6m0-8v16h8a4 4 0 0 0 0-8H6',
 italic:'M10 4h10M4 20h10M15 4 9 20',
 underline:'M6 3v8a6 6 0 0 0 12 0V3M4 21h16',
 heading:'M4 4v16M16 4v16M4 12h12M20 16v4',
 paragraph:'M13 20V4h6M17 4v16M13 4H9a5 5 0 0 0 0 10h4',
 'list-bullet':'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',
 'list-number':'M10 6h11M10 12h11M10 18h11M3 3h1v6M2 9h4M2 15a2 2 0 0 1 4 0c0 2-4 2-4 5h4',
 quote:'M4 6h6v7H4V6m6 7c0 4-2 5-4 5M14 6h6v7h-6V6m6 7c0 4-2 5-4 5',
 undo:'m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12',
 redo:'m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
 'chevron-left':'m15 5-7 7 7 7', 'chevron-right':'m9 5 7 7-7 7',
 'arrow-right':'M4 12h16m-6-6 6 6-6 6', plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6', check:'m5 12 4 4L19 6',
 home:'m3 10 9-7 9 7v10H3V10m6 10v-7h6v7', records:'M5 3h14v18H5V3m3 5h8M8 12h8M8 16h8',
 'notebook-pen':'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M7 3v18M10 16l1-4L19 4a2.1 2.1 0 0 1 3 3l-8 8-4 1ZM17 6l3 3',
 note:'M5 3h10l4 4v14H5V3m10 0v5h4M8 12h8M8 16h6',
 chart:'M12 3v9h9M9 3.5a9 9 0 1 0 11.5 11.5',
 settings:'m9 3-.5 3-2 1-2.8-1-2 3.5L4 11v2l-2.3 1.5 2 3.5 2.8-1 2 1 .5 3h6l.5-3 2-1 2.8 1 2-3.5L20 13v-2l2.3-1.5-2-3.5-2.8 1-2-1L15 3H9m6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 folder:'M3 6h7l2 3h9v11H3V6Z', camera:'M3 7h4l2-3h6l2 3h4v13H3V7m13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3m5 3h4M12 2v2',
 pin:'M12 22s8-8 8-13a8 8 0 0 0-16 0c0 5 8 13 8 13m3-13a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 cloud:'M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-1 4.5 4.5 0 0 1 0 9H6Z',
 text:'M3 5h12M9 5v15m6-10h7m-3.5 0v10', motion:'M3 6h11M3 12h7M3 18h11m3-12 4 6-4 6',
 circle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 'circle-dashed':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', minus:'M5 12h14', more:'M5 12h.01M12 12h.01M19 12h.01',
 smile:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8 9h.01M16 9h.01m-8 6q4 4 8 0',
 leaf:'M4 20C0 7 11 3 21 3c0 12-5 17-13 14M3 21 16 8',
 moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
 sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
 walk:'M15 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-6 8 2-4h3l2 5h4m-7-5-2 7-5 6m5-6 5 6',
 person:'M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0M5 10h14m-7-2v7m0 0-6 6m6-6 6 6',
 activity:'M2 12h5l3-8 4 16 3-8h5',
}
const name = computed(() => aliases[props.name] || props.name)
</script>
<template><svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path :d="paths[name] || paths.circle" :stroke-dasharray="name === 'circle-dashed' ? '2 4' : undefined" /></svg></template>
<style scoped>.app-icon{display:inline-block;width:20px;height:20px;flex-shrink:0;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}</style>
