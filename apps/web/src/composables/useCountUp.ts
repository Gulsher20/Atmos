import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useMotion } from './useMotion'

/** Animates a number towards its latest value. */
export function useCountUp(source: Ref<number>, duration = 700) {
  const { reduced } = useMotion()
  const display = ref(source.value)
  let frame = 0

  watch(
    source,
    (to, from) => {
      cancelAnimationFrame(frame)
      if (reduced.value || from === undefined) {
        display.value = to
        return
      }
      const start = performance.now()
      const origin = display.value
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration)
        const eased = 1 - (1 - p) ** 3
        display.value = Math.round(origin + (to - origin) * eased)
        if (p < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return display
}
