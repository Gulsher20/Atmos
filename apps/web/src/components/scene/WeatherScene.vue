<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useMotion } from '@/composables/useMotion'
import { buildScene, type SceneConfig } from './scene-config'

const ui = useUiStore()
const settings = useSettingsStore()
const { scene, burstSignal } = storeToRefs(ui)
const { reduced } = useMotion()

const config = computed<SceneConfig>(() => buildScene(scene.value, settings.scenePreview))

const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let W = 0
let H = 0
let dpr = 1
let raf = 0
let last = 0
let time = 0

const INK = '#0E0E0E'
const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Puff { dx: number; dy: number; r: number }
interface Cloud { x: number; y: number; speed: number; puffs: Puff[]; width: number; depth: number }
interface Drop { x: number; y: number; len: number; speed: number }
interface Flake { x: number; y: number; size: number; speed: number; phase: number; rot: number; vr: number; plus: boolean }
interface Star { x: number; y: number; size: number; phase: number }
interface Streak { x: number; y: number; len: number; speed: number }
interface Splash { x: number; y: number; life: number }
interface Bolt { points: [number, number][]; branches: [number, number][][]; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; size: number; rot: number; vr: number; color: string; shape: 'square' | 'tri' | 'plus' }
interface Blip { angle: number; dist: number; glow: number }

let clouds: Cloud[] = []
let drops: Drop[] = []
let flakes: Flake[] = []
let stars: Star[] = []
let streaks: Streak[] = []
let splashes: Splash[] = []
let bolts: Bolt[] = []
let particles: Particle[] = []
let blips: Blip[] = []
let flash = 0
let nextBolt = 2
let sunAngle = 0
let sweep = 0

const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
let sky = { r: 143, g: 211, b: 255 }
let skyTarget = { ...sky }
let pattern: CanvasPattern | null = null

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function makePattern(dark: boolean) {
  const tile = document.createElement('canvas')
  tile.width = 26 * dpr
  tile.height = 26 * dpr
  const t = tile.getContext('2d')!
  t.fillStyle = dark ? 'rgba(244,240,228,0.14)' : 'rgba(14,14,14,0.12)'
  t.beginPath()
  t.arc(13 * dpr, 13 * dpr, 1.7 * dpr, 0, Math.PI * 2)
  t.fill()
  pattern = ctx!.createPattern(tile, 'repeat')
}

function makeCloud(x?: number, depth = Math.random()): Cloud {
  const scale = (0.6 + depth * 0.9) * Math.min(1.25, Math.max(0.65, W / 1200))
  const count = 3 + Math.floor(Math.random() * 3)
  const puffs: Puff[] = []
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const r = rand(26, 52) * scale * (i === 1 || i === 2 ? 1.25 : 1)
    puffs.push({ dx: cursor, dy: -r * 0.55, r })
    cursor += r * 1.15
  }
  const width = cursor
  puffs.forEach((p) => (p.dx -= width / 2))
  return { x: x ?? rand(-width, W + width), y: rand(H * 0.06, H * (config.value.precip === 'none' ? 0.5 : 0.32)), speed: rand(0.15, 0.45) * (0.5 + depth), puffs, width, depth }
}

function init() {
  const c = config.value
  skyTarget = hexToRgb(c.sky)
  makePattern(c.dark)
  clouds = Array.from({ length: c.clouds }, () => makeCloud()).sort((a, b) => a.depth - b.depth)
  drops = Array.from({ length: c.drops }, () => ({ x: rand(-100, W + 100), y: rand(-H, H), len: rand(12, 26), speed: rand(9, 15) * c.dropSpeed }))
  flakes = Array.from({ length: c.precip === 'snow' ? c.flakes : 0 }, () => ({
    x: rand(0, W), y: rand(-H, H), size: rand(3.5, 8), speed: rand(0.6, 1.6), phase: rand(0, Math.PI * 2), rot: rand(0, 6), vr: rand(-0.04, 0.04), plus: Math.random() < 0.35,
  }))
  stars = c.night ? Array.from({ length: Math.round((W * H) / 16000) }, () => ({ x: rand(0, W), y: rand(0, H * 0.75), size: rand(1.5, 4.5), phase: rand(0, 6.28) })) : []
  streaks = Array.from({ length: c.streaks }, () => ({ x: rand(-W, W), y: rand(H * 0.15, H * 0.9), len: rand(80, 200), speed: rand(4, 8) }))
  blips = c.radar ? Array.from({ length: 7 }, () => ({ angle: rand(0, Math.PI * 2), dist: rand(0.2, 0.95), glow: 0 })) : []
  splashes = []
  bolts = []
}

