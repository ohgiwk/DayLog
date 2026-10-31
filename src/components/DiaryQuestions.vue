<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { registerUpdatePreparation } from '../lib/update-preparation';
import AppIcon from './AppIcon.vue';
import { baseQuestions, visibleActivityQuestions } from '../data/questions';
const props = defineProps<{
  initialAnswers: Record<string, string>;
  saveAnswers: (answers: Record<string, string>) => boolean;
}>();
const emit = defineEmits<{ complete: [answers: Record<string, string>] }>();
const answers = ref({ ...props.initialAnswers });
const stopUpdatePreparation = registerUpdatePreparation(() =>
  props.saveAnswers({ ...answers.value }),
);
onBeforeUnmount(stopUpdatePreparation);
const step = ref(0);
const questions = computed(() => [
  ...baseQuestions,
  ...visibleActivityQuestions(answers.value),
]);
const current = computed(() => questions.value[step.value]);
function answer(value: string) {
  if (!current.value) return;
  answers.value = { ...answers.value, [current.value.id]: value };
  if (step.value >= questions.value.length - 1 || step.value >= 8) finish();
  else step.value++;
}
function finish() {
  emit('complete', { ...answers.value });
}
function skip() {
  for (const question of questions.value) {
    if (answers.value[question.id] === undefined)
      answers.value[question.id] = 'skip';
  }
  finish();
}
function back() {
  if (step.value === 0) {
    finish();
    return;
  }
  step.value--;
}
</script>
<template>
  <div class="diary-questions">
    <header class="journal-header"
      ><button
        type="button"
        class="icon-button"
        aria-label="編集画面へ戻る"
        @click="back"
        ><AppIcon name="chevron-left" /></button
      ><div class="progress"
        ><i :style="{ width: Math.min(88, 14 + step * 10) + '%' }"></i></div
      ><button type="button" class="text-button" @click="skip"
        >スキップ</button
      ></header
    >
    <Transition name="question" mode="out-in">
      <section v-if="current" :key="current.id" class="question-pane"
        ><div
          ><p class="eyebrow">{{ current.eyebrow || '今日を、もう少しだけ' }}</p
          ><h1>{{ current.prompt }}</h1
          ><p class="question-help"
            >考えすぎなくても大丈夫。近いものを選んでください。</p
          ></div
        ><div class="answer-grid" :class="{ moods: current.id === 'mood' }"
          ><button
            v-for="option in current.options"
            :key="option.value"
            type="button"
            @click="answer(option.value)"
            ><span v-if="option.icon"><AppIcon :name="option.icon" /></span
            >{{ option.label
            }}<b><AppIcon name="chevron-right" /></b></button></div
      ></section>
    </Transition>
  </div>
</template>
<style scoped>
.diary-questions {
  padding-bottom: 40px;
}
</style>
