<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BossDeathOverlay from '../components/BossDeathOverlay.vue'
import BossGameOverOverlay from '../components/BossGameOverOverlay.vue'
import BossVictoryOverlay from '../components/BossVictoryOverlay.vue'
import { generateLevel } from '../api/level'
import type { GenerateLevelRequest } from '../api/level'
import type { LevelDefinition } from '../types'
import bossCowImg from '../assets/images/boss/boss-cow.png'
import bossSkeletonImg from '../assets/images/boss/boss-skeleton.png'
import bossTowerImg from '../assets/images/boss/boss-tower.png'
import playerImg from '../assets/images/boss/player.png'
import skillSlashImg from '../assets/images/boss/skill-slash.png'
import battleBgImg from '../assets/images/boss/battle-bg.png'

/**
 * BOSS战页面
 *
 * BOSS 数量、血量和技能均按后端 / 关卡配置动态渲染。
 *
 * 规则：
 * 1. BOSS 不攻击玩家；
 * 2. AI 玩家没有血量；
 * 3. 没有能量点；
 * 4. 每回合只能出一张技能牌；
 * 5. BOSS 按顺序挑战；
 * 6. 未击败过的 BOSS 血量未知；
 * 7. 已击败过的 BOSS 血量可见；a
 * 8. 超过限定回合后，消耗金币原地复活；
 * 9. 复活后从第一个 BOSS 重新开始挑战。
 */

type RawBackendSkill = [number, number] | {
  name?: string
  damage?: number
  cooldown?: number
  cd?: number
  desc?: string
  description?: string
}

type BossLevelDefinition = Omit<LevelDefinition, 'PlayerSkills'> & {
  PlayerSkills: RawBackendSkill[]
}

const props = withDefaults(defineProps<{
  initialLevel?: BossLevelDefinition
  generateRequest?: GenerateLevelRequest
  initialCoins?: number
}>(), {
  initialCoins: 10,
})

const backendGenerateRequest = computed<GenerateLevelRequest>(() => props.generateRequest ?? {
  size: 15,
  algorithm: 'dfs',
  bossConfig: {
    bossCount: 3,
  },
})

const level = ref<BossLevelDefinition | null>(null)
const isLoadingLevel = ref(false)
const loadError = ref('')

/** 当前回合 */
const currentRound = ref(1)

/** 当前金币：后续应来自地图阶段拾取金币数 */
const currentCoins = ref(props.initialCoins)

/** 当前挑战轮次 */
const attempt = ref(1)

/** 当前正在挑战第几个 BOSS */
const currentBossIndex = ref(0)

/** 当前 BOSS 的内部剩余血量，仅用于本地演示和动画判断 */
const currentBossHp = ref(0)

/** 已经知道真实血量的 BOSS */
const knownBossIndexes = ref<number[]>([])

/** 本轮已经击败的 BOSS */
const defeatedInCurrentAttempt = ref<number[]>([])

/** 当前被攻击的 BOSS，用于播放受击动画 */
const attackingBossIndex = ref<number | null>(null)

/** 当前伤害飘字 */
const damagePopup = ref<{
  bossIndex: number
  damage: number
} | null>(null)

/** 是否正在播放复活动画 */
const reviving = ref(false)

/** 是否显示剧情式死亡 / 复活动画 */
const showDeathOverlay = ref(false)

/** 是否显示金币不足后的游戏结束动画 */
const showGameOverOverlay = ref(false)

/** 是否已经进入游戏结束状态 */
const gameOver = ref(false)

/** 是否显示剧情式胜利结算动画 */
const showVictoryOverlay = ref(false)

/** 每击败一组三个 BOSS 后的过场提示 */
const showDangerTransition = ref(false)

/** 战斗日志：保留给死亡/胜利动画和后续联调，不在页面右侧展示 */
const logs = ref<string[]>([])

const roundLimit = computed(() => level.value?.minRouds ?? 0)
const reviveCoinCost = computed(() => level.value?.CoinConsumption ?? 0)

/** BOSS 展示数据：后端 / 关卡配置 level.B 有几个血量，就自动生成几个 BOSS */
const bossImages = [bossCowImg, bossSkeletonImg, bossTowerImg]
const bossTypes = ['cow', 'skeleton', 'tower']
const bossNames = ['角牛幼兽', '骷髅乞丐', '高塔终结者']
const maxVisibleBosses = 3

const currentBossGroupStart = computed(() => {
  return Math.floor(currentBossIndex.value / maxVisibleBosses) * maxVisibleBosses
})

