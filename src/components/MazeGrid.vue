<script setup lang="ts">
/**
 * MazeGrid — Canvas-based maze tile renderer
 *
 * 架构：
 * - <canvas> 绘制所有静态/动态 tile（wall / road / coin / trap / S / E / B）
 * - 最优路径白色光晕：第二次 canvas pass，shadowBlur 叠加在路径格上
 * - 玩家用绝对定位 div 叠加在 canvas 上，transitionMs prop 控制速度
 * - 陷阱被踩后替换为 trap_vacant 贴图
 * - 浮动特效（+N / -N）由父组件维护，MazeGrid 只负责渲染
 */

import { computed, onMounted, useTemplateRef, watch } from 'vue'
import type { MazeSymbol, Position } from '../types/level'

export interface FloatingEffect {
  id: number
  x: number
  y: number
  value: number
  type: 'coin' | 'trap'
}

import wall1Src      from '../assets/images/maze/wall1.png'
import wall2Src      from '../assets/images/maze/wall2.png'
import road1Src      from '../assets/images/maze/road1.png'
import road2Src      from '../assets/images/maze/road2.png'
import road3Src      from '../assets/images/maze/road3.png'
import road4Src      from '../assets/images/maze/road4.png'
import coinSrc       from '../assets/images/maze/coin.png'
import trapSrc       from '../assets/images/maze/trap.png'
import trapVacantSrc from '../assets/images/maze/trap_vacant.png'
import bossSrc       from '../assets/images/maze/boss.png'
import playerSrc     from '../assets/images/boss/player.png'

/* ─── tile image management ─────────────────────────────── */

type TileKey =
  | 'wall1' | 'wall2'
  | 'road1' | 'road2' | 'road3' | 'road4'
  | 'coin'  | 'trap'  | 'trap_vacant' | 'boss'

const TILE_SRCS: Record<TileKey, string> = {
  wall1: wall1Src, wall2: wall2Src,
  road1: road1Src, road2: road2Src, road3: road3Src, road4: road4Src,
  coin:  coinSrc,  trap:  trapSrc,  trap_vacant: trapVacantSrc, boss: bossSrc,
}

const imgs: Partial<Record<TileKey, HTMLImageElement>> = {}
let imagesReady = false

function loadImages(): Promise<void> {
  const entries = Object.entries(TILE_SRCS) as [TileKey, string][]
  return Promise.all(
    entries.map(([key, src]) =>
      new Promise<void>(resolve => {
        const img = new Image()
        img.onload  = () => { imgs[key] = img; resolve() }
        img.onerror = () => resolve()
        img.src = src
      }),
    ),
  ).then(() => { imagesReady = true })
}

/* ─── deterministic tile hash ────────────────────────────── */

