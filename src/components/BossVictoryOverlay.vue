<script setup lang="ts">
defineProps<{
  show: boolean
  remainingCoins: number
  usedRounds: number
  limitRounds: number
}>()
</script>

<template>
  <Transition name="victory-overlay-fade">
    <div v-if="show" class="victory-overlay">
      <!-- 黑暗背景 -->
      <div class="dark-bg"></div>

      <!-- 破晓光束 -->
      <div class="dawn-light"></div>
      <div class="light-core"></div>
      <div class="light-dust dust-one"></div>
      <div class="light-dust dust-two"></div>
      <div class="light-dust dust-three"></div>

      <!-- 黑雾散开 -->
      <div class="mist mist-left"></div>
      <div class="mist mist-right"></div>

      <!-- 剧情文字 -->
      <section class="victory-story">
        <p class="story-line line-one">
          最后一张牌落下。
        </p>

        <p class="story-line line-two">
          最终守卫的身影在黑雾中崩散。
        </p>

        <p class="story-line line-three">
          高塔的钟声停止了。
        </p>

        <p class="story-line line-four">
          散落的金币在废墟间闪烁。
        </p>

        <p class="story-line line-five">
          你从守卫的阴影中站起。
        </p>

        <p class="story-line line-six">
          BOSS 群已被击败。
        </p>

        <p class="story-line line-seven">
          通往终点的道路重新显现。
        </p>
      </section>

      <!-- 角色剪影 -->
      <div class="standing-hero">
        <div class="hero-cloak"></div>
        <div class="hero-head"></div>
        <div class="hero-sword"></div>
      </div>

      <!-- 胜利结算面板 -->
      <div class="victory-panel">
        <div class="victory-mark">
          ✦
        </div>

        <h1>挑战胜利</h1>

        <div class="victory-line"></div>

        <div class="settlement-row">
          <span>通关回合</span>
          <strong>{{ usedRounds }} / {{ limitRounds }}</strong>
        </div>

        <div class="settlement-row">
          <span>剩余金币</span>
          <strong>{{ remainingCoins }}</strong>
        </div>

        <p class="victory-hint">
          BOSS 战阶段完成，AI 玩家可以继续向终点前进。
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.victory-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  overflow: hidden;
  pointer-events: none;
  background: rgba(4, 7, 10, 0.94);
}

/* 背景 */
.dark-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 12%, rgba(255, 232, 160, 0.18), transparent 22%),
    radial-gradient(circle at 50% 100%, rgba(20, 55, 70, 0.24), transparent 48%),
    linear-gradient(180deg, #05080d 0%, #0d1820 48%, #050608 100%);
  animation: bgBrighten 4.8s ease forwards;
}

/* 破晓光束 */
.dawn-light {
  position: absolute;
  top: -12%;
  left: 50%;
  width: 360px;
  height: 118%;
  transform: translateX(-50%) skewX(-8deg);
  background:
    linear-gradient(
      180deg,
      rgba(255, 239, 177, 0.82) 0%,
      rgba(255, 218, 119, 0.38) 34%,
      rgba(255, 214, 134, 0.12) 68%,
      transparent 100%
    );
  filter: blur(12px);
  opacity: 0;
  animation: lightFall 1.6s ease-out forwards;
  animation-delay: 0.35s;
}

.light-core {
  position: absolute;
  top: -6%;
  left: 50%;
  width: 120px;
  height: 105%;
  transform: translateX(-50%);
  background:
    linear-gradient(
      180deg,
      rgba(255, 247, 211, 0.96),
      rgba(255, 226, 145, 0.44),
      transparent
    );
  filter: blur(18px);
  opacity: 0;
  animation: lightCore 2.2s ease-out forwards;
  animation-delay: 0.7s;
}

/* 光尘 */
.light-dust {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 232, 158, 0.9);
  box-shadow:
    0 0 12px rgba(255, 220, 130, 0.9),
    0 0 28px rgba(255, 220, 130, 0.4);
  opacity: 0;
}

