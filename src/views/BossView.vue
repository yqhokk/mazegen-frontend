<script setup lang="ts">
import { computed, ref } from 'vue'
import BossDeathOverlay from '../components/BossDeathOverlay.vue'
import BossVictoryOverlay from '../components/BossVictoryOverlay.vue'
import type { LevelDefinition } from '../types'
import { generateSkillCards } from '../utils'

import bossCowImg from '../assets/images/boss/boss-cow.png'
import bossSkeletonImg from '../assets/images/boss/boss-skeleton.png'
import bossTowerImg from '../assets/images/boss/boss-tower.png'
import playerImg from '../assets/images/boss/player.png'
import skillSlashImg from '../assets/images/boss/skill-slash.png'
import battleBgImg from '../assets/images/boss/battle-bg.png'

/**
 * BOSS战页面
 *
 * 当前版本是前端静态动画原型，不接后端。
 *
 * 规则：
 * 1. BOSS 不攻击玩家；
 * 2. AI 玩家没有血量；
 * 3. 没有能量点；
 * 4. 每回合只能出一张技能牌；
 * 5. BOSS 按顺序挑战；
 * 6. 未击败过的 BOSS 血量未知；
 * 7. 已击败过的 BOSS 血量可见；
 * 8. 超过限定回合后，消耗金币原地复活；
 * 9. 复活后从第一个 BOSS 重新开始挑战。
 */

/**
 * 方案2：中等挑战型配置
 */
const level: LevelDefinition = {
  maze: [['#', 'S', ' ', 'B', 'E', '#']],
  B: [25, 40, 55],
  PlayerSkills: [
    [6, 0],
    [12, 1],
    [18, 3],
  ],
  minRouds: 13,
  CoinConsumption: 5,
}

/** 当前回合 */
const currentRound = ref(1)

/** 当前金币：后续应来自地图阶段拾取金币数 */
const currentCoins = ref(10)

/** 当前挑战轮次 */
const attempt = ref(1)

/** 当前正在挑战第几个 BOSS */
const currentBossIndex = ref(0)

/** 当前 BOSS 的内部剩余血量，仅用于本地演示和动画判断 */
const currentBossHp = ref(level.B[0])

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

/** 是否显示剧情式胜利结算动画 */
const showVictoryOverlay = ref(false)

/** 技能当前剩余冷却，下标和 PlayerSkills 对应 */
const skillCooldowns = ref<number[]>(
  level.PlayerSkills.map(() => 0),
)

/** 是否正在生成技能卡牌 */
const generatingSkillCards = ref(false)

/** 技能卡牌生成错误 */
const skillCardGenerateError = ref('')

/** 战斗日志：保留给死亡/胜利动画和后续联调，不在页面右侧展示 */
const logs = ref([
  '进入 BOSS 群挑战。',
  'BOSS 将按照顺序依次出现。',
  '每回合只能释放 1 张技能牌。',
  `需要在 ${level.minRouds} 回合内击败全部 BOSS。`,
  `若超时，将消耗 ${level.CoinConsumption} 金币并在当前位置复活。`,
])

/** BOSS 展示数据 */
const bosses = computed(() => [
  {
    index: 0,
    title: '第一守卫',
    name: '角牛幼兽',
    hp: level.B[0],
    type: 'cow',
    image: bossCowImg,
  },
  {
    index: 1,
    title: '第二守卫',
    name: '骷髅乞丐骑士',
    hp: level.B[1],
    type: 'skeleton',
    image: bossSkeletonImg,
  },
  {
    index: 2,
    title: '最终守卫',
    name: '高塔终末者',
    hp: level.B[2],
    type: 'tower',
    image: bossTowerImg,
  },
])

type BattleSkill = {
  index: number
  name: string
  damage: number
  cooldown: number
  desc: string
}

