<script setup lang="ts">
/**
 * MazeView — 迷宫主视图
 *
 * 核心变化（v3）：
 * - 不再依赖后端 events 驱动角色移动
 * - 直接用 resourceResult.path（最优路径坐标数组）逐格步进
 * - currentPathIndex 是唯一驱动变量（-1 = 未开始）
 * - consumedCells / trapConsumedCells / coins 全由 currentPathIndex
 *   + collectedResources 计算，支持任意拖拽 seek
 * - 浮动特效 watch currentPathIndex 前进方向触发
 * - Canvas 路径光晕改用 polyline（折线），消除断隙
 */

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { generateLevel, solveLevel } from '../api/level'
import type { GenerateLevelRequest, SolveLevelResponse } from '../api/level'
import type { GridCoord, LevelDefinition, Position, Resource } from '../types'
import BossGameOverOverlay from '../components/BossGameOverOverlay.vue'
import MazeGrid from '../components/MazeGrid.vue'
import type { FloatingEffect } from '../components/MazeGrid.vue'

/* ─── props / emits ──────────────────────────────────────── */

const props = withDefaults(defineProps<{
  generateRequest?: GenerateLevelRequest
  bossCleared?: boolean
}>(), {
  generateRequest: undefined,
  bossCleared: false,
})

const emit = defineEmits<{
  enterBoss: [{ level: LevelDefinition; coins: number }]
  gameOver: []
}>()

/* ─── API state ──────────────────────────────────────────── */

const level       = shallowRef<LevelDefinition | null>(null)
const solveResult = shallowRef<SolveLevelResponse | null>(null)
const isLoading   = ref(false)
const isSolving   = ref(false)
const loadError   = ref('')
const showGameOverOverlay = ref(false)

/* ─── path playback state ────────────────────────────────── */

/**
 * -1 = 未开始，0..n-1 = 当前站在路径第 n 格
 * 这是整个动画的唯一驱动变量
 */
const currentPathIndex = ref(-1)
const isPlaying        = ref(false)
/** 每步毫秒数（值越小越快） */
const speedMs          = ref(280)
let playTimer: ReturnType<typeof setTimeout> | undefined
let failureTimer: ReturnType<typeof setTimeout> | undefined
let bossEncountered = false

/* ─── floating effects ───────────────────────────────────── */

const floatingEffects = ref<FloatingEffect[]>([])
let effectIdCounter = 0

/* ─── path debug state ───────────────────────────────────── */

const showPathDebug = ref(false)

/* ─── derived: solve data ────────────────────────────────── */

const resourceResult = computed(() => solveResult.value?.resource ?? null)

/**
 * 后端返回的最优路径。
 * 新接口路径坐标约定：[row, col]
 * 前端坐标约定：x = 列(col)，y = 行(row)
 * 这里在入口处统一转置，后续所有代码均使用前端约定
 */
function backendCoordToPosition(coord: GridCoord): Position {
  const [row, col] = coord
  return { x: col, y: row }
}

const solvePath = computed<Position[]>(() =>
  (resourceResult.value?.path ?? []).map(backendCoordToPosition)
)

const mazePath = computed<Position[]>(() => solvePath.value)

/** 某格的迷宫符号（用于调试高亮） */
function cellSymbol(pos: Position): string {
  return level.value?.maze[pos.y]?.[pos.x] ?? '?'
}

/**
 * 资源 Map：`"row,col"` → Resource
 * 用于快速查询某格是否有金币/陷阱及其价值
 */
const resourceMap = computed(() => {
  const map = new Map<string, Resource>()
  for (const res of (resourceResult.value?.collectedResources ?? [])) {
    // 后端 position.x = row, position.y = col；转置后 key = "row,col" = "${x_backend},${y_backend}"
    map.set(`${res.position.x},${res.position.y}`, res)
  }
  return map
})

function positionKey(pos: Position) {
  return `${pos.y},${pos.x}`
}

