<script setup lang="ts">
defineProps<{
  page: 'home' | 'config' | 'maze' | 'boss'
  title: string
}>()

defineEmits<{
  navigate: ['home' | 'config' | 'maze' | 'boss']
}>()
</script>

<template>
  <main class="default-layout">
    <header class="app-shell-header">
      <button
        type="button"
        class="brand"
        @click="$emit('navigate', 'home')"
      >
        MazeGen
      </button>
      <nav aria-label="主导航">
        <button
          type="button"
          :class="{ active: page === 'home' }"
          @click="$emit('navigate', 'home')"
        >
          目录
        </button>
        <button
          type="button"
          :class="{ active: page === 'config' }"
          @click="$emit('navigate', 'config')"
        >
          配置关卡
        </button>
        <button
          type="button"
          :class="{ active: page === 'maze' }"
          @click="$emit('navigate', 'maze')"
        >
          迷宫
        </button>
        <button
          type="button"
          :class="{ active: page === 'boss' }"
          @click="$emit('navigate', 'boss')"
        >
          Boss 战
        </button>
      </nav>
      <span class="current-title">{{ title }}</span>
    </header>
    <slot />
  </main>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
}

.app-shell-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 72px;
  padding: 12px clamp(18px, 4vw, 44px);
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(16px);
}

.brand,
nav button {
  cursor: pointer;
  border: 0;
  color: inherit;
  background: transparent;
}

.brand {
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
}

nav button {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 8px 14px;
  color: rgba(226, 232, 240, 0.76);
  font-weight: 700;
}

nav button.active,
nav button:hover {
  color: #fff7ed;
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(251, 191, 36, 0.38);
}

.current-title {
  color: rgba(226, 232, 240, 0.64);
  font-size: 0.92rem;
  font-weight: 700;
}

@media (max-width: 720px) {
  .app-shell-header {
    align-items: flex-start;
    flex-direction: column;
  }

  nav {
    width: 100%;
  }
}
</style>