const defaultSkills: BattleSkill[] = [
  {
    index: 0,
    name: '普通攻击',
    damage: level.PlayerSkills[0][0],
    cooldown: level.PlayerSkills[0][1],
    desc: '稳定输出，无冷却，适合填补空回合。',
  },
  {
    index: 1,
    name: '重击',
    damage: level.PlayerSkills[1][0],
    cooldown: level.PlayerSkills[1][1],
    desc: '中等伤害，适合快速击败低血量 BOSS。',
  },
  {
    index: 2,
    name: '爆裂斩',
    damage: level.PlayerSkills[2][0],
    cooldown: level.PlayerSkills[2][1],
    desc: '高伤害，冷却较长，需要合理安排释放时机。',
  },
]

/** 固定技能栏：每回合只能选择一张技能牌 */
const skills = ref<BattleSkill[]>(defaultSkills)
const skillListRef = ref<HTMLElement | null>(null)

/** 当前目标文字 */
const currentTargetText = computed(() => {
  return `第 ${currentBossIndex.value + 1} 个 BOSS / 共 ${level.B.length} 个`
})

/** 判断是否是当前 BOSS */
function isCurrentBoss(index: number) {
  return index === currentBossIndex.value
}

/** 判断是否本轮已击败 */
function isDefeatedInCurrentAttempt(index: number) {
  return defeatedInCurrentAttempt.value.includes(index)
}

/** 判断血量是否已知 */
function isKnownBoss(index: number) {
  return knownBossIndexes.value.includes(index)
}

/** BOSS 血量显示规则 */
function getBossHpText(index: number, hp: number) {
  if (isDefeatedInCurrentAttempt(index)) {
    return `已击败，血量：${hp}`
  }

  if (isKnownBoss(index)) {
    return `已知血量：${hp}`
  }

  if (isCurrentBoss(index)) {
    return '血量：?? / ??'
  }

  return '血量：未知'
}

/** BOSS 状态文字 */
function getBossStatusText(index: number) {
  if (isDefeatedInCurrentAttempt(index)) {
    return '本轮已击败'
  }

  if (isCurrentBoss(index)) {
    return '战斗中'
  }

  return '等待出现'
}

/** 判断技能是否可用 */
function isSkillAvailable(skillIndex: number) {
  return skillCooldowns.value[skillIndex] === 0
}

/** 生成杀戮尖塔风格技能卡牌 */
async function generateSlayTheSpireSkillCards() {
  generatingSkillCards.value = true
  skillCardGenerateError.value = ''

  try {
    const cards = await generateSkillCards({
      count: 20,
      theme: '杀戮尖塔',
    })

    skills.value = cards.map((card, index) => ({
      index,
      name: card.name,
      damage: card.damage,
      cooldown: card.cooldown,
      desc: 'AI 生成的杀戮尖塔风格技能卡牌。',
    }))
    skillCooldowns.value = cards.map(() => 0)
  } catch (error) {
    skillCardGenerateError.value = error instanceof Error
      ? error.message
      : '生成技能卡牌失败'
  } finally {
    generatingSkillCards.value = false
  }
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
  skillCooldowns.value = skillCooldowns.value.map((cooldown, index) => {
    if (index === usedSkillIndex) {
      return cooldown
    }

    return Math.max(0, cooldown - 1)
  })

  if (currentRound.value < level.minRouds) {
    currentRound.value += 1
    logs.value.unshift(`进入第 ${currentRound.value} 回合。`)
  } else {
    mockTimeoutAndRevive()
  }
}

/** 当前 BOSS 被击败后的统一处理 */
function defeatCurrentBossBySkill(): boolean {
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

  if (currentBossIndex.value < level.B.length - 1) {
    currentBossIndex.value += 1
    currentBossHp.value = level.B[currentBossIndex.value]
    logs.value.unshift(`进入第 ${currentBossIndex.value + 1} 个 BOSS。`)
  } else {
    logs.value.unshift('全部 BOSS 已击败，BOSS 战通过。')
    playVictorySettlement()
    return true
  }

  return false
}