function isFirstResourceVisit(index: number, pos: Position) {
  const key = positionKey(pos)
  if (!resourceMap.value.has(key)) return false

  for (let i = 0; i < index; i++) {
    const prev = mazePath.value[i]
    if (prev && positionKey(prev) === key) {
      return false
    }
  }

  return true
}

/* ─── derived: start position ────────────────────────────── */

const startPos = computed<Position | null>(() => {
  if (!level.value) return null
  const maze = level.value.maze
  for (let r = 0; r < maze.length; r++) {
    for (let c = 0; c < maze[r].length; c++) {
      if (maze[r][c] === 'S') return { x: c, y: r }
    }
  }
  return null
})

/* ─── derived: player position ───────────────────────────── */

const playerPos = computed<Position | null>(() => {
  const idx = currentPathIndex.value
  if (idx < 0) return startPos.value
  return mazePath.value[idx] ?? startPos.value
})

/* ─── derived: visited cells (trail) ────────────────────── */

const visitedCells = computed<Position[]>(() => {
  const idx = currentPathIndex.value
  if (idx < 0) return []
  return mazePath.value.slice(0, idx + 1)
})

/* ─── derived: consumed & trap cells ────────────────────── */

/** 已经经过的有资源的格子（金币/陷阱均在此，使其在 canvas 消失） */
const consumedCells = computed<Position[]>(() => {
  const cells: Position[] = []
  const seen = new Set<string>()
  const path = mazePath.value
  const rMap = resourceMap.value
  const cap  = currentPathIndex.value
  for (let i = 0; i <= cap; i++) {
    const pos = path[i]
    if (!pos) continue
    const key = positionKey(pos)
    if (rMap.has(key) && !seen.has(key)) {
      seen.add(key)
      cells.push(pos)
    }
  }
  return cells
})

/** 已经经过的陷阱格（替换为 trap_vacant 贴图） */
const trapConsumedCells = computed<Position[]>(() => {
  const cells: Position[] = []
  const seen = new Set<string>()
  const path = mazePath.value
  const rMap = resourceMap.value
  const cap  = currentPathIndex.value
  for (let i = 0; i <= cap; i++) {
    const pos = path[i]
    if (!pos) break
    const key = positionKey(pos)
    const res = rMap.get(key)
    if (res?.type === 'trap' && !seen.has(key)) {
      seen.add(key)
      cells.push(pos)
    }
  }
  return cells
})

/* ─── derived: coins ─────────────────────────────────────── */

const currentCoins = computed(() => {
  let sum = 0
  const seen = new Set<string>()
  const path = mazePath.value
  const rMap = resourceMap.value
  const cap  = currentPathIndex.value
  for (let i = 0; i <= cap; i++) {
    const pos = path[i]
    if (!pos) break
    const key = positionKey(pos)
    const res = rMap.get(key)
    if (res && !seen.has(key)) {
      seen.add(key)
      sum += res.value
    }
  }
  return sum
})

/* ─── derived: current event badge ──────────────────────── */

interface SimpleEvent {
  type: string
  message: string
  coinDelta?: number
}

const currentEvent = computed<SimpleEvent | null>(() => {
  const idx = currentPathIndex.value
  if (idx < 0) return null
  const pos = mazePath.value[idx]
  if (!pos) return null
  const res = resourceMap.value.get(positionKey(pos))
  if (res && isFirstResourceVisit(idx, pos)) {
    return {
      type:      res.type === 'coin' ? 'collect_coin' : 'trigger_trap',
      message:   res.type === 'coin' ? `拾取金币 +${res.value}` : `触发陷阱 ${res.value}`,
      coinDelta: res.value,
    }
  }
  if (cellSymbol(pos) === 'B') {
    return { type: 'enter_boss', message: '抵达 Boss 入口' }
  }
  return { type: 'move', message: `移动 → (${pos.x}, ${pos.y})` }
})

