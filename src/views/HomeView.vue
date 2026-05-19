<script setup lang="ts">
</script>

<template>
  <section class="home-view">
    <h1>MazeGen</h1>
    <p>Vue + Tauri project scaffold is ready.</p>
  </section>
</template>

<style scoped>
.home-view {
  display: grid;
  min-height: 100vh;
  place-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.home-view h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 5rem);
}

.home-view p {
  margin: 0;
  color: #64748b;
}
</style>