const bosses = computed(() => {
  const bossHpList = level.value?.B ?? []
  const start = currentBossGroupStart.value

  return bossHpList.slice(start, start + maxVisibleBosses).map((hp, visibleIndex) => {
    const index = start + visibleIndex
    const imageIndex = index % bossImages.length
    const typeIndex = index % bossTypes.length

    const scale = 1.12 + visibleIndex * 0.22

    return {
      index,
      visibleIndex,
      name: bossNames[index] || `BOSS`,
      hp,
      type: bossTypes[typeIndex],
      image: bossImages[imageIndex],
      scale,
      activeScale: scale * 1.04,
    }
  })
})

/**
 * 自动计算 BOSS 在背景图右半边的位置。
 * 1 个：75%。
 * 2 个：66.67%、83.33%。
 * n 个：把右半边平均分成 n + 1 份，依次站在分割点。
 */
function getBossPositionStyle(visibleIndex: number) {
  const count = bosses.value.length || 1
  const leftPercent = 24+((visibleIndex + 1) * 85 ) / (count + 1)
  const boss = bosses.value[visibleIndex]
  const scale = boss?.scale ?? 1
  const activeScale = boss?.activeScale ?? scale * 1.04

  return {
    left: `${leftPercent}%`,
    bottom: '-14px',
    '--boss-scale': String(scale),
    '--boss-active-scale': String(activeScale),
  }
}

type BattleSkill = {
  index: number
  name: string
  damage: number
  cooldown: number
  desc: string
}

/** 后端 / 关卡配置给几个技能，就渲染几个技能；内容优先使用后端字段 */
function normalizeBackendSkills(playerSkills: BossLevelDefinition['PlayerSkills']) {
  return playerSkills.map((rawSkill, index) => {
    const skill = rawSkill as RawBackendSkill
    const isArraySkill = Array.isArray(skill)

    const damage = isArraySkill
      ? Number(skill[0] ?? 0)
      : Number(skill.damage ?? 0)

    const cooldown = isArraySkill
      ? Number(skill[1] ?? 0)
      : Number(skill.cooldown ?? skill.cd ?? 0)

    return {
      index,
      name: isArraySkill
        ? `技能 ${index + 1}`
        : skill.name || `技能 ${index + 1}`,
      damage,
      cooldown,
      desc: isArraySkill
        ? `造成 ${damage} 点伤害，冷却 ${cooldown} 回合。`
        : skill.desc || skill.description || `造成 ${damage} 点伤害，冷却 ${cooldown} 回合。`,
    }
  })
}

/** 技能数据：完全跟随后端 / level.PlayerSkills 数组长度变化 */
const skills = ref<BattleSkill[]>([])
const skillCooldowns = ref<number[]>(skills.value.map(() => 0))
const skillListRef = ref<HTMLElement | null>(null)

function assertBossLevel(rawLevel: LevelDefinition | BossLevelDefinition): BossLevelDefinition {
  const bossLevel = rawLevel as BossLevelDefinition

  if (!Array.isArray(bossLevel.B) || bossLevel.B.length === 0) {
    throw new Error('后端返回的 level.B 为空或格式不正确')
  }

  if (!Array.isArray(bossLevel.PlayerSkills) || bossLevel.PlayerSkills.length === 0) {
    throw new Error('后端返回的 level.PlayerSkills 为空或格式不正确')
  }

  if (!Number.isFinite(Number(bossLevel.minRouds))) {
    throw new Error('后端返回的 level.minRouds 格式不正确')
  }

  if (!Number.isFinite(Number(bossLevel.CoinConsumption))) {
    throw new Error('后端返回的 level.CoinConsumption 格式不正确')
  }

  return {
    ...bossLevel,
    B: bossLevel.B.map((hp) => Number(hp)),
    minRouds: Number(bossLevel.minRouds),
    CoinConsumption: Number(bossLevel.CoinConsumption),
  }
}

function createInitialLogs(bossLevel: BossLevelDefinition) {
  return [
    '进入战斗。',
    'BOSS 将按照顺序依次出现。',
    '每回合只能释放 1 张技能牌。',
    `需要在 ${bossLevel.minRouds} 回合内击败全部 BOSS。`,
    `若超时，将消耗 ${bossLevel.CoinConsumption} 金币并在当前位置复活。`,
  ]
}

function resetBattleState(bossLevel: BossLevelDefinition) {
  currentRound.value = 1
  attempt.value = 1
  currentBossIndex.value = 0
  currentBossHp.value = bossLevel.B[0]
  knownBossIndexes.value = []
  defeatedInCurrentAttempt.value = []
  attackingBossIndex.value = null
  damagePopup.value = null
  reviving.value = false
  showDeathOverlay.value = false
  showGameOverOverlay.value = false
  gameOver.value = false
  showVictoryOverlay.value = false
  showDangerTransition.value = false
  skills.value = normalizeBackendSkills(bossLevel.PlayerSkills)
  skillCooldowns.value = skills.value.map(() => 0)
  logs.value = createInitialLogs(bossLevel)
}