/** 最近 8 条日志（最新在前） */
const recentLog = computed<SimpleEvent[]>(() => {
  const idx = currentPathIndex.value
  if (idx < 0) return []
  const path = mazePath.value
  const rMap = resourceMap.value
  const entries: SimpleEvent[] = []

  for (let i = Math.max(0, idx - 7); i <= idx; i++) {
    const pos = path[i]
    if (!pos) continue
    const res = rMap.get(positionKey(pos))
    if (res && isFirstResourceVisit(i, pos)) {
      entries.push({
        type:      res.type === 'coin' ? 'collect_coin' : 'trigger_trap',
        message:   res.type === 'coin' ? `拾取金币 +${res.value}` : `触发陷阱 ${res.value}`,
        coinDelta: res.value,
      })
    } else {
      entries.push({
        type: cellSymbol(pos) === 'B' ? 'enter_boss' : 'move',
        message: cellSymbol(pos) === 'B' ? '抵达 Boss 入口' : `→ (${pos.x}, ${pos.y})`,
      })
    }
  }
  return entries.reverse()
})

/* ─── derived: player transition speed ───────────────────── */

const transitionMs = computed(() => Math.max(50, Math.round(speedMs.value * 0.82)))

/* ─── tile size (responsive) ─────────────────────────────── */

const mazeAreaRef = ref<HTMLElement | null>(null)
const tileSize    = ref(40)

function recalcTileSize() {
  if (!level.value || !mazeAreaRef.value) return
  const { clientWidth, clientHeight } = mazeAreaRef.value
  const r = level.value.maze.length
  const c = level.value.maze[0]?.length ?? 0
  if (!r || !c) return
  const byW = Math.floor((clientWidth  - 40) / c)
  const byH = Math.floor((clientHeight - 40) / r)
  tileSize.value = Math.max(16, Math.min(56, byW, byH))
}

let ro: ResizeObserver | undefined

/* ─── API calls ──────────────────────────────────────────── */

async function generate() {
  clearPlayback()
  isLoading.value   = true
  loadError.value   = ''
  level.value       = null
  solveResult.value = null
  currentPathIndex.value = -1
  floatingEffects.value  = []
  showGameOverOverlay.value = false
  bossEncountered = false
  clearTimeout(failureTimer)
  effectIdCounter = 0

  try {
    const req = props.generateRequest ?? {
      size:       15,
      algorithm: 'dfs' as const,
      bossConfig: { bossCount: 1, skillCount: 2, roundSlack: 2 },
    }
    const res = await generateLevel(req)
    level.value = res.level

    await nextTick()
    recalcTileSize()
    await solve(res.level)
  } catch (e: unknown) {
    loadError.value = (e as Error)?.message ?? '生成关卡失败'
  } finally {
    isLoading.value = false
  }
}

async function solve(lv: LevelDefinition) {
  isSolving.value = true
  try {
    const res = await solveLevel({
      level: lv,
      task: 'all',
      resourceMode: 'score_per_step',
    })
    solveResult.value = res
    await nextTick()
    reset()
  } catch (e: unknown) {
    loadError.value = (e as Error)?.message ?? '路径求解失败（仍可查看迷宫）'
  } finally {
    isSolving.value = false
  }
}

/* ─── playback controls ──────────────────────────────────── */

function stepForward() {
  if (currentPathIndex.value >= mazePath.value.length - 1) {
    isPlaying.value = false
    return
  }
  currentPathIndex.value++
  if (shouldEnterBossAtCurrentCell()) {
    triggerBossEncounter()
    return
  }
  if (isPlaying.value) {
    playTimer = setTimeout(stepForward, speedMs.value)
  }
}

function stepBack() {
  if (currentPathIndex.value > -1) currentPathIndex.value--
}

function play() {
  if (isPlaying.value || !mazePath.value.length) return
  if (currentPathIndex.value >= mazePath.value.length - 1) {
    currentPathIndex.value = -1
  }
  isPlaying.value = true
  stepForward()
}

function pause() {
  isPlaying.value = false
  clearTimeout(playTimer)
}

function reset() {
  pause()
  currentPathIndex.value = -1
  floatingEffects.value  = []
  bossEncountered = false
}

function jumpToEnd() {
  pause()
  seekTo(mazePath.value.length - 1)
}

