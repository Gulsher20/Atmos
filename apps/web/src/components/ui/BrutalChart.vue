<script setup lang="ts">
import { computed, ref } from 'vue'

export interface ChartSeries {
  name: string
  color: string
  values: (number | null)[]
  /** Draw as bars instead of a line. */
  bars?: boolean
  dashed?: boolean
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: ChartSeries[]
    height?: number
    format?: (value: number) => string
    summary: string
    zeroBased?: boolean
  }>(),
  { height: 220, format: (v: number) => `${Math.round(v * 10) / 10}`, zeroBased: false },
)

const W = 720
const PAD = { top: 18, right: 14, bottom: 30, left: 44 }
const hover = ref<number | null>(null)

const all = computed(() => props.series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v))))
const range = computed(() => {
  if (!all.value.length) return { min: 0, max: 1 }
  let min = Math.min(...all.value)
  let max = Math.max(...all.value)
  if (props.zeroBased || props.series.some((s) => s.bars)) min = Math.min(0, min)
  if (max === min) max = min + 1
  const pad = (max - min) * 0.08
  return { min: props.zeroBased ? min : min - pad, max: max + pad }
})

const innerW = W - PAD.left - PAD.right
const innerH = computed(() => props.height - PAD.top - PAD.bottom)
const n = computed(() => Math.max(1, props.labels.length))
const step = computed(() => innerW / n.value)
const x = (i: number) => PAD.left + step.value * (i + 0.5)
const y = (v: number) => PAD.top + innerH.value * (1 - (v - range.value.min) / (range.value.max - range.value.min))

const ticks = computed(() => Array.from({ length: 4 }, (_, i) => range.value.min + ((range.value.max - range.value.min) * i) / 3))
const labelEvery = computed(() => Math.max(1, Math.ceil(n.value / 8)))

function linePath(values: (number | null)[]) {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    pen = true
  })
  return d
}

const barSeries = computed(() => props.series.filter((s) => s.bars))
const barWidth = computed(() => Math.max(2, (step.value * 0.72) / Math.max(1, barSeries.value.length)))

function onMove(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((event.clientX - rect.left) / rect.width) * W
  const i = Math.floor((px - PAD.left) / step.value)
  hover.value = i >= 0 && i < n.value ? i : null
}
</script>

<template>
  <figure class="relative">
    <svg
      :viewBox="`0 0 ${W} ${height}`"
      class="w-full touch-pan-y select-none"
      role="img"
      :aria-label="summary"
      @pointermove="onMove"
      @pointerleave="hover = null"
    >
      <g class="font-mono" font-size="11" fill="#0E0E0E">
        <g v-for="t in ticks" :key="t">
          <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" stroke="#0E0E0E" stroke-opacity="0.15" stroke-dasharray="4 4" />
          <text :x="PAD.left - 8" :y="y(t) + 4" text-anchor="end">{{ format(t) }}</text>
        </g>
        <template v-for="(label, i) in labels" :key="i">
          <text v-if="i % labelEvery === 0" :x="x(i)" :y="height - 8" text-anchor="middle">{{ label }}</text>
        </template>
      </g>
      <line :x1="PAD.left" :x2="W - PAD.right" :y1="PAD.top + innerH" :y2="PAD.top + innerH" stroke="#0E0E0E" stroke-width="3" />

      <rect v-if="hover !== null" :x="PAD.left + step * hover" :y="PAD.top" :width="step" :height="innerH" fill="#FFD400" fill-opacity="0.35" />

      <g v-for="(s, si) in barSeries" :key="s.name">
        <template v-for="(v, i) in s.values" :key="i">
          <rect
            v-if="v !== null"
            class="origin-bottom animate-[pop_0.4s_ease-out_both]"
            :style="{ animationDelay: `${i * 18}ms`, transformBox: 'fill-box' }"
            :x="x(i) - (barWidth * barSeries.length) / 2 + si * barWidth"
            :y="Math.min(y(v), y(Math.max(0, range.min)))"
            :width="barWidth - 1"
            :height="Math.abs(y(Math.max(0, range.min)) - y(v))"
            :fill="s.color"
            stroke="#0E0E0E"
            stroke-width="2"
          />
        </template>
      </g>

      <g v-for="s in series.filter((s) => !s.bars)" :key="s.name">
        <path :d="linePath(s.values)" fill="none" stroke="#0E0E0E" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="chart-draw" />
        <path
          :d="linePath(s.values)"
          fill="none"
          :stroke="s.color"
          stroke-width="3.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          :stroke-dasharray="s.dashed ? '8 6' : undefined"
          pathLength="1"
          :class="s.dashed ? '' : 'chart-draw'"
        />
        <template v-if="hover !== null && s.values[hover] !== null && s.values[hover] !== undefined">
          <rect :x="x(hover) - 6" :y="y(s.values[hover]!) - 6" width="12" height="12" :fill="s.color" stroke="#0E0E0E" stroke-width="3" />
        </template>
      </g>
    </svg>

    <div
      v-if="hover !== null"
      class="pointer-events-none absolute top-0 z-10 border-3 border-ink bg-ink px-3 py-2 font-mono text-[11px] text-paper shadow-brutal-sm"
      :style="{ left: `${Math.min(78, (x(hover) / W) * 100)}%` }"
    >
      <div class="mb-1 font-bold text-sun">{{ labels[hover] }}</div>
      <div v-for="s in series" :key="s.name" class="flex items-center gap-2 whitespace-nowrap">
        <span class="inline-block h-2.5 w-2.5 border border-paper" :style="{ background: s.color }" />
        {{ s.name }}: {{ s.values[hover] === null || s.values[hover] === undefined ? '—' : format(s.values[hover]!) }}
      </div>
    </div>

    <figcaption class="mt-2 flex flex-wrap gap-2">
      <span v-for="s in series" :key="s.name" class="b-chip bg-paper">
        <span class="inline-block h-2.5 w-2.5 border-2 border-ink" :style="{ background: s.color }" />{{ s.name }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.chart-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 1.1s cubic-bezier(0.3, 0.8, 0.3, 1) forwards;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