function applyBossLevel(rawLevel: LevelDefinition | BossLevelDefinition) {
  const bossLevel = assertBossLevel(rawLevel)
  level.value = bossLevel
  resetBattleState(bossLevel)
}

async function loadLevelFromBackend() {
  isLoadingLevel.value = true
  loadError.value = ''

  try {
    const response = await generateLevel(backendGenerateRequest.value)
    applyBossLevel(response.level)
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : '无法从后端加载 BOSS 配置'
  } finally {
    isLoadingLevel.value = false
  }
}

onMounted(() => {
  if (props.initialLevel) {
    applyBossLevel(props.initialLevel)
    return
  }

  void loadLevelFromBackend()
})

/** 判断是否是当前 BOSS */
function isCurrentBoss(index: number) {
  return index === currentBossIndex.value
}

/** 判断是否本轮已击败 */
function isDefeatedInCurrentAttempt(index: number) {
  return defeatedInCurrentAttempt.value.includes(index)
}

function getBossHpPercent(index: number, hp: number) {
  if (isDefeatedInCurrentAttempt(index)) {
    return 0
  }

  if (isCurrentBoss(index) && knownBossIndexes.value.includes(index)) {
    return Math.max(0, Math.min(100, (currentBossHp.value / hp) * 100))
  }

  return 100
}

function shouldShowUnknownHp(index: number) {
  return !knownBossIndexes.value.includes(index) && !isDefeatedInCurrentAttempt(index)
}

/** 判断技能是否可用 */
function isSkillAvailable(skillIndex: number) {
  return skillCooldowns.value[skillIndex] === 0
}

function onSkillListWheel(event: WheelEvent) {
  if (!skillListRef.value) return
  if (event.shiftKey || Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    skillListRef.value.scrollLeft += event.deltaY
    event.preventDefault()
  }
}

/**
 * 推进一回合。
 * usedSkillIndex 表示本回合使用的技能，本回合刚使用的技能不会立刻减少冷却。
 */
function advanceRound(usedSkillIndex?: number) {
  const bossLevel = level.value

  if (!bossLevel) {
    return
  }

  skillCooldowns.value = skillCooldowns.value.map((cooldown, index) => {
    if (index === usedSkillIndex) {
      return cooldown
    }

    return Math.max(0, cooldown - 1)
  })

  if (currentRound.value < bossLevel.minRouds) {
    currentRound.value += 1
    logs.value.unshift(`进入第 ${currentRound.value} 回合。`)
  } else {
    mockTimeoutAndRevive()
  }
}

/** 当前 BOSS 被击败后的统一处理 */
function defeatCurrentBossBySkill(): boolean {
  const bossLevel = level.value

  if (!bossLevel) {
    return false
  }

  const index = currentBossIndex.value

  if (!knownBossIndexes.value.includes(index)) {
    knownBossIndexes.value.push(index)
  }

  if (!defeatedInCurrentAttempt.value.includes(index)) {
    defeatedInCurrentAttempt.value.push(index)
  }

  logs.value.unshift(
    `第 ${currentRound.value} 回合：击败第 ${index + 1} 个 BOSS，血量信息已记录。`,
  )

  if (currentBossIndex.value < bossLevel.B.length - 1) {
    const nextBossIndex = currentBossIndex.value + 1
    const shouldShowDangerTransition = nextBossIndex % maxVisibleBosses === 0

    if (shouldShowDangerTransition) {
      showDangerTransition.value = true
      logs.value.unshift('危险远没有结束。')

      window.setTimeout(() => {
        currentBossIndex.value = nextBossIndex
        currentBossHp.value = bossLevel.B[currentBossIndex.value]
        showDangerTransition.value = false
        logs.value.unshift(`进入第 ${currentBossIndex.value + 1} 个 BOSS。`)
      }, 2300)
    } else {
      currentBossIndex.value = nextBossIndex
      currentBossHp.value = bossLevel.B[currentBossIndex.value]
      logs.value.unshift(`进入第 ${currentBossIndex.value + 1} 个 BOSS。`)
    }
  } else {
    logs.value.unshift('全部 BOSS 已击败，BOSS 战通过。')
    playVictorySettlement()
    return true
  }

  return false
}