.dust-one {
  top: 34%;
  left: 42%;
  animation: dustFloat 3.2s ease-in-out infinite;
  animation-delay: 1s;
}

.dust-two {
  top: 46%;
  left: 55%;
  animation: dustFloat 3.6s ease-in-out infinite;
  animation-delay: 1.4s;
}

.dust-three {
  top: 62%;
  left: 48%;
  animation: dustFloat 4s ease-in-out infinite;
  animation-delay: 1.8s;
}

/* 黑雾散开 */
.mist {
  position: absolute;
  top: 30%;
  width: 70%;
  height: 240px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(0, 0, 0, 0.74), rgba(14, 23, 28, 0.44), transparent);
  filter: blur(28px);
  opacity: 0.9;
}

.mist-left {
  left: -20%;
  animation: mistLeft 3.2s ease-out forwards;
}

.mist-right {
  right: -20%;
  animation: mistRight 3.2s ease-out forwards;
}

/* 剧情文字 */
.victory-story {
  position: absolute;
  top: 10%;
  left: 7%;
  z-index: 4;
  width: 620px;
}

.story-line {
  margin: 13px 0;
  color: #d8c7a7;
  font-size: 21px;
  letter-spacing: 2px;
  line-height: 1.55;
  opacity: 0;
  transform: translateX(-18px);
  filter: blur(4px);
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.88),
    0 0 18px rgba(255, 216, 142, 0.16);
}

.line-one {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 0.3s;
}

.line-two {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 0.8s;
}

.line-three {
  color: #e4d3ad;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 1.3s;
}

.line-four {
  color: #e2be74;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 1.8s;
}

.line-five {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 2.3s;
}

.line-six {
  color: #ffdd8a;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 2.8s;
}

.line-seven {
  color: #d6e4dc;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 3.3s;
}

/* 站起的角色剪影 */
.standing-hero {
  position: absolute;
  right: 18%;
  bottom: 18%;
  z-index: 3;
  width: 190px;
  height: 260px;
  opacity: 0;
  animation: heroStand 1.1s ease-out forwards;
  animation-delay: 2s;
}

.hero-cloak {
  position: absolute;
  left: 52px;
  top: 82px;
  width: 76px;
  height: 128px;
  border-radius: 38px 38px 18px 18px;
  background: linear-gradient(180deg, #24384a, #0b1017);
  border: 4px solid rgba(0, 0, 0, 0.88);
  box-shadow:
    0 28px 34px rgba(0, 0, 0, 0.48),
    0 0 26px rgba(255, 218, 144, 0.12);
}

.hero-head {
  position: absolute;
  left: 72px;
  top: 50px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #d8c8a8;
  border: 4px solid #090d10;
}

.hero-sword {
  position: absolute;
  left: 132px;
  top: 62px;
  width: 9px;
  height: 170px;
  border-radius: 8px;
  background: #d8d1bd;
  border: 2px solid #090d10;
  transform: rotate(24deg);
  box-shadow: 0 0 16px rgba(255, 232, 174, 0.38);
}

/* 胜利面板 */
.victory-panel {
  position: absolute;
  right: 7%;
  top: 17%;
  z-index: 5;
  width: 390px;
  padding: 28px 32px 30px;
  text-align: center;
  border: 2px solid rgba(224, 186, 99, 0.7);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(30, 38, 34, 0.94), rgba(9, 14, 15, 0.96)),
    radial-gradient(circle at 50% 0%, rgba(255, 222, 135, 0.1), transparent 65%);
  box-shadow:
    0 0 46px rgba(255, 207, 105, 0.24),
    0 24px 66px rgba(0, 0, 0, 0.68),
    inset 0 0 30px rgba(255, 226, 144, 0.05);
  opacity: 0;
  transform: scale(0.92) translateY(24px);
  animation: panelIn 0.7s ease-out forwards;
  animation-delay: 3.8s;
}

