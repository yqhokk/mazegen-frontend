<script setup lang="ts">
defineProps<{
  show: boolean
  coinCost: number
}>()
</script>

<template>
  <Transition name="death-overlay-fade">
    <div v-if="show" class="death-overlay">
      <!-- 画面突然变暗 -->
      <div class="dark-cover"></div>

      <!-- 红色裂纹 -->
      <div class="crack-layer">
        <span class="crack crack-one"></span>
        <span class="crack crack-two"></span>
        <span class="crack crack-three"></span>
        <span class="crack crack-four"></span>
        <span class="crack crack-five"></span>
      </div>

      <!-- 黑雾 -->
      <div class="black-fog fog-one"></div>
      <div class="black-fog fog-two"></div>
      <div class="black-fog fog-three"></div>

      <!-- 剧情文字 -->
      <section class="story-text">
        <p class="story-line line-one">
          回合数耗尽……
        </p>

        <p class="story-line line-two">
          高塔深处的钟声在黑雾中响起。
        </p>

        <p class="story-line line-three">
          BOSS 群仍未被击败，守卫的影子重新压近。
        </p>

        <p class="story-line line-four">
          你倒在了守卫面前，手中的牌散落一地。
        </p>

        <p class="story-line line-five">
          意识即将沉入黑暗时，金币发出微弱的光。
        </p>

        <p class="story-line line-six">
          金币替你买回了一次喘息。
        </p>

        <p class="story-line line-seven">
          消耗 <strong>{{ coinCost }}</strong> 金币，原地复活。
        </p>

        <p class="story-line line-eight">
          残留的记忆仍在：已击败过的 BOSS 血量被记录下来。
        </p>

        <p class="story-line line-nine">
          战斗将从第一个 BOSS 重新开始。
        </p>
      </section>

      <!-- 倒下的玩家剪影 -->
      <div class="fallen-hero">
        <div class="hero-cloak"></div>
        <div class="hero-sword"></div>
        <div class="fallen-card card-a"></div>
        <div class="fallen-card card-b"></div>
        <div class="fallen-card card-c"></div>
      </div>

      <!-- 中央失败印记 -->
      <div class="death-title">
        <span>挑战失败</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.death-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  overflow: hidden;
  pointer-events: none;
  background: rgba(3, 4, 6, 0.92);
  animation:
    suddenDark 0.18s ease-out,
    screenShake 0.42s ease-in-out;
}

/* 黑暗压下来的遮罩 */
.dark-cover {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      circle at center,
      rgba(80, 13, 13, 0.12) 0%,
      rgba(0, 0, 0, 0.42) 44%,
      rgba(0, 0, 0, 0.94) 100%
    ),
    linear-gradient(
      180deg,
      rgba(19, 7, 9, 0.86),
      rgba(0, 0, 0, 0.96)
    );
  animation: darkPress 0.85s ease-out forwards;
}

/* 红色裂纹 */
.crack-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  animation: cracksIn 0.5s ease-out forwards;
  animation-delay: 0.18s;
}

.crack {
  position: absolute;
  width: 3px;
  height: 180px;
  border-radius: 999px;
  background:
    linear-gradient(
      180deg,
      transparent,
      rgba(255, 66, 49, 0.82),
      transparent
    );
  box-shadow:
    0 0 8px rgba(255, 57, 46, 0.72),
    0 0 18px rgba(174, 25, 22, 0.55);
  transform-origin: top center;
}

.crack-one {
  top: 10%;
  left: 28%;
  height: 240px;
  transform: rotate(-24deg);
}

.crack-two {
  top: 18%;
  left: 61%;
  height: 210px;
  transform: rotate(18deg);
}

.crack-three {
  top: 46%;
  left: 42%;
  height: 180px;
  transform: rotate(68deg);
}

.crack-four {
  top: 35%;
  right: 18%;
  height: 160px;
  transform: rotate(-52deg);
}

.crack-five {
  bottom: 8%;
  left: 18%;
  height: 150px;
  transform: rotate(36deg);
}

/* 黑雾 */
.black-fog {
  position: absolute;
  width: 130%;
  height: 150px;
  border-radius: 999px;
  background:
    radial-gradient(
      circle,
      rgba(0, 0, 0, 0.76),
      rgba(40, 5, 8, 0.34),
      transparent
    );
  filter: blur(26px);
  opacity: 0;
}

.fog-one {
  top: 18%;
  left: -24%;
  animation: fogMoveRight 4.8s ease-out forwards;
  animation-delay: 0.1s;
}

.fog-two {
  top: 46%;
  right: -30%;
  animation: fogMoveLeft 5s ease-out forwards;
  animation-delay: 0.35s;
}

.fog-three {
  bottom: 8%;
  left: -30%;
  animation: fogMoveRight 5.2s ease-out forwards;
  animation-delay: 0.6s;
}

/* 剧情文字 */
.story-text {
  position: absolute;
  top: 9%;
  left: 8%;
  z-index: 4;
  width: 660px;
}

.story-line {
  margin: 12px 0;
  color: #d8c0a4;
  font-size: 21px;
  letter-spacing: 2px;
  line-height: 1.55;
  opacity: 0;
  transform: translateX(-18px);
  filter: blur(4px);
  text-shadow:
    0 2px 12px rgba(0, 0, 0, 0.9),
    0 0 16px rgba(128, 27, 22, 0.28);
}

.story-line strong {
  color: #ffd36c;
  font-size: 30px;
}

.line-one {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 0.25s;
}

.line-two {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 0.75s;
}

.line-three {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 1.25s;
}

.line-four {
  color: #e4a28f;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 1.75s;
}

.line-five {
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 2.25s;
}

.line-six {
  color: #d9b36e;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 2.75s;
}