/** 使用技能 */
function useSkill(skillIndex: number) {
  if (!level.value || gameOver.value || showDangerTransition.value) {
    return
  }

  const skill = skills.value[skillIndex]

  if (!skill) {
    return
  }

  if (!isSkillAvailable(skillIndex)) {
    logs.value.unshift(
      `${skill.name} 仍在冷却中，还剩 ${skillCooldowns.value[skillIndex]} 回合。`,
    )
    return
  }

  attackingBossIndex.value = currentBossIndex.value
  damagePopup.value = {
    bossIndex: currentBossIndex.value,
    damage: skill.damage,
  }

  currentBossHp.value = Math.max(0, currentBossHp.value - skill.damage)

  logs.value.unshift(
    `第 ${currentRound.value} 回合：使用 ${skill.name}，造成 ${skill.damage} 点伤害。`,
  )

  skillCooldowns.value[skillIndex] = skill.cooldown

  window.setTimeout(() => {
    attackingBossIndex.value = null
    damagePopup.value = null
  }, 520)

  window.setTimeout(() => {
    if (currentBossHp.value <= 0) {
      const allCleared = defeatCurrentBossBySkill()

      if (allCleared) {
        return
      }
    }

    advanceRound(skillIndex)
  }, 620)
}

/** 超时复活 */
function mockTimeoutAndRevive() {
  const bossLevel = level.value

  if (!bossLevel) {
    return
  }

  const coinsAfterReviveCost = currentCoins.value - bossLevel.CoinConsumption

  if (coinsAfterReviveCost < 0) {
    currentCoins.value = coinsAfterReviveCost
    gameOver.value = true
    showDeathOverlay.value = false
    showGameOverOverlay.value = true
    reviving.value = false
    logs.value.unshift('金币不足以支付复活消耗，游戏结束。')
    return
  }

  showDeathOverlay.value = true
  reviving.value = true

  logs.value.unshift(`BOSS 战超过 ${bossLevel.minRouds} 回合，本轮挑战失败。`)

  window.setTimeout(() => {
    currentCoins.value = coinsAfterReviveCost
    logs.value.unshift(`消耗 ${bossLevel.CoinConsumption} 金币。`)
  }, 3400)

  window.setTimeout(() => {
    attempt.value += 1
    currentRound.value = 1
    currentBossIndex.value = 0
    currentBossHp.value = bossLevel.B[0]
    defeatedInCurrentAttempt.value = []

      skillCooldowns.value = skills.value.map(() => 0)
      damagePopup.value = null
      attackingBossIndex.value = null
      showDangerTransition.value = false

      logs.value.unshift('原地复活，从第 1 个 BOSS 重新开始。')

    showDeathOverlay.value = false
    reviving.value = false
  }, 6200)
}

/** 播放胜利结算动画 */
function playVictorySettlement() {
  showVictoryOverlay.value = true
  logs.value.unshift('BOSS 群已被击败，进入胜利结算。')

  window.setTimeout(() => {
    showVictoryOverlay.value = false
  }, 7000)
}
</script>

