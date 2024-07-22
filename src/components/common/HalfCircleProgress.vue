<script setup lang="ts">
import {computed, ref} from "vue";

const props = defineProps({
  strokeWidth: {type: Number, default: 5},
  type: {type: String, default: 'dashboard'},
  width: {type: Number, default: 50},
  percentage:{type: Number, default: 0},
  color: {type: String, default: '#FE913F'},
  trackColor: {type: String, default: '#c2c2c2'}
})
const relativeStrokeWidth = computed(() => (props.strokeWidth / props.width * 100).toFixed(1));
const radius = computed(() => {
  if (["circle", "dashboard"].includes(props.type)) {
    return Number.parseInt(`${50 - Number.parseFloat(relativeStrokeWidth.value) / 2}`, 10);
  }
  return 0;
});
const trackPath = computed(() => {
  const r = radius.value;
  const isDashboard = props.type === "dashboard";
  return `
          M 50 50
          m 0 ${isDashboard ? "" : "-"}${r}
          a ${r} ${r} 0 1 1 0 ${isDashboard ? "-" : ""}${r * 2}
          a ${r} ${r} 0 1 1 0 ${isDashboard ? "" : "-"}${r * 2}
          `;
});
const rate = ref(0.5)
const perimeter = computed(() => 2 * Math.PI * radius.value);

const strokeDashoffset = computed(() => {
  const offset = -1 * perimeter.value * (1 - rate.value) / 2;
  return `${offset}px`;
});
const trailPathStyle = computed(() => ({
  strokeDasharray: `${perimeter.value * rate.value}px, ${perimeter.value}px`,
  strokeDashoffset: strokeDashoffset.value
}));
const circlePathStyle = computed(() => ({
  strokeDasharray: `${perimeter.value * rate.value * (props.percentage / 100)}px, ${perimeter.value}px`,
  strokeDashoffset: strokeDashoffset.value,
  transition: "stroke-dasharray 0.6s ease 0s, stroke 0.6s ease, opacity ease 0.6s"
}));
</script>


<template>
  <div class="el-progress el-progress--dashboard w-full h-full">
    <div class="el-progress-circle w-full h-full relative">
      <svg viewBox="0 0 100 100">
        <path class="el-progress-circle__track bg-grey-light-active"
              :d="trackPath"
              :stroke="trackColor"
              fill="none"
              :stroke-width="relativeStrokeWidth"
              :style="trailPathStyle"></path>
        <path class="el-progress-circle__path"
              :d="trackPath"
              :stroke="color"
              fill="none"
              :opacity="percentage?1:0"
              :stroke-width="relativeStrokeWidth"
              :style="circlePathStyle"></path>
      </svg>
      <slot name="default"></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.progress-pointer {
  clip-path: polygon(70% 0, 100% 50%, 70% 100%, 0 50%);
}
</style>