function resize() {
  if (!canvas.value || !ctx) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth
  H = window.innerHeight
  canvas.value.width = W * dpr
  canvas.value.height = H * dpr
  canvas.value.style.width = `${W}px`
  canvas.value.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  init()
  if (reduced.value) draw()
}

function makeBolt(x0: number): Bolt {
  const top = H * 0.22
  const ground = H * rand(0.75, 0.98)
  const points: [number, number][] = [[x0, top]]
  let x = x0
  let y = top
  while (y < ground) {
    y += rand(22, 55)
    x += rand(-45, 45)
    points.push([x, y])
  }
  const branches: [number, number][][] = []
  for (let b = 0; b < 2; b += 1) {
    const start = points[Math.floor(rand(1, points.length * 0.6))]
    if (!start) continue
    const branch: [number, number][] = [start]
    let [bx, by] = start
    const dir = Math.random() < 0.5 ? -1 : 1
    for (let i = 0; i < 4; i += 1) {
      bx += dir * rand(15, 40)
      by += rand(15, 35)
      branch.push([bx, by])
    }
    branches.push(branch)
  }
  return { points, branches, life: 1 }
}

function strike(x = rand(W * 0.1, W * 0.9)) {
  bolts.push(makeBolt(x))
  flash = 1
}

function burstAt(x: number, y: number) {
  const c = config.value
  if (c.precip === 'storm') {
    strike(x)
    return
  }
  const colors = c.precip === 'snow' ? ['#FFFFFF', '#7CC6FE'] : c.drops > 0 ? ['#7CC6FE', '#F4F0E4'] : ['#FFD400', '#FF5A1F', '#3DDC97', '#A77BFF']
  const shapes: Particle['shape'][] = c.precip === 'snow' ? ['plus', 'square'] : ['square', 'tri', 'plus']
  for (let i = 0; i < 16; i += 1) {
    const a = rand(0, Math.PI * 2)
    const s = rand(3, 9)
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1, size: rand(7, 15), rot: rand(0, 6), vr: rand(-0.25, 0.25),
      color: colors[i % colors.length]!, shape: shapes[i % shapes.length]!,
    })
  }
  if (c.drops > 0) for (let i = 0; i < 5; i += 1) splashes.push({ x: x + rand(-30, 30), y: y + rand(-10, 10), life: 1 })
}

function update(dt: number) {
  const c = config.value
  time += dt
  pointer.sx += (pointer.x - pointer.sx) * 0.05 * dt
  pointer.sy += (pointer.y - pointer.sy) * 0.05 * dt
  sky = {
    r: sky.r + (skyTarget.r - sky.r) * 0.06 * dt,
    g: sky.g + (skyTarget.g - sky.g) * 0.06 * dt,
    b: sky.b + (skyTarget.b - sky.b) * 0.06 * dt,
  }
  sunAngle += 0.004 * dt
  sweep += 0.03 * dt

  const windDrift = 1 + c.wind / 15
  for (const cl of clouds) {
    cl.x += cl.speed * windDrift * dt
    if (cl.x - cl.width > W + 60) Object.assign(cl, makeCloud(-cl.width, cl.depth))
  }

  const slant = c.slant
  for (const d of drops) {
    d.y += d.speed * dt
    d.x += slant * d.speed * dt
    if (d.y > H) {
      if (Math.random() < 0.35) splashes.push({ x: d.x, y: H - rand(4, 40), life: 1 })
      d.y = rand(-80, -10)
      d.x = rand(-100, W)
    }
  }
  splashes = splashes.filter((s) => (s.life -= 0.06 * dt) > 0)

  for (const f of flakes) {
    f.y += f.speed * dt
    f.x += (Math.sin(time * 0.02 + f.phase) * 0.8 + c.wind / 30) * dt
    f.rot += f.vr * dt
    if (f.y > H + 10) {
      f.y = -10
      f.x = rand(0, W)
    }
  }

  for (const s of streaks) {
    s.x += s.speed * windDrift * dt
    if (s.x > W + s.len) {
      s.x = -s.len - rand(0, W * 0.6)
      s.y = rand(H * 0.15, H * 0.9)
    }
  }

  if (c.precip === 'storm') {
    nextBolt -= dt / 60
    if (nextBolt <= 0) {
      strike()
      nextBolt = rand(1.6, 4.5)
    }
  }
  bolts = bolts.filter((b) => (b.life -= 0.035 * dt) > 0)
  flash = Math.max(0, flash - 0.05 * dt)

  for (const b of blips) {
    const diff = Math.abs(((sweep % (Math.PI * 2)) - b.angle + Math.PI * 2) % (Math.PI * 2))
    b.glow = diff < 0.15 ? 1 : Math.max(0, b.glow - 0.01 * dt)
  }

  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 0.35 * dt
    p.rot += p.vr * dt
    p.life -= 0.018 * dt
  }
  particles = particles.filter((p) => p.life > 0)
}