.line-seven {
  color: #d9b36e;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 3.25s;
}

.line-eight {
  color: #b8c6c8;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 3.75s;
}

.line-nine {
  color: #cbd6d6;
  animation: storyLineIn 0.42s ease forwards;
  animation-delay: 4.25s;
}

/* 倒下的角色剪影 */
.fallen-hero {
  position: absolute;
  right: 14%;
  bottom: 22%;
  z-index: 3;
  width: 260px;
  height: 160px;
  opacity: 0;
  transform: rotate(-8deg) translateY(24px);
  animation: heroFallIn 0.75s ease-out forwards;
  animation-delay: 1.15s;
}

.hero-cloak {
  position: absolute;
  left: 34px;
  top: 48px;
  width: 130px;
  height: 64px;
  border-radius: 52px 28px 28px 52px;
  background: linear-gradient(90deg, #1a222c, #0b0e13);
  border: 4px solid rgba(0, 0, 0, 0.85);
  box-shadow: 0 18px 28px rgba(0, 0, 0, 0.55);
}

.hero-sword {
  position: absolute;
  left: 142px;
  top: 80px;
  width: 128px;
  height: 8px;
  border-radius: 8px;
  background: #cfc7b3;
  border: 2px solid #080808;
  transform: rotate(-8deg);
  box-shadow: 0 0 12px rgba(255, 216, 160, 0.22);
}

/* 散落的牌 */
.fallen-card {
  position: absolute;
  width: 38px;
  height: 54px;
  border-radius: 6px;
  border: 2px solid rgba(225, 184, 111, 0.72);
  background:
    linear-gradient(180deg, #2c383d, #14191d);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.45);
  opacity: 0;
  animation: cardScatter 0.75s ease-out forwards;
  animation-delay: 1.65s;
}

.card-a {
  left: 22px;
  top: 16px;
  transform: rotate(-28deg);
}

.card-b {
  left: 152px;
  top: 8px;
  transform: rotate(18deg);
}

.card-c {
  left: 96px;
  top: 112px;
  transform: rotate(42deg);
}

/* 挑战失败标题 */
.death-title {
  position: absolute;
  left: 50%;
  bottom: 10%;
  z-index: 5;
  transform: translateX(-50%);
  opacity: 0;
  animation: deathTitleIn 0.62s ease-out forwards;
  animation-delay: 4.8s;
}

.death-title span {
  display: block;
  padding: 18px 44px;
  border: 2px solid rgba(186, 65, 49, 0.68);
  border-radius: 14px;
  color: #ffe1c0;
  background:
    linear-gradient(
      180deg,
      rgba(52, 15, 16, 0.92),
      rgba(10, 8, 10, 0.94)
    );
  box-shadow:
    0 0 38px rgba(197, 42, 34, 0.38),
    0 20px 46px rgba(0, 0, 0, 0.66),
    inset 0 0 24px rgba(255, 168, 99, 0.05);
  font-size: 46px;
  font-weight: 900;
  letter-spacing: 12px;
  text-shadow:
    0 0 20px rgba(244, 67, 50, 0.54),
    0 4px 0 rgba(0, 0, 0, 0.8);
}

/* 整体淡入淡出 */
.death-overlay-fade-enter-active,
.death-overlay-fade-leave-active {
  transition: opacity 0.85s ease;
}

.death-overlay-fade-enter-from,
.death-overlay-fade-leave-to {
  opacity: 0;
}

/* 动画定义 */
@keyframes suddenDark {
  from {
    background: rgba(3, 4, 6, 0);
  }

  to {
    background: rgba(3, 4, 6, 0.92);
  }
}

@keyframes darkPress {
  0% {
    opacity: 0;
    transform: scale(1.06);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes cracksIn {
  0% {
    opacity: 0;
    filter: blur(4px);
  }

  100% {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes fogMoveRight {
  0% {
    opacity: 0;
    transform: translateX(-140px);
  }

  35% {
    opacity: 0.85;
  }

  100% {
    opacity: 0.55;
    transform: translateX(120px);
  }
}

@keyframes fogMoveLeft {
  0% {
    opacity: 0;
    transform: translateX(140px);
  }

  35% {
    opacity: 0.78;
  }

  100% {
    opacity: 0.5;
    transform: translateX(-120px);
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

@keyframes heroFallIn {
  0% {
    opacity: 0;
    transform: rotate(10deg) translateY(-18px);
    filter: blur(3px);
  }

  60% {
    opacity: 1;
    transform: rotate(-10deg) translateY(8px);
    filter: blur(0);
  }

  100% {
    opacity: 0.78;
    transform: rotate(-8deg) translateY(0);
  }
}

@keyframes cardScatter {
  0% {
    opacity: 0;
    transform: translateY(-14px) rotate(0deg) scale(0.85);
  }

  100% {
    opacity: 0.86;
  }
}

@keyframes deathTitleIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.88) translateY(18px);
    filter: blur(4px);
  }

  70% {
    opacity: 1;
    transform: translateX(-50%) scale(1.04) translateY(0);
    filter: blur(0);
  }

  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

@keyframes screenShake {
  0% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-7px);
  }

  40% {
    transform: translateX(7px);
  }

  60% {
    transform: translateX(-4px);
  }

  80% {
    transform: translateX(4px);
  }

  100% {
    transform: translateX(0);
  }
}

@media (max-width: 900px) {
  .story-text {
    left: 6%;
    right: 6%;
    width: auto;
  }

  .story-line {
    font-size: 17px;
  }

  .fallen-hero {
    right: 4%;
    bottom: 16%;
    transform: scale(0.8);
  }

  .death-title span {
    font-size: 32px;
    letter-spacing: 6px;
  }
}
</style>