<template>
  <main
    class="boss-page"
    :class="{ reviving }"
    :style="{
      backgroundImage: `linear-gradient(rgba(8, 13, 18, 0.08), rgba(8, 13, 18, 0.28)), url(${battleBgImg})`,
    }"
  >
    <section
      v-if="isLoadingLevel"
      class="backend-state-panel"
    >
      <h2>正在读取后端关卡配置</h2>
      <p>BOSS 血量、技能、限定回合和复活金币将全部使用后端返回值。</p>
    </section>

    <section
      v-else-if="loadError"
      class="backend-state-panel error"
    >
      <h2>后端配置加载失败</h2>
      <p>{{ loadError }}</p>
      <button
        type="button"
        @click="loadLevelFromBackend"
      >
        重新加载
      </button>
    </section>

    <template v-else>
    <BossDeathOverlay
      :show="showDeathOverlay"
      :coin-cost="reviveCoinCost"
    />

    <BossGameOverOverlay :show="showGameOverOverlay" />

    <BossVictoryOverlay
      :show="showVictoryOverlay"
      :remaining-coins="currentCoins"
      :used-rounds="currentRound"
      :limit-rounds="roundLimit"
    />

    <Transition name="danger-transition-fade">
      <div
        v-if="showDangerTransition"
        class="danger-transition"
      >
        <span>危险远没有结束</span>
      </div>
    </Transition>

    <!-- 顶部标题 -->
    <header class="top-bar">
      <div class="coin-status">
        <span class="small-label">当前金币</span>
        <strong>{{ currentCoins }}</strong>
        <span class="hint">来自地图阶段拾取</span>
      </div>

      <div class="page-title" />
    </header>

    <!-- 主战斗区 -->
    <section class="battle-layout">
      <!-- 左侧状态面板 -->
      <aside class="side-panel left-panel">
        <div class="round-box">
          <span>回合</span>
          <strong>{{ currentRound }} / {{ roundLimit }}</strong>
        </div>

        <div class="info-row">
          <span>限定回合</span>
          <strong>{{ roundLimit }}</strong>
        </div>

        <div class="info-row">
          <span>复活金币</span>
          <strong>{{ reviveCoinCost }}</strong>
        </div>

        <div class="info-row">
          <span>挑战轮次</span>
          <strong>第 {{ attempt }} 轮</strong>
        </div>
      </aside>

      <article class="player-card stage-player">
        <div class="player-avatar image-avatar">
          <img :src="playerImg" alt="" />
        </div>
      </article>

      <!-- 中间 BOSS 区域 -->
      <section class="boss-stage">
        <article
          v-for="boss in bosses"
          :key="boss.index"
          class="boss-unit"
          :style="getBossPositionStyle(boss.visibleIndex)"
          :class="[
            boss.type,
            {
              active: isCurrentBoss(boss.index),
              defeated: isDefeatedInCurrentAttempt(boss.index),
              locked: boss.index > currentBossIndex,
              hit: attackingBossIndex === boss.index,
            },
          ]"
        >
          <div class="boss-figure">
            <div
              v-if="damagePopup?.bossIndex === boss.index"
              class="damage-popup"
            >
              -{{ damagePopup.damage }}
            </div>

            <img
              class="boss-image"
              :src="boss.image"
              :alt="boss.name"
            />
          </div>

          <div
            class="boss-hp-bar"
            :class="{
              unknown: shouldShowUnknownHp(boss.index),
              empty: isDefeatedInCurrentAttempt(boss.index),
            }"
          >
            <span
              class="boss-hp-fill"
              :style="{ width: `${getBossHpPercent(boss.index, boss.hp)}%` }"
            ></span>
            <span
              v-if="shouldShowUnknownHp(boss.index)"
              class="boss-hp-unknown"
            >
              ??
            </span>
          </div>
        </article>
      </section>
    </section>

    <!-- 技能卡牌区 -->
    <section class="skill-area">
      <div
        ref="skillListRef"
        class="skill-list"
        @wheel="onSkillListWheel"
      >
        <article
          v-for="skill in skills"
          :key="skill.index"
          class="skill-card"
          :class="{
            disabled: !isSkillAvailable(skill.index),
          }"
          @click="useSkill(skill.index)"
        >
          <div class="skill-index">
            {{ skill.index }}
          </div>

          <h3>{{ skill.name }}</h3>

          <div class="card-art">
            <img :src="skillSlashImg" alt="技能图标" />
          </div>

          <div class="skill-meta">
            <p>伤害：{{ skill.damage }}</p>
            <p>冷却：{{ skill.cooldown }}</p>
          </div>

          <div
            class="skill-state"
            :class="{
              cooling: !isSkillAvailable(skill.index),
            }"
          >
            <template v-if="isSkillAvailable(skill.index)">
              可使用
            </template>

            <template v-else>
              冷却中：{{ skillCooldowns[skill.index] }}
            </template>
          </div>

          <p class="skill-desc">
            {{ skill.desc }}
          </p>
        </article>
      </div>
    </section>
    </template>
  </main>
</template>

<style scoped>
.boss-page {
  position: relative;
  min-height: 100vh;
  padding: 8px 18px 0;
  color: #f5e6c8;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  font-family:
    Inter,
    "Microsoft YaHei",
    sans-serif;
  overflow: hidden;
}

.boss-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.34)),
    radial-gradient(circle at 50% 48%, rgba(255, 160, 70, 0.08), transparent 36%);
  opacity: 1;
}

.backend-state-panel {
  position: relative;
  z-index: 5;
  width: min(520px, calc(100% - 32px));
  margin: 18vh auto 0;
  padding: 28px;
  text-align: center;
  border: 1px solid rgba(213, 174, 99, 0.3);
  border-radius: 12px;
  background: rgba(4, 7, 10, 0.62);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(2px);
}

.backend-state-panel h2 {
  margin: 0 0 10px;
  color: #ffe08a;
  font-size: 24px;
}

.backend-state-panel p {
  margin: 0;
  color: #e6d6b8;
  line-height: 1.6;
}

.backend-state-panel button {
  margin-top: 18px;
  padding: 9px 22px;
  border: 1px solid rgba(228, 183, 104, 0.46);
  border-radius: 8px;
  color: #fff0bf;
  background: rgba(49, 78, 97, 0.82);
  cursor: pointer;
}