function clearPlayback() {
  pause()
  playTimer = undefined
}

function shouldEnterBossAtCurrentCell() {
  const pos = playerPos.value
  return Boolean(
    level.value
    && pos
    && cellSymbol(pos) === 'B'
    && !props.bossCleared
    && !bossEncountered
    && !showGameOverOverlay.value,
  )
}

function findBossIndexBetween(fromIndex: number, toIndex: number) {
  if (props.bossCleared || bossEncountered) return -1

  const start = Math.max(0, Math.min(fromIndex, toIndex))
  const end = Math.min(mazePath.value.length - 1, Math.max(fromIndex, toIndex))

  for (let i = start; i <= end; i++) {
    const pos = mazePath.value[i]
    if (pos && cellSymbol(pos) === 'B') {
      return i
    }
  }

  return -1
}

function seekTo(targetIndex: number) {
  pause()
  floatingEffects.value = []

  const bossIndex = targetIndex > currentPathIndex.value
    ? findBossIndexBetween(currentPathIndex.value + 1, targetIndex)
    : -1

  currentPathIndex.value = bossIndex >= 0 ? bossIndex : targetIndex

  if (bossIndex >= 0 || shouldEnterBossAtCurrentCell()) {
    triggerBossEncounter()
  }
}

function triggerBossEncounter() {
  if (!level.value) return
  bossEncountered = true
  pause()
  emit('enterBoss', {
    level: level.value,
    coins: currentCoins.value,
  })
}

/* ─── floating effects watch ─────────────────────────────── */

watch(currentPathIndex, (newIdx, oldIdx) => {
  // 只在向前步进时触发特效（拖拽回退不触发）
  if (newIdx < 0 || newIdx <= oldIdx) return
  const pos = mazePath.value[newIdx]
  if (!pos) return
  const res = resourceMap.value.get(positionKey(pos))
  if (!res || !isFirstResourceVisit(newIdx, pos)) return

  const eff: FloatingEffect = {
    id:    effectIdCounter++,
    x:     pos.x,
    y:     pos.y,
    value: res.value,
    type:  res.type,
  }
  floatingEffects.value.push(eff)
  setTimeout(() => {
    const i = floatingEffects.value.findIndex(e => e.id === eff.id)
    if (i !== -1) floatingEffects.value.splice(i, 1)
  }, 1300)
})

/* ─── event type labels ──────────────────────────────────── */

const EVENT_LABELS: Record<string, { icon: string; cls: string }> = {
  move:           { icon: '→',  cls: 'ev-move'    },
  collect_coin:   { icon: '⭐', cls: 'ev-coin'    },
  trigger_trap:   { icon: '⚡', cls: 'ev-trap'    },
  enter_boss:     { icon: '🔴', cls: 'ev-boss'    },
  use_skill:      { icon: '🗡', cls: 'ev-skill'   },
  boss_defeated:  { icon: '✔', cls: 'ev-victory'  },
  level_finished: { icon: '🏁', cls: 'ev-finish'  },
  level_failed:   { icon: '✖',  cls: 'ev-fail'    },
}

function eventMeta(type: string) {
  return EVENT_LABELS[type] ?? { icon: '·', cls: 'ev-other' }
}

/* ─── speed labels ───────────────────────────────────────── */

const SPEED_OPTIONS = [
  { label: '0.5×', ms: 560 },
  { label: '1×',   ms: 280 },
  { label: '2×',   ms: 140 },
  { label: '4×',   ms:  60 },
]

/* ─── lifecycle ──────────────────────────────────────────── */

onMounted(() => {
  generate()
  ro = new ResizeObserver(() => recalcTileSize())
  if (mazeAreaRef.value) ro.observe(mazeAreaRef.value)
})

onBeforeUnmount(() => {
  clearPlayback()
  clearTimeout(failureTimer)
  ro?.disconnect()
})

watch(() => props.generateRequest, generate, { deep: true })
</script>