.victory-mark {
  color: #f5cf78;
  font-size: 34px;
  text-shadow: 0 0 20px rgba(255, 221, 122, 0.7);
  animation: markPulse 1.2s ease-in-out infinite;
}

.victory-panel h1 {
  margin: 4px 0 0;
  color: #ffe7ad;
  font-size: 42px;
  letter-spacing: 8px;
  text-shadow:
    0 0 20px rgba(255, 218, 116, 0.42),
    0 4px 0 rgba(0, 0, 0, 0.72);
}

.victory-line {
  width: 74%;
  height: 2px;
  margin: 18px auto 20px;
  background: linear-gradient(90deg, transparent, #e0b95f, transparent);
}

.settlement-row {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(224, 186, 99, 0.22);
  color: #d7c7a7;
  font-size: 16px;
}

.settlement-row strong {
  color: #ffe08a;
  font-size: 20px;
}

.victory-hint {
  margin: 18px 0 0;
  color: #b9c9c3;
  line-height: 1.7;
  font-size: 14px;
}

/* 过渡 */
.victory-overlay-fade-enter-active,
.victory-overlay-fade-leave-active {
  transition: opacity 0.85s ease;
}

.victory-overlay-fade-enter-from,
.victory-overlay-fade-leave-to {
  opacity: 0;
}

/* 动画定义 */
@keyframes bgBrighten {
  0% {
    filter: brightness(0.72);
  }

  100% {
    filter: brightness(1.12);
  }
}

@keyframes lightFall {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-120px) skewX(-8deg);
  }

  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) skewX(-8deg);
  }
}

@keyframes lightCore {
  0% {
    opacity: 0;
    transform: translateX(-50%) scaleY(0.4);
  }

  100% {
    opacity: 0.9;
    transform: translateX(-50%) scaleY(1);
  }
}

@keyframes dustFloat {
  0% {
    opacity: 0;
    transform: translateY(18px) scale(0.7);
  }

  40% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateY(-46px) scale(1.15);
  }
}

@keyframes mistLeft {
  0% {
    opacity: 0.9;
    transform: translateX(0);
  }

  100% {
    opacity: 0.24;
    transform: translateX(-260px);
  }
}

@keyframes mistRight {
  0% {
    opacity: 0.9;
    transform: translateX(0);
  }

  100% {
    opacity: 0.24;
    transform: translateX(260px);
  }
}

@keyframes storyLineIn {
  0% {
    opacity: 0;
    transform: translateX(-18px);
    filter: blur(4px);
  }

  100% {
    opacity: 1;
    transform: translateX(0);
    filter: blur(0);
  }
}

@keyframes heroStand {
  0% {
    opacity: 0;
    transform: translateY(34px) scale(0.94);
    filter: blur(4px);
  }

  55% {
    opacity: 1;
    transform: translateY(-8px) scale(1.02);
    filter: blur(0);
  }

  100% {
    opacity: 0.92;
    transform: translateY(0) scale(1);
  }
}

@keyframes panelIn {
  0% {
    opacity: 0;
    transform: scale(0.92) translateY(24px);
    filter: blur(4px);
  }

  65% {
    opacity: 1;
    transform: scale(1.04) translateY(0);
    filter: blur(0);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes markPulse {
  0% {
    opacity: 0.62;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.16);
  }

  100% {
    opacity: 0.62;
    transform: scale(1);
  }
}

@media (max-width: 1000px) {
  .victory-story {
    left: 6%;
    right: 6%;
    width: auto;
  }

  .story-line {
    font-size: 17px;
  }

  .standing-hero {
    right: 4%;
    bottom: 12%;
    transform: scale(0.78);
  }

  .victory-panel {
    left: 50%;
    right: auto;
    top: auto;
    bottom: 8%;
    width: 330px;
    transform: translateX(-50%);
  }

  .victory-panel h1 {
    font-size: 32px;
    letter-spacing: 5px;
  }
}
</style>