function circle(x: number, y: number, r: number) {
  ctx!.beginPath()
  ctx!.arc(x, y, r, 0, Math.PI * 2)
  ctx!.fill()
}

function drawSun(px: number, py: number) {
  const g = ctx!
  const r = Math.max(46, Math.min(110, Math.min(W, H) * 0.09))
  const x = W * 0.8 + px
  const y = H * 0.2 + py
  g.save()
  g.translate(x, y)
  g.rotate(sunAngle)
  for (let i = 0; i < 12; i += 1) {
    g.save()
    g.rotate((i / 12) * Math.PI * 2)
    g.fillStyle = INK
    g.fillRect(-r * 0.12 + 5, r * 1.28 + 5, r * 0.24, r * 0.5)
    g.fillStyle = '#FFD400'
    g.fillRect(-r * 0.12, r * 1.28, r * 0.24, r * 0.5)
    g.lineWidth = 3
    g.strokeStyle = INK
    g.strokeRect(-r * 0.12, r * 1.28, r * 0.24, r * 0.5)
    g.restore()
  }
  g.restore()
  g.fillStyle = INK
  circle(x + 9, y + 9, r)
  g.fillStyle = '#FFD400'
  circle(x, y, r)
  g.lineWidth = 4
  g.strokeStyle = INK
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.stroke()

  if (config.value.heat) {
    g.strokeStyle = 'rgba(255,90,31,0.55)'
    g.lineWidth = 3
    for (let i = 0; i < 4; i += 1) {
      const baseX = W * (0.15 + i * 0.22)
      g.beginPath()
      for (let k = 0; k <= 40; k += 1) {
        const yy = H - k * 6 - ((time * 1.2) % 60)
        const xx = baseX + Math.sin(k * 0.5 + time * 0.05 + i) * 8
        if (k === 0) g.moveTo(xx, yy)
        else g.lineTo(xx, yy)
      }
      g.stroke()
    }
  }
}

function drawMoon(px: number, py: number, skyColor: string) {
  const g = ctx!
  const r = Math.max(36, Math.min(80, Math.min(W, H) * 0.07))
  const x = W * 0.8 + px
  const y = H * 0.18 + py
  g.fillStyle = INK
  circle(x + 8, y + 8, r)
  g.fillStyle = '#F4F0E4'
  circle(x, y, r)
  g.lineWidth = 4
  g.strokeStyle = INK
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = skyColor
  circle(x + r * 0.45, y - r * 0.25, r * 0.85)
  g.beginPath()
  g.arc(x + r * 0.45, y - r * 0.25, r * 0.85, 0, Math.PI * 2)
  g.stroke()
}

function drawCloud(cl: Cloud, px: number, py: number, fill: string) {
  const g = ctx!
  const ox = cl.x + px * (0.4 + cl.depth)
  const oy = cl.y + py * (0.4 + cl.depth)
  g.fillStyle = INK
  for (const p of cl.puffs) circle(ox + p.dx + 9, oy + p.dy + 9, p.r)
  for (const p of cl.puffs) circle(ox + p.dx, oy + p.dy, p.r + 3.5)
  g.fillStyle = fill
  for (const p of cl.puffs) circle(ox + p.dx, oy + p.dy, p.r)
}