.backend-state-panel.error {
  border-color: rgba(226, 97, 83, 0.42);
}

.danger-transition {
  position: fixed;
  inset: 0;
  z-index: 998;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 48%, rgba(154, 25, 22, 0.26), transparent 36%),
    rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(2px);
}

.danger-transition span {
  display: block;
  padding: 20px 48px;
  color: #ffe1c0;
  border: 2px solid rgba(202, 64, 48, 0.68);
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(54, 12, 14, 0.88), rgba(7, 6, 8, 0.9));
  box-shadow:
    0 0 42px rgba(202, 42, 34, 0.36),
    0 22px 50px rgba(0, 0, 0, 0.64);
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 10px;
  text-shadow:
    0 0 20px rgba(244, 67, 50, 0.5),
    0 4px 0 rgba(0, 0, 0, 0.8);
  animation: dangerTextPulse 1.1s ease-in-out infinite;
}

.danger-transition-fade-enter-active,
.danger-transition-fade-leave-active {
  transition: opacity 0.45s ease;
}

.danger-transition-fade-enter-from,
.danger-transition-fade-leave-to {
  opacity: 0;
}

/* 顶部 HUD */
.top-bar {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: 215px 1fr;
  align-items: start;
  gap: 18px;
  height: 78px;
  margin-bottom: 0;
}

.coin-status {
  min-height: 64px;
  padding: 10px 16px;
  border: 1px solid rgba(213, 174, 99, 0.28);
  border-radius: 12px;
  background: rgba(4, 7, 10, 0.48);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(2px);
}

.small-label {
  display: block;
  color: #c6a978;
  font-size: 13px;
}

.coin-status strong {
  display: block;
  margin-top: 2px;
  color: #ffe08a;
  font-size: 26px;
  letter-spacing: 1px;
}

.hint {
  display: none;
}

.page-title {
  text-align: center;
  pointer-events: none;
}

.page-title h1 {
  margin: 2px 0 0;
  color: #ffe08a;
  font-size: 30px;
  letter-spacing: 12px;
  text-shadow:
    0 3px 0 rgba(0, 0, 0, 0.48),
    0 0 20px rgba(255, 208, 105, 0.22);
}

.page-title p {
  margin: 4px 0 0;
  color: #e6d6b8;
  font-size: 13px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

/* 主战斗舞台 */
.battle-layout {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  align-items: end;
  min-height: 640px;
}

.side-panel {
  border: 1px solid rgba(209, 169, 94, 0.18);
  border-radius: 14px;
  background: rgba(5, 8, 11, 0.18);
  box-shadow:
    inset 0 0 18px rgba(255, 215, 148, 0.02),
    0 12px 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(2px);
}

.left-panel {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  z-index: 6;
  width: 215px;
  box-sizing: border-box;
  padding: 10px;
  margin: 0;
  background: rgba(5, 8, 11, 0.20);
  border-color: rgba(209, 169, 94, 0.14);
}

.round-box {
  padding: 10px 14px;
  text-align: center;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(228, 183, 104, 0.22);
}

.round-box span {
  display: block;
  color: #c8aa78;
  font-size: 13px;
}

.round-box strong {
  display: block;
  margin-top: 4px;
  font-size: 40px;
  color: #fff0bf;
  letter-spacing: 3px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(213, 174, 99, 0.12);
  color: #d8c5a6;
  font-size: 13px;
}

.info-row strong {
  color: #ffe19c;
}

.player-card {
  position: absolute;
  left: 25%;
  bottom: 34px;
  z-index: 3;
  width: 190px;
  margin-top: 0;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.player-avatar {
  position: relative;
  width: 160px;
  height: 200px;
  margin: 0 auto 4px;
  border-radius: 50%;
  background: transparent;
  border: none;
}

.image-avatar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: visible;
  background: transparent;
  border: none;
}

.image-avatar img {
  width: 205px;
  height: 245px;
  object-fit: contain;
  filter:
    drop-shadow(0 24px 26px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 12px rgba(255, 216, 140, 0.12));
}

/* BOSS 区域 */
.boss-stage {
  position: relative;
  min-height: 600px;
  width: min(1120px, 100%);
  margin-left: auto;
  border-radius: 16px;
  background: transparent;
  overflow: visible;
}

.boss-unit {
  position: absolute;
  width: 220px;
  min-height: 310px;
  padding: 0 4px 6px;
  text-align: center;
  border: none;
  border-radius: 16px;
  background: transparent;
  transform: translateX(-50%);
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.boss-unit.active {
  transform: translateX(-50%) translateY(-6px);
  border-color: transparent;
  background: transparent;
  animation: bossBreathing 1.8s ease-in-out infinite;
}

.boss-unit.locked {
  opacity: 0.88;
  filter: none;
}

.boss-unit.defeated {
  animation: bossDefeated 0.55s ease forwards;
}

.boss-unit.hit {
  animation: bossHit 0.42s ease-in-out;
}

.boss-figure {
  position: relative;
  height: 290px;
  margin-top: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.boss-image {
  width: 100%;
  max-width: 245px;
  height: 290px;
  object-fit: contain;
  background: transparent;
  filter:
    drop-shadow(0 22px 24px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 14px rgba(255, 204, 115, 0.12));
  transform: scale(var(--boss-scale, 1));
  transform-origin: bottom center;
  transition:
    transform 0.2s ease,
    filter 0.2s ease,
    opacity 0.2s ease;
}



.boss-unit.active .boss-image {
  transform: translateY(-8px) scale(var(--boss-active-scale, 1.04));
  filter:
    drop-shadow(0 24px 26px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 24px rgba(255, 203, 99, 0.34));
}
.boss-unit.locked .boss-image {
  opacity: 0.78;
  filter:
    brightness(0.82)
    drop-shadow(0 14px 18px rgba(0, 0, 0, 0.58));
}

.boss-unit.defeated .boss-image {
  opacity: 0.72;
  filter:
    brightness(0.78)
    drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5));
}

.boss-unit h3 {
  margin: 0 0 4px;
  color: #f3d28a;
  font-size: 20px;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.9);
}