function tileHash(row: number, col: number): number {
  let h = Math.imul(row, 2654435761) ^ Math.imul(col, 2246822519)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

const WALL_KEYS: TileKey[] = ['wall1', 'wall2']
const ROAD_KEYS: TileKey[] = ['road1', 'road2', 'road3', 'road4']

/* ─── props ──────────────────────────────────────────────── */

const props = withDefaults(defineProps<{
  /** 迷宫矩阵 */
  maze: MazeSymbol[][]
  /** 玩家当前坐标（列 x，行 y） */
  playerPos?: Position | null
  /** 已消耗格子（金币已拾取 / 陷阱已触发） */
  consumedCells?: Position[]
  /** 已访问格子（用于路径高亮） */
  visitedCells?: Position[]
  /** 陷阱触发后的格子（使用 trap_vacant 贴图） */
  trapConsumedCells?: Position[]
  /** 最优路径坐标（用于白色光晕渲染） */
  solvePath?: Position[]
  /** 浮动特效列表（金币 +N / 陷阱 -N） */
  floatingEffects?: FloatingEffect[]
  /** 玩家移动 CSS transition 时长（ms），跟随播放速度变化 */
  transitionMs?: number
  /** 每格像素尺寸 */
  tileSize?: number
}>(), {
  playerPos:         null,
  consumedCells:     () => [],
  visitedCells:      () => [],
  trapConsumedCells: () => [],
  solvePath:         () => [],
  floatingEffects:   () => [],
  transitionMs:      180,
  tileSize:          40,
})

/* ─── computed ───────────────────────────────────────────── */

const rows    = computed(() => props.maze.length)
const cols    = computed(() => props.maze[0]?.length ?? 0)
const canvasW = computed(() => cols.value * props.tileSize)
const canvasH = computed(() => rows.value * props.tileSize)

const consumedSet = computed(() =>
  new Set(props.consumedCells.map(p => `${p.y},${p.x}`))
)
const visitedSet = computed(() =>
  new Set(props.visitedCells.map(p => `${p.y},${p.x}`))
)
const trapConsumedSet = computed(() =>
  new Set((props.trapConsumedCells ?? []).map(p => `${p.y},${p.x}`))
)
/** 玩家图层绝对定位 style，transition 跟随 transitionMs */
const playerStyle = computed(() => {
  if (!props.playerPos) return { display: 'none' }
  const { x, y } = props.playerPos
  const ts = props.tileSize
  const ms = props.transitionMs
  return {
    left:       `${x * ts}px`,
    top:        `${y * ts}px`,
    width:      `${ts}px`,
    height:     `${ts}px`,
    transition: `left ${ms}ms cubic-bezier(0.4,0,0.2,1), top ${ms}ms cubic-bezier(0.4,0,0.2,1)`,
  }
})

/* ─── canvas rendering ───────────────────────────────────── */

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

function drawBadge(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  ts: number,
  label: string,
  color: string,
) {
  const pad = ts * 0.15
  const r   = ts * 0.18

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(px + pad, py + pad, ts - 2 * pad, ts - 2 * pad, r)
  ctx.fill()

  ctx.fillStyle    = '#ffffff'
  ctx.font         = `900 ${Math.round(ts * 0.4)}px "Inter", sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, px + ts / 2, py + ts / 2)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !imagesReady) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const ts   = props.tileSize
  const cSet = consumedSet.value
  const vSet = visitedSet.value
  const tSet = trapConsumedSet.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  /* ── Pass 1：绘制所有格子（地面 + 道具 + 特殊标签） ─── */
  for (let row = 0; row < props.maze.length; row++) {
    for (let col = 0; col < props.maze[row].length; col++) {
      const sym: MazeSymbol = props.maze[row][col]
      const hash = tileHash(row, col)
      const px   = col * ts
      const py   = row * ts
      const key  = `${row},${col}`
      const consumed       = cSet.has(key)
      const isTrapConsumed = tSet.has(key)

      const effective: MazeSymbol =
        consumed && (sym === 'C' || sym === 'G' || sym === 'T') ? ' ' : sym

      /* 1. 底层 tile */
      if (sym === '#') {
        const img = imgs[WALL_KEYS[hash % WALL_KEYS.length]]
        if (img) {
          ctx.drawImage(img, px, py, ts, ts)
        } else {
          ctx.fillStyle = '#1a2035'
          ctx.fillRect(px, py, ts, ts)
        }
      } else {
        // 陷阱踩过后用 trap_vacant 贴图，视觉区别于普通地面
        const roadKey: TileKey = isTrapConsumed ? 'trap_vacant' : ROAD_KEYS[hash % ROAD_KEYS.length]
        const img = imgs[roadKey]
        if (img) {
          ctx.drawImage(img, px, py, ts, ts)
        } else {
          ctx.fillStyle = '#2d3748'
          ctx.fillRect(px, py, ts, ts)
        }

        /* 2. 已访问路径高亮（金色半透明渐变） */
        if (vSet.has(key) && effective === ' ') {
          ctx.fillStyle = 'rgba(251,191,36,0.18)'
          ctx.fillRect(px, py, ts, ts)
        }

        /* 3. 道具图层 */
        if (effective === 'C' || effective === 'G') {
          const coinImg = imgs.coin
          if (coinImg) ctx.drawImage(coinImg, px, py, ts, ts)
          else drawBadge(ctx, px, py, ts, 'C', 'rgba(234,179,8,0.9)')
        } else if (effective === 'T') {
          const trapImg = imgs.trap
          if (trapImg) ctx.drawImage(trapImg, px, py, ts, ts)
          else drawBadge(ctx, px, py, ts, 'T', 'rgba(239,68,68,0.9)')
        }

        /* 4. 特殊格子角标 */
        if (sym === 'S') {
          drawBadge(ctx, px, py, ts, 'S', 'rgba(34,197,94,0.88)')
        } else if (sym === 'E') {
          drawBadge(ctx, px, py, ts, 'E', 'rgba(59,130,246,0.88)')
        } else if (sym === 'B') {
          const bossImg = imgs.boss
          if (bossImg) ctx.drawImage(bossImg, px, py, ts, ts)
          else drawBadge(ctx, px, py, ts, 'B', 'rgba(239,68,68,0.88)')
        }
      }

      /* 5. 网格线 */
      if (ts >= 28) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'
        ctx.lineWidth   = 0.5
        ctx.strokeRect(px + 0.25, py + 0.25, ts - 0.5, ts - 0.5)
      }
    }
  }

  /* ── Pass 2：最优路径白色光晕（连续折线，无断隙） ─────── */
  const pathArr = props.solvePath ?? []
  if (pathArr.length >= 2) {
    const half = ts / 2

    // 外层：宽线 + 大光晕（扩散型光芒）
    ctx.save()
    ctx.shadowColor = 'rgba(200, 235, 255, 0.92)'
    ctx.shadowBlur  = Math.max(12, ts * 0.7)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)'
    ctx.lineWidth   = Math.max(5, ts * 0.30)
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(pathArr[0].x * ts + half, pathArr[0].y * ts + half)
    for (let i = 1; i < pathArr.length; i++) {
      ctx.lineTo(pathArr[i].x * ts + half, pathArr[i].y * ts + half)
    }
    ctx.stroke()
    ctx.restore()

    // 内层：细线 + 锐利高亮（亮芯）
    ctx.save()
    ctx.shadowColor = 'rgba(255, 255, 255, 1)'
    ctx.shadowBlur  = Math.max(4, ts * 0.20)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)'
    ctx.lineWidth   = Math.max(1.5, ts * 0.09)
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(pathArr[0].x * ts + half, pathArr[0].y * ts + half)
    for (let i = 1; i < pathArr.length; i++) {
      ctx.lineTo(pathArr[i].x * ts + half, pathArr[i].y * ts + half)
    }
    ctx.stroke()
    ctx.restore()
  }

}

/* ─── lifecycle ─────────────────────────────────────────── */

onMounted(async () => {
  await loadImages()
  draw()
})

watch(
  [
    () => props.maze,
    () => props.consumedCells,
    () => props.visitedCells,
    () => props.trapConsumedCells,
    () => props.solvePath,
    () => props.tileSize,
  ],
  () => draw(),
  { deep: false },
)
</script>

<template>
  <div
    class="maze-wrap"
    :style="{ width: `${canvasW}px`, height: `${canvasH}px` }"
  >
    <!-- 静态/动态 tile 层 -->
    <canvas
      ref="canvas"
      class="maze-canvas"
      :width="canvasW"
      :height="canvasH"
    />

    <!-- 玩家层：绝对定位，transition 由 playerStyle 动态注入 -->
    <div
      class="player-layer"
      :style="playerStyle"
    >
      <img
        :src="playerSrc"
        alt="player"
        class="player-img"
        draggable="false"
      />
    </div>

    <!-- 浮动特效层：金币 +N / 陷阱 -N -->
    <TransitionGroup name="float-up" tag="div" class="effects-layer">
      <div
        v-for="eff in (floatingEffects ?? [])"
        :key="eff.id"
        class="float-effect"
        :class="eff.type === 'coin' ? 'effect-coin' : 'effect-trap'"
        :style="{
          left: `${eff.x * tileSize + tileSize / 2}px`,
          top:  `${eff.y * tileSize - 4}px`,
        }"
      >{{ eff.value > 0 ? '+' : '' }}{{ eff.value }}</div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.maze-wrap {
  position: relative;
  display: inline-block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  border-radius: 6px;
  overflow: visible; /* 允许路径光晕溢出 */
  box-shadow:
    0 0 0 2px rgba(251,191,36,0.22),
    0 8px 40px rgba(0,0,0,0.55);
}

.maze-canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  border-radius: 6px;
}

.player-layer {
  position: absolute;
  top: 0;
  left: 0;
  /* transition 由 playerStyle 动态绑定，这里不再硬编码 */
  z-index: 5;
  pointer-events: none;
  will-change: left, top;
}

.player-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7)) brightness(1.1);
}

/* ── floating effects ── */
.effects-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  overflow: visible;
}

.float-effect {
  position: absolute;
  transform: translateX(-50%);
  font-size: 1.15rem;
  font-weight: 900;
  white-space: nowrap;
  line-height: 1;
  letter-spacing: 0.03em;
  pointer-events: none;
}

.effect-coin {
  color: #fde68a;
  text-shadow:
    0 0 4px rgba(251,191,36,1),
    0 0 12px rgba(251,191,36,0.85),
    0 0 28px rgba(251,191,36,0.5);
  animation: effect-float 1.1s cubic-bezier(0.15, 0.8, 0.35, 1) forwards;
}

.effect-trap {
  color: #fca5a5;
  text-shadow:
    0 0 4px rgba(248,113,113,1),
    0 0 12px rgba(248,113,113,0.85),
    0 0 28px rgba(248,113,113,0.5);
  animation: effect-float 1.1s cubic-bezier(0.15, 0.8, 0.35, 1) forwards;
}

@keyframes effect-float {
  0%   { opacity: 1;   transform: translateX(-50%) translateY(0px)   scale(1.2);  }
  12%  { opacity: 1;   transform: translateX(-50%) translateY(-8px)  scale(1.4);  }
  100% { opacity: 0;   transform: translateX(-50%) translateY(-60px) scale(0.85); }
}

.float-up-enter-active {
  animation: effect-float 1.1s cubic-bezier(0.15, 0.8, 0.35, 1) forwards;
}
.float-up-leave-active { display: none; }
</style>