function drawRadar(dark: boolean) {
  const g = ctx!
  const r = Math.min(90, W * 0.16)
  const x = r + 28
  const y = H - r - (W < 768 ? 110 : 40)
  const line = dark ? 'rgba(244,240,228,0.45)' : 'rgba(14,14,14,0.4)'
  g.save()
  g.lineWidth = 2
  g.strokeStyle = line
  for (const k of [1, 0.66, 0.33]) {
    g.beginPath()
    g.arc(x, y, r * k, 0, Math.PI * 2)
    g.stroke()
  }
  g.beginPath()
  g.moveTo(x - r, y)
  g.lineTo(x + r, y)
  g.moveTo(x, y - r)
  g.lineTo(x, y + r)
  g.stroke()
  g.fillStyle = 'rgba(255,212,0,0.35)'
  g.beginPath()
  g.moveTo(x, y)
  g.arc(x, y, r, sweep - 0.6, sweep)
  g.closePath()
  g.fill()
  g.strokeStyle = '#FFD400'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(x + Math.cos(sweep) * r, y + Math.sin(sweep) * r)
  g.stroke()
  for (const b of blips) {
    if (b.glow <= 0.02) continue
    g.fillStyle = `rgba(255,90,31,${b.glow})`
    g.fillRect(x + Math.cos(b.angle) * b.dist * r - 4, y + Math.sin(b.angle) * b.dist * r - 4, 8, 8)
  }
  g.font = 'bold 10px "Space Mono", monospace'
  g.fillStyle = line
  g.fillText('LIVE RADAR // SIM', x - r, y + r + 16)
  g.restore()
}

function drawBolt(b: Bolt) {
  const g = ctx!
  const visible = b.life > 0.55 || Math.sin(b.life * 40) > 0
  if (!visible) return
  const path = (pts: [number, number][], width: number, color: string) => {
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.lineWidth = width
    g.strokeStyle = color
    g.lineJoin = 'miter'
    g.lineCap = 'square'
    g.stroke()
  }
  path(b.points, 13, INK)
  path(b.points, 6, '#FFD400')
  for (const br of b.branches) {
    path(br, 8, INK)
    path(br, 3, '#FFD400')
  }
}

function drawParticle(p: Particle) {
  const g = ctx!
  g.save()
  g.globalAlpha = Math.max(0, p.life)
  g.translate(p.x, p.y)
  g.rotate(p.rot)
  g.fillStyle = p.color
  g.strokeStyle = INK
  g.lineWidth = 2.5
  const s = p.size
  g.beginPath()
  if (p.shape === 'square') g.rect(-s / 2, -s / 2, s, s)
  else if (p.shape === 'tri') {
    g.moveTo(0, -s / 1.6)
    g.lineTo(s / 1.6, s / 2)
    g.lineTo(-s / 1.6, s / 2)
    g.closePath()
  } else {
    g.rect(-s / 2, -s / 6, s, s / 3)
    g.rect(-s / 6, -s / 2, s / 3, s)
  }
  g.fill()
  g.stroke()
  g.restore()
}

