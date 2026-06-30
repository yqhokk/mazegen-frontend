<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, ref } from 'vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import BossView from './views/BossView.vue'
import HomeView from './views/HomeView.vue'
import LevelConfigView from './views/LevelConfigView.vue'
import MazeView from './views/MazeView.vue'
import type { GenerateLevelRequest } from './api/level'
import type { LevelDefinition } from './types'
import intoBossBg from './assets/images/maze/into_boss.png'

type AppPage = 'home' | 'config' | 'maze' | 'boss'

const currentPage = ref<AppPage>('home')
const activeBossLevel = shallowRef<LevelDefinition | null>(null)
const bossInitialCoins = ref(0)
const bossCleared = ref(false)
const isBossIntroPlaying = ref(false)
const mazeSessionKey = ref(0)
let bossIntroTimer: ReturnType<typeof setTimeout> | undefined

const levelRequest = ref<GenerateLevelRequest>({
  size: 15,
  algorithm: 'dfs',
  resourceConfig: {
    coinRatio: 0.3,
    trapRatio: 0.15,
    coinValue: 50,
    trapValue: -30,
  },
  bossConfig: {
    bossCount: 3,
    skillCount: 2,
    roundSlack: 2,
  },
})

const pageTitle = computed(() => {
  if (currentPage.value === 'config') return '配置关卡'
  if (currentPage.value === 'maze') return '迷宫'
  if (currentPage.value === 'boss') return 'Boss 战'
  return '目录'
})

const isNavigationLocked = computed(() =>
  isBossIntroPlaying.value || (currentPage.value === 'boss' && !bossCleared.value)
)

function goTo(page: AppPage) {
  if (isNavigationLocked.value) {
    return
  }

  if (page === 'boss' && !activeBossLevel.value) {
    return
  }

  currentPage.value = page
}

function enterBoss(payload: { level: LevelDefinition; coins: number }) {
  activeBossLevel.value = payload.level
  bossInitialCoins.value = Math.max(0, payload.coins)
  bossCleared.value = false
  isBossIntroPlaying.value = true

  clearTimeout(bossIntroTimer)
  bossIntroTimer = window.setTimeout(() => {
    currentPage.value = 'boss'
    isBossIntroPlaying.value = false
  }, 4600)
}

function handleBossCleared() {
  clearTimeout(bossIntroTimer)
  isBossIntroPlaying.value = false
  bossCleared.value = false
  activeBossLevel.value = null
  bossInitialCoins.value = 0
  mazeSessionKey.value += 1
  currentPage.value = 'maze'
}

function resetToMazeStart() {
  clearTimeout(bossIntroTimer)
  isBossIntroPlaying.value = false
  bossCleared.value = false
  activeBossLevel.value = null
  bossInitialCoins.value = 0
  mazeSessionKey.value += 1
  currentPage.value = 'maze'
}

onBeforeUnmount(() => {
  clearTimeout(bossIntroTimer)
})
</script>

<template>
  <DefaultLayout
    :page="currentPage"
    :title="pageTitle"
    :navigation-locked="isNavigationLocked"
    :boss-disabled="!activeBossLevel && currentPage !== 'boss'"
    @navigate="goTo"
  >
    <HomeView
      v-if="currentPage === 'home'"
      @navigate="goTo"
    />
    <LevelConfigView
      v-else-if="currentPage === 'config'"
      v-model="levelRequest"
      @navigate="goTo"
    />
    <MazeView
      v-if="currentPage === 'maze' || currentPage === 'boss'"
      v-show="currentPage === 'maze'"
      :key="mazeSessionKey"
      :generate-request="levelRequest"
      :boss-cleared="bossCleared"
      @navigate="goTo"
      @enter-boss="enterBoss"
      @game-over="resetToMazeStart"
    />
    <BossView
      v-if="currentPage === 'boss'"
      :key="mazeSessionKey"
      :generate-request="levelRequest"
      :initial-level="activeBossLevel ?? undefined"
      :initial-coins="bossInitialCoins"
      @cleared="handleBossCleared"
      @game-over="resetToMazeStart"
    />

    <Transition name="boss-intro-fade">
      <div
        v-if="isBossIntroPlaying"
        class="boss-intro-overlay"
      >
        <img class="intro-art" :src="intoBossBg" alt="" />
        <div class="intro-shade"></div>
        <div class="intro-crack crack-one"></div>
        <div class="intro-crack crack-two"></div>
        <div class="intro-crack crack-three"></div>
        <div class="intro-fog fog-one"></div>
        <div class="intro-fog fog-two"></div>
        <div class="intro-flash"></div>
        <section class="intro-subtitles">
          <p class="subtitle-line subtitle-one">雷根斯堡的古钟，在雾后低声苏醒。</p>
          <p class="subtitle-line subtitle-two">封印裂开，黑火沿着王座的纹路回流。</p>
          <p class="subtitle-line subtitle-three">踏入门内，守卫者将称量你的灵魂。</p>
        </section>
      </div>
    </Transition>
  </DefaultLayout>
</template>

<style scoped>
.boss-intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  overflow: hidden;
  pointer-events: none;
  background-color: #020305;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intro-art {
  position: relative;
  z-index: 1;
  width: min(70vw, 900px);
  max-height: 68vh;
  object-fit: contain;
  filter:
    brightness(0.82)
    saturate(1.05)
    drop-shadow(0 34px 54px rgba(0, 0, 0, 0.72))
    drop-shadow(0 0 24px rgba(180, 54, 35, 0.22));
  animation: introImagePress 4.6s ease forwards;
}

