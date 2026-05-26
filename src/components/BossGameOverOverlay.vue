<script setup lang="ts">
import failureBg from '../assets/images/boss/failure.jpg'

defineProps<{
  show: boolean
}>()
</script>

<template>
  <Transition name="game-over-fade">
    <div
      v-if="show"
      class="game-over-overlay"
      :style="{ backgroundImage: `url(${failureBg})` }"
    >
      <div class="shade"></div>

      <section class="ending-copy">
        <p class="ending-line line-one">你曾经看见出口。</p>
        <p class="ending-line line-two">那道光就在碎石门后，安静得像一个承诺。</p>
        <p class="ending-line line-three">可当你伸手推门时，钱袋里只剩下空洞的摩擦声。</p>
        <p class="ending-line line-four">石门没有打开。</p>
        <p class="ending-line line-five">身后的路也已经消失。</p>
        <p class="ending-line line-six">你站在黑暗里，终于成为迷宫的一部分。</p>
      </section>

      <div class="final-mark">
        <span>游戏结束</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.game-over-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;
  background-color: #020305;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.24) 56%, rgba(0, 0, 0, 0.76)),
    linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.82));
}

.ending-copy {
  position: absolute;
  top: 12%;
  left: 7%;
  z-index: 2;
  width: min(820px, 64vw);
}

.ending-line {
  margin: 13px 0;
  color: #f0dec4;
  font-size: 23px;
  line-height: 1.7;
  letter-spacing: 1px;
  opacity: 0;
  transform: translateY(18px);
  filter: blur(5px);
  text-shadow:
    0 2px 14px rgba(0, 0, 0, 0.95),
    0 0 18px rgba(209, 168, 91, 0.18);
}

.line-one {
  animation: endingLineIn 0.7s ease forwards;
  animation-delay: 0.3s;
}

.line-two {
  animation: endingLineIn 0.7s ease forwards;
  animation-delay: 1s;
}

.line-three {
  color: #ead1a4;
  animation: endingLineIn 0.7s ease forwards;
  animation-delay: 1.7s;
}

.line-four {
  color: #efb395;
  animation: endingLineIn 0.7s ease forwards;
  animation-delay: 2.4s;
}

.line-five {
  color: #cbd2d3;
  animation: endingLineIn 0.7s ease forwards;
  animation-delay: 3.1s;
}

.line-six {
  color: #f1e3cf;
  animation: endingLineIn 1s ease forwards;
  animation-delay: 3.8s;
}

.final-mark {
  position: absolute;
  right: 8%;
  bottom: 10%;
  z-index: 2;
  opacity: 0;
  animation: finalMarkIn 0.9s ease forwards;
  animation-delay: 4.7s;
}

.final-mark span {
  display: block;
  padding: 18px 42px;
  color: #f2ddc4;
  border: 2px solid rgba(198, 166, 120, 0.38);
  border-radius: 10px;
  background: rgba(3, 4, 5, 0.7);
  box-shadow:
    0 18px 46px rgba(0, 0, 0, 0.76),
    inset 0 0 26px rgba(255, 226, 178, 0.05);
  font-size: 42px;
  font-weight: 900;
  letter-spacing: 10px;
  backdrop-filter: blur(2px);
}

.game-over-fade-enter-active,
.game-over-fade-leave-active {
  transition: opacity 0.9s ease;
}

.game-over-fade-enter-from,
.game-over-fade-leave-to {
  opacity: 0;
}

@keyframes endingLineIn {
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

@keyframes finalMarkIn {
  0% {
    opacity: 0;
    transform: translateY(22px) scale(0.94);
    filter: blur(4px);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@media (max-width: 900px) {
  .ending-copy {
    left: 6%;
    right: 6%;
    width: auto;
  }

  .ending-line {
    font-size: 17px;
  }

  .final-mark {
    left: 50%;
    right: auto;
    bottom: 8%;
    transform: translateX(-50%);
  }

  .final-mark span {
    font-size: 30px;
    letter-spacing: 5px;
  }
}
</style>