<template>
  <section class="maze-view">
    <BossGameOverOverlay :show="showGameOverOverlay" />

    <!-- ── 加载中 / 错误 ── -->
    <Transition name="status-fade">
      <div v-if="isLoading || isSolving || loadError" class="status-overlay">
        <div v-if="loadError" class="status-error">
          <span class="status-icon">⚠</span>
          <p>{{ loadError }}</p>
          <button @click="generate">重试</button>
        </div>
        <div v-else class="status-loading">
          <div class="spinner" />
          <p>{{ isLoading ? '正在生成迷宫…' : '正在求解最优路径…' }}</p>
        </div>
      </div>
    </Transition>

    <!-- ── 左侧：迷宫区域 ── -->
    <div ref="mazeAreaRef" class="maze-area">
      <div v-if="level" class="maze-center">
        <MazeGrid
          :maze="level.maze"
          :player-pos="playerPos"
          :consumed-cells="consumedCells"
          :visited-cells="visitedCells"
          :trap-consumed-cells="trapConsumedCells"
          :floating-effects="floatingEffects"
          :solve-path="mazePath"
          :transition-ms="transitionMs"
          :tile-size="tileSize"
        />
      </div>

    </div>

    <!-- ── 右侧：控制面板 ── -->
    <aside class="control-panel">

      <!-- 标题 / 重新生成 -->
      <div class="panel-header">
        <div>
          <p class="eyebrow">Maze Viewer</p>
          <h2>迷宫</h2>
        </div>
        <button class="ghost-btn" :disabled="isLoading" @click="generate">↺ 重新生成</button>
      </div>

      <!-- 地图信息 -->
      <div v-if="level" class="info-grid">
        <div class="info-cell">
          <span>地图尺寸</span>
          <strong>{{ level.maze[0]?.length ?? 0 }} × {{ level.maze.length }}</strong>
        </div>
        <div class="info-cell">
          <span>限定回合</span>
          <strong>{{ level.minRouds }}</strong>
        </div>
        <div class="info-cell">
          <span>Boss 血量</span>
          <strong>{{ level.B.join(' / ') }}</strong>
        </div>
        <div class="info-cell">
          <span>复活金币</span>
          <strong>{{ level.CoinConsumption }}</strong>
        </div>
      </div>

      <!-- 求解结果摘要 -->
      <div v-if="resourceResult" class="solve-summary">
        <div class="solve-row">
          <span>最优路径价值</span>
          <strong class="gold">+{{ resourceResult.maxValue }}</strong>
        </div>
        <div class="solve-row">
          <span>路径长度</span>
          <strong>{{ mazePath.length }} 步</strong>
        </div>
      </div>

      <!-- 路径调试面板 -->
      <div v-if="resourceResult" class="path-debug">
        <button class="debug-toggle" @click="showPathDebug = !showPathDebug">
          🔍 路径调试
          <span class="debug-badge badge-ok">后端路径</span>
          <span class="debug-chevron">{{ showPathDebug ? '▲' : '▼' }}</span>
        </button>

        <div v-if="showPathDebug" class="debug-body">

          <p class="debug-section">
            后端路径
            <em>{{ mazePath.length }} 步</em>
          </p>
          <div class="coord-list">
            <span
              v-for="(pos, i) in mazePath"
              :key="'path'+i"
              class="coord-chip"
              :class="{
                'chip-wall':   cellSymbol(pos) === '#',
                'chip-coin':   cellSymbol(pos) === 'C' || cellSymbol(pos) === 'G',
                'chip-trap':   cellSymbol(pos) === 'T',
                'chip-start':  cellSymbol(pos) === 'S',
                'chip-end':    cellSymbol(pos) === 'E' || cellSymbol(pos) === 'B',
                'chip-active': i === currentPathIndex,
              }"
              :title="`步${i} [${cellSymbol(pos)}] (${pos.x},${pos.y})`"
            >({{ pos.x }},{{ pos.y }})</span>
          </div>
        </div>
      </div>

      <!-- 实时状态 -->
      <div v-if="mazePath.length" class="runtime-stats">
        <div class="stat-row">
          <span class="stat-label">金币</span>
          <span class="stat-val" :class="{ positive: currentCoins > 0, negative: currentCoins < 0 }">
            {{ currentCoins >= 0 ? '+' : '' }}{{ currentCoins }}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">步骤</span>
          <span class="stat-val">{{ currentPathIndex + 1 }} / {{ mazePath.length }}</span>
        </div>
        <div v-if="currentEvent" class="current-event-badge" :class="eventMeta(currentEvent.type).cls">
          <span class="ev-icon">{{ eventMeta(currentEvent.type).icon }}</span>
          <span class="ev-msg">{{ currentEvent.message }}</span>
        </div>
      </div>

      <!-- 播放控制 -->
      <div v-if="mazePath.length" class="playback-controls">
        <!-- 进度滑块 -->
        <input
          type="range"
          class="seek-bar"
          :min="-1"
          :max="mazePath.length - 1"
          :value="currentPathIndex"
          @input="(e) => seekTo(parseInt((e.target as HTMLInputElement).value))"
        />

        <!-- 按钮行 -->
        <div class="ctrl-buttons">
          <button class="ctrl-btn" title="重置" @click="reset">⏮</button>
          <button class="ctrl-btn" title="上一步" :disabled="currentPathIndex <= -1"  @click="stepBack">‹</button>
          <button
            class="ctrl-btn play-btn"
            :title="isPlaying ? '暂停' : '播放'"
            @click="isPlaying ? pause() : play()"
          >
            {{ isPlaying ? '⏸' : '▶' }}
          </button>
          <button class="ctrl-btn" title="下一步" :disabled="currentPathIndex >= mazePath.length - 1" @click="stepForward">›</button>
          <button class="ctrl-btn" title="跳到末尾" @click="jumpToEnd">⏭</button>
        </div>

        <!-- 速度选择 -->
        <div class="speed-row">
          <span>速度</span>
          <div class="speed-btns">
            <button
              v-for="s in SPEED_OPTIONS"
              :key="s.ms"
              class="speed-btn"
              :class="{ active: speedMs === s.ms }"
              @click="speedMs = s.ms"
            >{{ s.label }}</button>
          </div>
        </div>
      </div>

      <!-- 事件日志（固定高度，内容滚动，不影响外层布局） -->
      <div class="event-log">
        <p class="log-title">事件日志</p>
        <TransitionGroup name="log-item" tag="ul" class="log-list">
          <li
            v-for="(ev, idx) in recentLog"
            :key="`${currentPathIndex}-${idx}`"
            class="log-item"
            :class="[eventMeta(ev.type).cls, idx === 0 ? 'log-latest' : '']"
          >
            <span class="ev-icon">{{ eventMeta(ev.type).icon }}</span>
            <span class="ev-text">{{ ev.message }}</span>
            <span v-if="ev.coinDelta != null" class="ev-delta" :class="ev.coinDelta > 0 ? 'pos' : 'neg'">
              {{ ev.coinDelta > 0 ? '+' : '' }}{{ ev.coinDelta }}
            </span>
          </li>
        </TransitionGroup>
      </div>

    </aside>
  </section>