.boss-hp-bar {
  position: relative;
  width: 156px;
  height: 13px;
  margin: 4px auto 0;
  overflow: hidden;
  border: 1px solid rgba(255, 220, 150, 0.34);
  border-radius: 999px;
  background: rgba(9, 11, 13, 0.68);
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.58),
    inset 0 0 8px rgba(0, 0, 0, 0.72);
}

.boss-hp-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background:
    linear-gradient(90deg, #d03832, #ff7d45 58%, #ffd36c);
  box-shadow:
    0 0 10px rgba(255, 89, 56, 0.66),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  transition: width 0.24s ease;
}

.boss-hp-unknown {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f4dfb8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 2px;
  line-height: 1;
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.95),
    0 0 8px rgba(255, 224, 160, 0.22);
}

.boss-hp-bar.unknown .boss-hp-fill {
  opacity: 0.28;
  background: linear-gradient(90deg, #4b5660, #7e8a90);
  box-shadow: none;
}

.boss-hp-bar.empty .boss-hp-fill {
  opacity: 0;
}

/* 技能区域 */
.skill-area {
  position: relative;
  z-index: 5;
  margin-top: 0;
}

.skill-title {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  margin-bottom: 6px;
  color: #d8c7aa;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.skill-title strong {
  color: #f3d28a;
}

.skill-list {
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  gap: 18px;
  width: min(920px, calc(100% - 32px));
  min-height: 280px;
  margin: 0 auto;
  padding: 14px 16px 18px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  transform: translateY(28px);
  cursor: grab;
  user-select: none;
}

.skill-list.dragging {
  cursor: grabbing;
}

.skill-list::-webkit-scrollbar {
  height: 10px;
}

.skill-list::-webkit-scrollbar-track {
  background: rgba(10, 14, 18, 0.46);
  border-radius: 999px;
}

.skill-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(239, 194, 109, 0.9), rgba(180, 128, 58, 0.9));
  border-radius: 999px;
}

.skill-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(255, 216, 137, 1), rgba(197, 141, 70, 1));
}

