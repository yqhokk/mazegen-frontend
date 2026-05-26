<script setup lang="ts">
defineEmits<{
  navigate: ['home' | 'config' | 'maze' | 'boss']
}>()
</script>

<template>
  <section class="home-view">
    <div class="hero-copy">
      <p class="eyebrow">MazeGen Workflow</p>
      <h1>目录</h1>
      <p>先配置关卡，再进入迷宫阶段，最后进入 Boss 战。Boss 战不再作为应用主页面直接加载。</p>
    </div>

    <div class="menu-grid">
      <button
        type="button"
        class="menu-card primary"
        @click="$emit('navigate', 'config')"
      >
        <span>01</span>
        <strong>配置关卡</strong>
        <small>设置地图、算法、资源、Boss 和技能参数</small>
      </button>

      <button
        type="button"
        class="menu-card"
        @click="$emit('navigate', 'maze')"
      >
        <span>02</span>
        <strong>迷宫</strong>
        <small>展示地图生成、路径选择和资源拾取</small>
      </button>

      <button
        type="button"
        class="menu-card"
        @click="$emit('navigate', 'boss')"
      >
        <span>03</span>
        <strong>Boss 战</strong>
        <small>使用配置/后端关卡进入战斗演示</small>
      </button>
    </div>
  </section>
</template>

<style scoped>
.home-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 100vh;
  gap: clamp(28px, 5vw, 80px);
  padding: clamp(32px, 7vw, 96px);
  color: #f8fafc;
  background:
    radial-gradient(circle at 15% 20%, rgba(245, 158, 11, 0.28), transparent 34%),
    radial-gradient(circle at 82% 16%, rgba(59, 130, 246, 0.22), transparent 30%),
    linear-gradient(135deg, #111827 0%, #1e1b4b 52%, #0f172a 100%);
}

.home-view h1 {
  margin: 0;
  font-size: clamp(4rem, 12vw, 9rem);
  line-height: 0.95;
}

.home-view p {
  margin: 0;
  max-width: 620px;
  color: rgba(226, 232, 240, 0.78);
  font-size: 1.08rem;
  line-height: 1.8;
}

.hero-copy {
  display: grid;
  gap: 18px;
}

.eyebrow {
  color: #fbbf24 !important;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.menu-grid {
  display: grid;
  width: min(460px, 100%);
  gap: 16px;
}

.menu-card {
  cursor: pointer;
  display: grid;
  gap: 8px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 28px;
  padding: 24px;
  color: #f8fafc;
  text-align: left;
  background: rgba(15, 23, 42, 0.58);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.menu-card:hover,
.menu-card.primary {
  border-color: rgba(251, 191, 36, 0.5);
  background: rgba(146, 64, 14, 0.48);
  transform: translateY(-2px);
}

.menu-card span {
  color: #fbbf24;
  font-weight: 900;
}

.menu-card strong {
  font-size: 1.45rem;
}

.menu-card small {
  color: rgba(226, 232, 240, 0.68);
  line-height: 1.6;
}

@media (max-width: 900px) {
  .home-view {
    align-items: stretch;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