/** 使用技能 */
function useSkill(skillIndex: number) {
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
  const canRevive = currentCoins.value >= level.CoinConsumption

  showDeathOverlay.value = true
  reviving.value = true

  logs.value.unshift(`BOSS 战超过 ${level.minRouds} 回合，本轮挑战失败。`)

  window.setTimeout(() => {
    if (canRevive) {
      currentCoins.value -= level.CoinConsumption
      logs.value.unshift(`消耗 ${level.CoinConsumption} 金币。`)
    } else {
      logs.value.unshift('金币不足，无法复活，关卡失败。')
    }
  }, 3400)

  window.setTimeout(() => {
    if (canRevive) {
      attempt.value += 1
      currentRound.value = 1
      currentBossIndex.value = 0
      currentBossHp.value = level.B[0]
      defeatedInCurrentAttempt.value = []

      skillCooldowns.value = level.PlayerSkills.map(() => 0)
      damagePopup.value = null
      attackingBossIndex.value = null

      logs.value.unshift('原地复活，从第 1 个 BOSS 重新开始。')
    }

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
    <BossDeathOverlay
      :show="showDeathOverlay"
      :coin-cost="level.CoinConsumption"
    />

    <BossVictoryOverlay
      :show="showVictoryOverlay"
      :remaining-coins="currentCoins"
      :used-rounds="currentRound"
      :limit-rounds="level.minRouds"
    />

    <!-- 顶部标题 -->
    <header class="top-bar">
      <div class="coin-status">
        <span class="small-label">当前金币</span>
        <strong>{{ currentCoins }}</strong>
        <span class="hint">来自地图阶段拾取</span>
      </div>

      <div class="page-title">
        <h1>BOSS 群挑战</h1>
        <p>按顺序击败全部 BOSS，每回合只能释放一张技能牌</p>
      </div>

      <div class="target-status">
        <span class="small-label">当前目标</span>
        <strong>{{ currentTargetText }}</strong>
      </div>
    </header>

    <!-- 主战斗区 -->
    <section class="battle-layout">
      <!-- 左侧状态面板 -->
      <aside class="side-panel left-panel">
        <div class="round-box">
          <span>回合</span>
          <strong>{{ currentRound }} / {{ level.minRouds }}</strong>
        </div>

        <div class="info-row">
          <span>限定回合</span>
          <strong>{{ level.minRouds }}</strong>
        </div>

        <div class="info-row">
          <span>复活金币</span>
          <strong>{{ level.CoinConsumption }}</strong>
        </div>

        <div class="info-row">
          <span>挑战轮次</span>
          <strong>第 {{ attempt }} 轮</strong>
        </div>

        <div class="player-card">
          <div class="player-avatar image-avatar">
            <img :src="playerImg" alt="AI 玩家" />
          </div>

          <h2>AI 玩家</h2>
          <p>无血量设定，仅受回合数限制</p>
        </div>
      </aside>

      <!-- 中间 BOSS 区域 -->
      <section class="boss-stage">
        <article
          v-for="boss in bosses"
          :key="boss.index"
          class="boss-unit"
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

          <p class="hp-text">
            {{ getBossHpText(boss.index, boss.hp) }}
          </p>

          <div class="boss-status">
            {{ getBossStatusText(boss.index) }}
          </div>
        </article>
      </section>
    </section>

    <!-- 技能卡牌区 -->
    <section class="skill-area">
      <div class="skill-title">
        <strong>固定技能栏</strong>
        <span>每回合只能选择 1 张技能牌</span>
        <button
          class="generate-skill-button"
          type="button"
          :disabled="generatingSkillCards"
          @click="generateSlayTheSpireSkillCards"
        >
          {{ generatingSkillCards ? '生成中...' : '生成20张尖塔卡牌' }}
        </button>
      </div>

      <p
        v-if="skillCardGenerateError"
        class="skill-generate-error"
      >
        {{ skillCardGenerateError }}
      </p>

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

        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.boss-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  padding: 10px 18px 0;
  box-sizing: border-box;
  color: #f5e6c8;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  font-family:
    Inter,
    "Microsoft YaHei",
    sans-serif;
  overflow: hidden;
  display: grid;
  grid-template-rows: 72px minmax(0, 1fr) 285px;
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

:global(html),
:global(body),
:global(#app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

/* 顶部 HUD */
.top-bar {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: 215px 1fr 260px;
  align-items: start;
  gap: 18px;
  height: 72px;
  margin-bottom: 0;
}

.coin-status,
.target-status {
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

.coin-status strong,
.target-status strong {
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
  grid-template-columns: 275px 1fr;
  gap: 18px;
  align-items: end;
  height: auto;
  min-height: 0;
  overflow: visible;
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
  position: relative;
  overflow: visible;
  align-self: end;
  padding: 10px;
  margin-left: 50px;
  margin-bottom: 22px;
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
  left: calc(100% + 190px);
  bottom: 8px;
  width: 230px;
  margin-top: 0;
  text-align: center;
  transform: none;
}

.player-avatar {
  position: relative;
  width: 190px;
  height: 210px;
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
  width: 215px;
  height: 235px;
  object-fit: contain;
  filter:
    drop-shadow(0 24px 26px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 12px rgba(255, 216, 140, 0.12));
}

.player-card h2 {
  margin: 0;
  color: #f3d28a;
  font-size: 20px;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.9);
}

.player-card p {
  display: none;
}

/* BOSS 区域 */
.boss-stage {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 190px);
  gap: 16px;
  justify-content: end;
  align-items: end;
  padding: 0 92px 14px 0;
  border-radius: 16px;
  background: transparent;
}

.boss-unit {
  position: relative;
  min-height: 280px;
  padding: 0 4px 6px;
  text-align: center;
  border: none;
  border-radius: 16px;
  background: transparent;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.boss-unit.active {
  transform: translateY(-6px);
  border-color: transparent;
  background: transparent;
  animation: bossBreathing 1.8s ease-in-out infinite;
}

.boss-unit.locked {
  opacity: 0.52;
  filter: grayscale(0.25);
}

.boss-unit.defeated {
  animation: bossDefeated 0.55s ease forwards;
}

.boss-unit.hit {
  animation: bossHit 0.42s ease-in-out;
}

.boss-figure {
  position: relative;
  height: 205px;
  margin-top: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.boss-image {
  width: 100%;
  max-width: 168px;
  height: 205px;
  object-fit: contain;
  background: transparent;
  filter:
    drop-shadow(0 22px 24px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 14px rgba(255, 204, 115, 0.12));
  transition:
    transform 0.2s ease,
    filter 0.2s ease,
    opacity 0.2s ease;
}



.boss-unit.active .boss-image {
  transform: translateY(-8px) scale(1.04);
  filter:
    drop-shadow(0 24px 26px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 24px rgba(255, 203, 99, 0.34));
}
.boss-unit.tower .boss-image {
  max-width: 5000px;
  height: 390px;
 
}
.boss-unit.tower.active .boss-image {
  transform: translateY(78px) scale(1.45);
  filter:
    drop-shadow(0 24px 26px rgba(0, 0, 0, 0.74))
    drop-shadow(0 0 24px rgba(255, 203, 99, 0.34));
}
.boss-unit.locked .boss-image {
  opacity: 0.68;
  filter:
    grayscale(0.45)
    brightness(0.68)
    drop-shadow(0 14px 18px rgba(0, 0, 0, 0.58));
}

.boss-unit.defeated .boss-image {
  opacity: 0.42;
  filter:
    grayscale(0.85)
    brightness(0.65)
    drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5));
}

.boss-unit h3 {
  margin: 0 0 4px;
  color: #f3d28a;
  font-size: 20px;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.9);
}

.hp-text {
  margin: 0;
  color: #e9b2a3;
  font-size: 14px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.boss-status {
  margin: 8px auto 0;
  width: fit-content;
  padding: 4px 20px;
  border-radius: 8px;
  background: rgba(10, 13, 16, 0.46);
  border: 1px solid rgba(217, 175, 94, 0.2);
  color: #f0d7a5;
  font-size: 13px;
}

/* 技能区域 */
.skill-area {
  position: relative;
  z-index: 5;
  margin: 0 -18px;
  padding: 8px 18px 0;
  height: 285px;
  overflow: hidden;
  border-top: 1px solid rgba(243, 201, 111, 0.24);
  background:
    linear-gradient(180deg, rgba(10, 13, 16, 0.68), rgba(5, 7, 10, 0.88)),
    radial-gradient(circle at 50% 0%, rgba(255, 188, 84, 0.16), transparent 38%);
  box-shadow: 0 -18px 30px rgba(0, 0, 0, 0.32);
}

.skill-title {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  margin-bottom: 4px;
  color: #d8c7aa;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.skill-title strong {
  color: #f3d28a;
}

.generate-skill-button {
  cursor: pointer;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid rgba(243, 201, 111, 0.64);
  background: linear-gradient(180deg, #6f4a18, #352415);
  color: #fff2c6;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.generate-skill-button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.skill-generate-error {
  width: fit-content;
  max-width: 640px;
  margin: 8px auto 0;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 118, 94, 0.5);
  background: rgba(82, 18, 14, 0.58);
  color: #ffd2c7;
  font-size: 13px;
}

.skill-list {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 18px;
  width: min(1160px, calc(100% - 32px));
  height: 230px;
  min-height: 0;
  margin: 0 auto;
  padding: 22px 16px 18px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior: contain;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  transform: none;
  cursor: default;
  user-select: none;
  mask-image: linear-gradient(90deg, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%);
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
  flex: 0 0 162px;
  width: 162px;
  min-width: 162px;
  min-height: 172px;
  padding: 8px;
  box-sizing: border-box;
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
  transform: translateY(-6px);
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
  top: -10px;
  left: -10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #314e61;
  border: 2px solid #d9b66b;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff4d0;
  font-weight: 800;
}

.skill-card h3 {
  margin: 2px 0 7px;
  text-align: center;
  color: #f4d48c;
  font-size: 16px;
}

.card-art {
  height: 50px;
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
  margin-top: 7px;
  color: #f2e2c2;
  line-height: 1.35;
  font-size: 13px;
}

.skill-meta p {
  margin: 0;
}

.skill-state {
  margin-top: 7px;
  padding: 5px 10px;
  text-align: center;
  border-radius: 8px;
  background: rgba(57, 102, 65, 0.52);
  border: 1px solid rgba(129, 218, 122, 0.34);
  color: #d9ffd0;
  font-size: 13px;
}

.skill-state.cooling {
  background: rgba(111, 42, 36, 0.58);
  border-color: rgba(226, 97, 83, 0.38);
  color: #ffd1c7;
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

/* 动画：BOSS 受击 */
@keyframes bossHit {
  0% {
    transform: translateY(-6px) translateX(0);
    filter: brightness(1);
  }

  20% {
    transform: translateY(-6px) translateX(-8px);
    filter: brightness(1.5);
  }

  45% {
    transform: translateY(-6px) translateX(8px);
  }

  70% {
    transform: translateY(-6px) translateX(-4px);
  }

  100% {
    transform: translateY(-6px) translateX(0);
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
    transform: none;
  }

  .boss-stage {
    grid-template-columns: 1fr;
    padding: 0;
  }

  .boss-unit.active,
  .boss-unit.hit {
    transform: none;
  }

  .boss-order {
    margin: 12px 0;
  }

  .skill-list {
    flex-wrap: wrap;
    transform: none;
  }
}
</style>