.skill-card {
  position: relative;
  flex: 0 0 175px;
  width: 175px;
  min-width: 175px;
  min-height: 195px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(221, 181, 105, 0.56);
  background: linear-gradient(180deg, #202b2f 0%, #151b1e 100%);
  box-shadow: 0 12px 22px rgba(0, 0, 0, 0.32);
  animation: cardIdle 2.8s ease-in-out infinite;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    filter 0.18s ease;
}

.skill-card:nth-child(2) {
  animation-delay: 0.2s;
}

.skill-card:nth-child(3) {
  animation-delay: 0.4s;
}

.skill-card:hover {
  animation: none;
  transform: translateY(-10px);
  box-shadow:
    0 20px 32px rgba(0, 0, 0, 0.38),
    0 0 18px rgba(245, 196, 103, 0.18);
}

.skill-card.disabled {
  cursor: not-allowed;
  opacity: 0.52;
  filter: grayscale(0.65);
}

.skill-card.disabled:hover {
  animation: cardIdle 2.8s ease-in-out infinite;
  transform: none;
  box-shadow: 0 12px 22px rgba(0, 0, 0, 0.32);
}

.skill-index {
  position: absolute;
  top: -13px;
  left: -13px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #314e61;
  border: 3px solid #d9b66b;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff4d0;
  font-weight: 800;
}

.skill-card h3 {
  margin: 4px 0 10px;
  text-align: center;
  color: #f4d48c;
}

.card-art {
  height: 66px;
  border-radius: 8px;
  border: 1px solid rgba(221, 181, 105, 0.4);
  background:
    radial-gradient(circle at 60% 40%, rgba(255, 214, 128, 0.76), transparent 20%),
    linear-gradient(135deg, #541b19, #d8752e 48%, #11181f);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
}

.skill-meta {
  margin-top: 10px;
  color: #f2e2c2;
  line-height: 1.5;
}

.skill-meta p {
  margin: 0;
}

.skill-state {
  margin-top: 10px;
  padding: 6px 10px;
  text-align: center;
  border-radius: 8px;
  background: rgba(57, 102, 65, 0.52);
  border: 1px solid rgba(129, 218, 122, 0.34);
  color: #d9ffd0;
  font-size: 14px;
}

.skill-state.cooling {
  background: rgba(111, 42, 36, 0.58);
  border-color: rgba(226, 97, 83, 0.38);
  color: #ffd1c7;
}

.skill-desc {
  margin: 8px 0 0;
  color: #9fb2b7;
  font-size: 12px;
  line-height: 1.45;
}

/* 伤害飘字 */
.damage-popup {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 8;
  transform: translateX(-50%);
  color: #ff6b4a;
  font-size: 34px;
  font-weight: 900;
  text-shadow:
    0 0 10px rgba(255, 77, 54, 0.85),
    0 3px 0 rgba(0, 0, 0, 0.8);
  animation: damageFloat 0.56s ease-out forwards;
  pointer-events: none;
}

/* 动画：当前 BOSS 呼吸 */
@keyframes bossBreathing {
  0% {
    filter: drop-shadow(0 0 0 rgba(255, 205, 111, 0));
  }

  50% {
    filter: drop-shadow(0 0 18px rgba(255, 202, 103, 0.32));
  }

  100% {
    filter: drop-shadow(0 0 0 rgba(255, 205, 111, 0));
  }
}

@keyframes dangerTextPulse {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }

  50% {
    transform: scale(1.04);
    filter: brightness(1.18);
  }

  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}

/* 动画：BOSS 受击 */
@keyframes bossHit {
  0% {
    transform: translateX(-50%) translateY(-6px);
    filter: brightness(1);
  }

  20% {
    transform: translateX(calc(-50% - 8px)) translateY(-6px);
    filter: brightness(1.5);
  }

  45% {
    transform: translateX(calc(-50% + 8px)) translateY(-6px);
  }

  70% {
    transform: translateX(calc(-50% - 4px)) translateY(-6px);
  }

  100% {
    transform: translateX(-50%) translateY(-6px);
    filter: brightness(1);
  }
}

/* 动画：BOSS 被击败 */
@keyframes bossDefeated {
  0% {
    opacity: 1;
    filter: grayscale(0);
  }

  100% {
    opacity: 0.55;
    filter: grayscale(0.7);
  }
}

/* 动画：复活红色闪光 */
.boss-page.reviving::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 99;
  pointer-events: none;
  background: rgba(195, 43, 43, 0.18);
  animation: reviveFlash 0.7s ease-out;
}

@keyframes reviveFlash {
  0% {
    opacity: 0;
  }

  30% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@keyframes damageFloat {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(18px) scale(0.85);
  }

  25% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1.18);
  }

  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-38px) scale(1);
  }
}

/* 动画：技能卡待机浮动 */
@keyframes cardIdle {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }

  100% {
    transform: translateY(0);
  }
}

/* 自适应 */
@media (max-width: 1300px) {
  .top-bar,
  .battle-layout {
    grid-template-columns: 1fr;
  }

  .left-panel {
    margin: 0;
  }

  .player-card {
    left: 25%;
    bottom: 34px;
    transform: translateX(-50%);
  }

  .boss-stage {
    min-height: 520px;
  }

  .boss-unit {
    width: 170px;
  }

  .boss-unit.active,
  .boss-unit.hit {
    transform: translateX(-50%) translateY(-6px);
  }


  .skill-list {
    flex-wrap: wrap;
    transform: none;
  }
}
</style>