</template>

<style scoped>
/* ── layout ── */
.maze-view {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 360px;
  min-height: calc(100vh - 72px);
  color: #f8fafc;
  background:
    radial-gradient(circle at 10% 15%, rgba(245,158,11,0.18), transparent 30%),
    radial-gradient(circle at 85% 80%, rgba(59,130,246,0.14), transparent 28%),
    linear-gradient(135deg, #0f172a 0%, #1e1b4b 52%, #0f172a 100%);
}

/* ── maze area (left) ── */
.maze-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

.maze-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

/* ── control panel (right) ── */
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px;
  border-left: 1px solid rgba(148,163,184,0.14);
  background: rgba(15,23,42,0.62);
  backdrop-filter: blur(18px);
  overflow-y: auto;
}

/* ── panel header ── */
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 2px;
  color: #fbbf24;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.8rem;
  line-height: 1;
}

/* ── info grid ── */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-cell {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid rgba(148,163,184,0.14);
  border-radius: 12px;
  background: rgba(2,6,23,0.38);
}

.info-cell span {
  color: rgba(226,232,240,0.55);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-cell strong {
  color: #e2e8f0;
  font-size: 0.95rem;
}

/* ── solve summary ── */
.solve-summary {
  padding: 12px 14px;
  border: 1px solid rgba(251,191,36,0.22);
  border-radius: 14px;
  background: rgba(146,64,14,0.18);
}

.solve-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  color: rgba(226,232,240,0.75);
}