function draw() {
  const g = ctx
  if (!g) return
  const c = config.value
  const skyColor = `rgb(${Math.round(sky.r)},${Math.round(sky.g)},${Math.round(sky.b)})`
  const px = pointer.sx * 18
  const py = pointer.sy * 12

  g.fillStyle = skyColor
  g.fillRect(0, 0, W, H)
  if (pattern) {
    g.save()
    g.translate((time * 0.15) % 26, (time * 0.08) % 26)
    g.fillStyle = pattern
    g.fillRect(-26, -26, W + 52, H + 52)
    g.restore()
  }

  g.save()
  g.font = `${Math.round(H * 0.3)}px Anton, Impact, sans-serif`
  g.lineWidth = 3
  g.strokeStyle = c.dark ? 'rgba(244,240,228,0.16)' : 'rgba(14,14,14,0.13)'
  g.strokeText(c.word, 24 - px * 0.5, H - 30 - py * 0.3)
  g.restore()

  for (const s of stars) {
    const a = 0.45 + Math.sin(time * 0.05 + s.phase) * 0.45
    g.fillStyle = `rgba(255,212,0,${a})`
    const x = s.x + px * 0.3
    const y = s.y + py * 0.3
    g.fillRect(x - s.size, y - s.size / 3, s.size * 2, (s.size * 2) / 3)
    g.fillRect(x - s.size / 3, y - s.size, (s.size * 2) / 3, s.size * 2)
  }

  if (c.sun) drawSun(px * 0.5, py * 0.5)
  if (c.night) drawMoon(px * 0.5, py * 0.5, skyColor)

  for (const cl of clouds) drawCloud(cl, px, py, c.cloudFill)

  if (c.fog) {
    for (let i = 0; i < 4; i += 1) {
      const y = H * (0.25 + i * 0.18)
      const offset = ((time * (0.6 + i * 0.25) * (i % 2 ? -1 : 1)) % (W * 1.5)) - W * 0.25
      g.fillStyle = 'rgba(244,240,228,0.55)'
      g.strokeStyle = 'rgba(14,14,14,0.18)'
      g.lineWidth = 3
      g.beginPath()
      g.roundRect(offset, y, W * 0.9, H * 0.09, H * 0.045)
      g.fill()
      g.stroke()
    }
  }

  if (drops.length) {
    g.strokeStyle = c.dark ? 'rgba(244,240,228,0.75)' : 'rgba(14,14,14,0.6)'
    g.lineWidth = 2.5
    g.lineCap = 'square'
    g.beginPath()
    for (const d of drops) {
      g.moveTo(d.x, d.y)
      g.lineTo(d.x + c.slant * d.len, d.y + d.len)
    }
    g.stroke()
    g.lineWidth = 2
    for (const s of splashes) {
      const spread = (1 - s.life) * 14
      g.globalAlpha = s.life
      g.beginPath()
      g.moveTo(s.x - spread, s.y - spread * 0.6)
      g.lineTo(s.x - spread * 0.4, s.y)
      g.moveTo(s.x + spread, s.y - spread * 0.6)
      g.lineTo(s.x + spread * 0.4, s.y)
      g.stroke()
    }
    g.globalAlpha = 1
  }

  for (const f of flakes) {
    g.save()
    g.translate(f.x, f.y)
    g.rotate(f.rot)
    g.fillStyle = '#FFFFFF'
    g.strokeStyle = INK
    g.lineWidth = 2
    g.beginPath()
    if (f.plus) {
      g.rect(-f.size, -f.size / 3, f.size * 2, (f.size * 2) / 3)
      g.rect(-f.size / 3, -f.size, (f.size * 2) / 3, f.size * 2)
    } else {
      g.rect(-f.size / 2, -f.size / 2, f.size, f.size)
    }
    g.fill()
    g.stroke()
    g.restore()
  }

  if (streaks.length) {
    g.strokeStyle = c.dark ? 'rgba(244,240,228,0.55)' : 'rgba(14,14,14,0.45)'
    g.lineWidth = 3
    g.lineCap = 'round'
    for (const s of streaks) {
      g.beginPath()
      g.moveTo(s.x, s.y)
      g.quadraticCurveTo(s.x + s.len * 0.5, s.y - 18, s.x + s.len, s.y)
      g.arc(s.x + s.len, s.y - 10, 10, Math.PI / 2, -Math.PI, true)
      g.stroke()
    }
  }

  if (c.radar) drawRadar(c.dark)
  for (const b of bolts) drawBolt(b)
  if (flash > 0) {
    g.fillStyle = `rgba(255,255,240,${flash * 0.45})`
    g.fillRect(0, 0, W, H)
  }
  for (const p of particles) drawParticle(p)
}

function loop(t: number) {
  const dt = last ? Math.min(3, (t - last) / 16.67) : 1
  last = t
  update(dt)
  draw()
  raf = requestAnimationFrame(loop)
}

function start() {
  cancelAnimationFrame(raf)
  last = 0
  if (reduced.value) {
    update(0)
    sky = { ...skyTarget }
    draw()
  } else {
    raf = requestAnimationFrame(loop)
  }
}

function onPointerMove(e: PointerEvent) {
  pointer.x = (e.clientX / W) * 2 - 1
  pointer.y = (e.clientY / H) * 2 - 1
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea, label, [role="button"], .b-card, header, nav')) return
  burstAt(e.clientX, e.clientY)
  if (reduced.value) draw()
}

function onVisibility() {
  if (document.hidden) cancelAnimationFrame(raf)
  else start()
}

onMounted(() => {
  ctx = canvas.value?.getContext('2d') ?? null
  resize()
  start()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('visibilitychange', onVisibility)
  document.fonts?.ready.then(() => draw())
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(config, () => {
  init()
  if (reduced.value) start()
}, { deep: true })
watch(reduced, start)
watch(burstSignal, () => burstAt(W / 2, H * 0.3))
</script>

<template>
  <canvas ref="canvas" class="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
</template>
