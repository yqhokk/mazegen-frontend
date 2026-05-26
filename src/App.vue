<script setup lang="ts">
import { computed, ref } from 'vue'
import DefaultLayout from './layouts/DefaultLayout.vue'
import BossView from './views/BossView.vue'
import HomeView from './views/HomeView.vue'
import LevelConfigView from './views/LevelConfigView.vue'
import type { GenerateLevelRequest } from './api/level'

type AppPage = 'home' | 'config' | 'maze' | 'boss'

const currentPage = ref<AppPage>('home')
const levelRequest = ref<GenerateLevelRequest>({
  size: 15,
  algorithm: 'dfs',
  resourceConfig: {
    coinRatio: 0.3,
    trapRatio: 0.15,
    coinValue: 50,
    trapValue: -30,
    difficulty: 'normal',
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

function goTo(page: AppPage) {
  currentPage.value = page
}
</script>

<template>
  <DefaultLayout
    :page="currentPage"
    :title="pageTitle"
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
    <section
      v-else-if="currentPage === 'maze'"
      class="placeholder-page"
    >
      <p class="eyebrow">Maze</p>
      <h1>迷宫</h1>
      <p>这里后续接地图生成、资源拾取和路径演示；Boss 战不再作为主页面直接进入。</p>
      <div class="actions">
        <button @click="goTo('config')">返回配置关卡</button>
        <button @click="goTo('boss')">进入 Boss 战</button>
      </div>
    </section>
    <BossView
      v-else
      :generate-request="levelRequest"
    />
  </DefaultLayout>
</template>

<style scoped>
.placeholder-page {
  display: grid;
  min-height: calc(100vh - 72px);
  align-content: center;
  gap: 18px;
  padding: clamp(32px, 8vw, 96px);
  color: #f8fafc;
  background:
    radial-gradient(circle at 20% 18%, rgba(245, 158, 11, 0.24), transparent 32%),
    linear-gradient(135deg, #111827 0%, #1e1b4b 52%, #0f172a 100%);
}

.placeholder-page h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 5.5rem);
}

.placeholder-page p {
  max-width: 760px;
  margin: 0;
  color: rgba(226, 232, 240, 0.78);
  font-size: 1.05rem;
  line-height: 1.8;
}

.eyebrow {
  color: #fbbf24 !important;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 10px;
}

.actions button {
  cursor: pointer;
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 999px;
  padding: 12px 22px;
  color: #fff7ed;
  background: rgba(180, 83, 9, 0.72);
  font-weight: 800;
}
</style>