.solve-row + .solve-row { margin-top: 6px; }

.gold { color: #fbbf24; font-size: 1rem; }

/* ── runtime stats ── */
.runtime-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(148,163,184,0.14);
  border-radius: 14px;
  background: rgba(2,6,23,0.32);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.stat-label { color: rgba(226,232,240,0.6); }
.stat-val   { font-weight: 700; }
.positive   { color: #4ade80; }
.negative   { color: #f87171; }

.current-event-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  font-size: 0.82rem;
  color: rgba(226,232,240,0.8);
  overflow: hidden;
}

.ev-msg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── playback controls ── */
.playback-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(148,163,184,0.14);
  border-radius: 16px;
  background: rgba(2,6,23,0.32);
}

.seek-bar {
  width: 100%;
  accent-color: #fbbf24;
  cursor: pointer;
}

.ctrl-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.ctrl-btn {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(148,163,184,0.24);
  border-radius: 50%;
  background: rgba(15,23,42,0.64);
  color: #e2e8f0;
  font-size: 1.1rem;
  transition: background 0.15s, transform 0.1s;
}

.ctrl-btn:hover:not(:disabled) {
  background: rgba(245,158,11,0.22);
  border-color: rgba(251,191,36,0.44);
}

.ctrl-btn:active:not(:disabled) { transform: scale(0.92); }
.ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.play-btn {
  width: 48px;
  height: 48px;
  background: rgba(180,83,9,0.82);
  border-color: rgba(251,191,36,0.5);
  font-size: 1.3rem;
}

.play-btn:hover { background: rgba(217,119,6,0.88); }

.speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: rgba(226,232,240,0.6);
}

.speed-btns { display: flex; gap: 4px; }

.speed-btn {
  cursor: pointer;
  border: 1px solid rgba(148,163,184,0.22);
  border-radius: 6px;
  padding: 3px 8px;
  background: rgba(15,23,42,0.5);
  color: rgba(226,232,240,0.65);
  font-size: 0.78rem;
  transition: background 0.12s;
}

.speed-btn.active {
  background: rgba(180,83,9,0.72);
  border-color: rgba(251,191,36,0.5);
  color: #fff7ed;
  font-weight: 900;
}

/* ── event log ── */
.event-log {
  flex: none;          /* 不参与 flex 伸缩，高度固定 */
  height: 220px;       /* 固定高度，不随内容变化 */
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-title {
  margin: 0;
  color: rgba(226,232,240,0.45);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.log-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;             /* 撑满 .event-log 剩余空间 */
  min-height: 0;       /* flex 子元素需要此项才能正确收缩 */
}

.log-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  font-size: 0.8rem;
  color: rgba(226,232,240,0.7);
  transition: opacity 0.2s;
}

.log-latest {
  background: rgba(255,255,255,0.09);
  color: #e2e8f0;
  font-weight: 600;
}

.ev-icon { flex-shrink: 0; }
.ev-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ev-delta {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.82rem;
}