.intro-shade {
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    radial-gradient(circle at 50% 48%, transparent 0 22%, rgba(133, 23, 18, 0.14) 48%, transparent 72%),
    linear-gradient(90deg, rgba(0, 0, 0, 0.86), rgba(0, 0, 0, 0.12) 54%, rgba(0, 0, 0, 0.86)),
    linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.88));
  animation: introShadePress 4.6s ease forwards;
}

.intro-crack {
  position: absolute;
  z-index: 3;
  width: 3px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, transparent, rgba(255, 77, 58, 0.86), transparent);
  box-shadow:
    0 0 12px rgba(255, 62, 45, 0.7),
    0 0 26px rgba(147, 26, 20, 0.52);
  opacity: 0;
  transform-origin: top center;
  animation: introCrackIn 0.6s ease-out forwards;
  animation-delay: 0.45s;
}

.crack-one {
  top: 12%;
  left: 34%;
  height: 230px;
  transform: rotate(-22deg);
}

.crack-two {
  top: 20%;
  right: 28%;
  height: 190px;
  transform: rotate(28deg);
  animation-delay: 0.75s;
}

.crack-three {
  bottom: 12%;
  left: 52%;
  height: 220px;
  transform: rotate(76deg);
  animation-delay: 1.05s;
}

.intro-fog {
  position: absolute;
  z-index: 3;
  width: 130%;
  height: 180px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(0, 0, 0, 0.76), rgba(61, 8, 9, 0.38), transparent);
  filter: blur(28px);
  opacity: 0;
}

.fog-one {
  top: 22%;
  left: -32%;
  animation: introFogRight 4.4s ease-out forwards;
  animation-delay: 0.2s;
}

.fog-two {
  bottom: 12%;
  right: -34%;
  animation: introFogLeft 4.4s ease-out forwards;
  animation-delay: 0.55s;
}

.intro-flash {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgba(255, 230, 180, 0.12);
  opacity: 0;
  animation: introFlash 0.32s ease-out forwards;
  animation-delay: 3.95s;
}

.intro-subtitles {
  position: absolute;
  left: clamp(28px, 7vw, 96px);
  bottom: clamp(34px, 9vh, 88px);
  z-index: 4;
  width: min(820px, 82vw);
  pointer-events: none;
}

.subtitle-line {
  margin: 11px 0;
  color: #ffe3a3;
  font-family:
    "STKaiti",
    "KaiTi",
    "FangSong",
    serif;
  font-size: clamp(20px, 3vw, 34px);
  font-weight: 800;
  line-height: 1.45;
  letter-spacing: 0;
  opacity: 0;
  transform: translateY(18px);
  filter: blur(5px);
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.96),
    0 0 16px rgba(255, 207, 112, 0.42),
    0 0 34px rgba(176, 45, 32, 0.36);
}

.subtitle-one {
  animation: subtitleIn 0.72s ease forwards;
  animation-delay: 0.45s;
}

.subtitle-two {
  color: #f4c675;
  animation: subtitleIn 0.72s ease forwards;
  animation-delay: 1.45s;
}

.subtitle-three {
  color: #f8ead0;
  animation: subtitleIn 0.9s ease forwards;
  animation-delay: 2.45s;
}

.boss-intro-fade-enter-active,
.boss-intro-fade-leave-active {
  transition: opacity 0.55s ease;
}

.boss-intro-fade-enter-from,
.boss-intro-fade-leave-to {
  opacity: 0;
}

@keyframes introImagePress {
  0% {
    transform: scale(0.96);
    filter:
      brightness(0.76)
      saturate(0.92)
      drop-shadow(0 34px 54px rgba(0, 0, 0, 0.72))
      drop-shadow(0 0 24px rgba(180, 54, 35, 0.22));
  }

  58% {
    transform: scale(1);
    filter:
      brightness(0.96)
      saturate(1.08)
      drop-shadow(0 34px 54px rgba(0, 0, 0, 0.72))
      drop-shadow(0 0 28px rgba(220, 75, 48, 0.3));
  }

  100% {
    transform: scale(1.04);
    filter:
      brightness(0.62)
      saturate(1.18)
      drop-shadow(0 34px 54px rgba(0, 0, 0, 0.72))
      drop-shadow(0 0 32px rgba(220, 75, 48, 0.34));
  }
}

@keyframes introShadePress {
  0% {
    opacity: 0.72;
  }

  100% {
    opacity: 1;
  }
}

@keyframes introCrackIn {
  0% {
    opacity: 0;
    filter: blur(5px);
  }

  100% {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes introFogRight {
  0% {
    opacity: 0;
    transform: translateX(-160px);
  }

  34% {
    opacity: 0.86;
  }

  100% {
    opacity: 0.54;
    transform: translateX(150px);
  }
}

@keyframes introFogLeft {
  0% {
    opacity: 0;
    transform: translateX(160px);
  }

  34% {
    opacity: 0.82;
  }

  100% {
    opacity: 0.5;
    transform: translateX(-150px);
  }
}

@keyframes introFlash {
  0% {
    opacity: 0;
  }

  45% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@keyframes subtitleIn {
  0% {
    opacity: 0;
    transform: translateY(18px);
    filter: blur(5px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@media (max-width: 720px) {
  .intro-art {
    width: min(86vw, 620px);
    max-height: 58vh;
  }

  .intro-subtitles {
    left: 24px;
    right: 24px;
    bottom: 32px;
    width: auto;
  }
}
</style>