.ev-delta.pos { color: #4ade80; }
.ev-delta.neg { color: #f87171; }

/* event type colors */
.ev-coin    { border-left: 2px solid #fbbf24; }
.ev-trap    { border-left: 2px solid #f87171; }
.ev-boss    { border-left: 2px solid #ef4444; }
.ev-skill   { border-left: 2px solid #a78bfa; }
.ev-victory { border-left: 2px solid #4ade80; }
.ev-finish  { border-left: 2px solid #34d399; }
.ev-fail    { border-left: 2px solid #ef4444; }

/* ── path debug ── */
.path-debug {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148,163,184,0.18);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(2,6,23,0.35);
}

.debug-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  border-radius: 0;
  color: rgba(226,232,240,0.75);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.debug-toggle:hover { background: rgba(255,255,255,0.04); }

.debug-badge {
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 900;
}
.badge-ok  { background: rgba(74,222,128,0.18); color: #4ade80; }
.badge-err { background: rgba(248,113,113,0.22); color: #f87171; }

.debug-chevron { font-size: 0.7rem; color: rgba(226,232,240,0.4); }

.debug-body {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.debug-section {
  margin: 8px 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(226,232,240,0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.debug-section em {
  font-style: normal;
  color: rgba(226,232,240,0.35);
  font-weight: 400;
}

.tag-ok   { color: #4ade80; font-size: 0.7rem; font-weight: 900; text-transform: none; }

.coord-list {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  max-height: 140px;
  overflow-y: auto;
  padding: 4px;
  background: rgba(0,0,0,0.22);
  border-radius: 8px;
}

.coord-chip {
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: rgba(226,232,240,0.65);
  background: rgba(255,255,255,0.05);
  cursor: default;
  transition: background 0.1s;
}
.coord-chip:hover { background: rgba(255,255,255,0.12); }

/* 各类格子颜色 */
.chip-wall   { background: rgba(248,113,113,0.35) !important; color: #fca5a5 !important; font-weight: 900; }
.chip-coin   { background: rgba(251,191,36,0.22)  !important; color: #fbbf24 !important; }
.chip-trap   { background: rgba(239,68,68,0.18)   !important; color: #f87171 !important; }
.chip-start  { background: rgba(34,197,94,0.22)   !important; color: #4ade80 !important; font-weight: 900; }
.chip-end    { background: rgba(59,130,246,0.22)  !important; color: #93c5fd !important; font-weight: 900; }
.chip-active { background: rgba(255,255,255,0.22) !important; color: #ffffff  !important; font-weight: 900; outline: 1px solid rgba(255,255,255,0.6); }

/* ── buttons ── */
button { cursor: pointer; font: inherit; border-radius: 999px; }

.ghost-btn {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(148,163,184,0.24);
  background: rgba(15,23,42,0.64);
  color: rgba(226,232,240,0.8);
  font-weight: 700;
  font-size: 0.85rem;
}

.ghost-btn:hover    { background: rgba(30,41,59,0.8); }
.ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.primary-btn {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(251,191,36,0.45);
  background: rgba(180,83,9,0.82);
  color: #fff7ed;
  font-weight: 900;
  font-size: 0.85rem;
}

.primary-btn:hover { background: rgba(217,119,6,0.88); }

/* ── loading overlay ── */
.status-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10,14,26,0.78);
  backdrop-filter: blur(6px);
}

.status-loading,
.status-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.status-loading p { color: rgba(226,232,240,0.72); }

.status-error p {
  color: #fca5a5;
  max-width: 320px;
  line-height: 1.6;
}

.status-error button {
  padding: 10px 24px;
  border: 1px solid rgba(251,191,36,0.45);
  border-radius: 999px;
  background: rgba(180,83,9,0.82);
  color: #fff7ed;
  font-weight: 900;
}

.status-icon { font-size: 2rem; }

/* ── spinner ── */
.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(251,191,36,0.2);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── transitions ── */
.status-fade-enter-active,
.status-fade-leave-active  { transition: opacity 0.3s; }
.status-fade-enter-from,
.status-fade-leave-to      { opacity: 0; }

.log-item-enter-active { transition: opacity 0.2s, transform 0.2s; }
.log-item-enter-from   { opacity: 0; transform: translateY(-6px); }

/* ── responsive ── */
@media (max-width: 1100px) {
  .maze-view {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .maze-area    { min-height: 50vh; }
  .control-panel {
    border-left: none;
    border-top: 1px solid rgba(148,163,184,0.14);
    max-height: none;
  }
  .info-grid { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 640px) {
  .info-grid { grid-template-columns: 1fr 1fr; }
}
</style>
