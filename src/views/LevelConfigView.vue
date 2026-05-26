<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { GenerateLevelRequest, MazeAlgorithm } from '../api/level'

type AppPage = 'home' | 'config' | 'maze' | 'boss'

type LevelConfigForm = {
  size: number
  algorithm: MazeAlgorithm
  seed: number | null
  coinRatio: number
  trapRatio: number
  coinValue: number
  trapValue: number
  difficulty: 'easy' | 'normal' | 'hard' | 'expert'
  bossCount: number
  skillCount: number
  roundSlack: number
}

const props = defineProps<{
  modelValue: GenerateLevelRequest
}>()

const emit = defineEmits<{
  'update:modelValue': [GenerateLevelRequest]
  navigate: [AppPage]
}>()

const form = reactive<LevelConfigForm>({
  size: props.modelValue.size,
  algorithm: props.modelValue.algorithm,
  seed: props.modelValue.seed ?? null,
  coinRatio: props.modelValue.resourceConfig?.coinRatio ?? 0.3,
  trapRatio: props.modelValue.resourceConfig?.trapRatio ?? 0.15,
  coinValue: props.modelValue.resourceConfig?.coinValue ?? 50,
  trapValue: props.modelValue.resourceConfig?.trapValue ?? -30,
  difficulty: props.modelValue.resourceConfig?.difficulty ?? 'normal',
  bossCount: props.modelValue.bossConfig?.bossCount ?? 3,
  skillCount: props.modelValue.bossConfig?.skillCount ?? 2,
  roundSlack: props.modelValue.bossConfig?.roundSlack ?? 2,
})

const normalizedSize = computed(() => {
  const value = Math.max(3, Math.round(Number(form.size) || 3))
  return value % 2 === 0 ? value + 1 : value
})

const validationMessages = computed(() => {
  const messages: string[] = []

  if (form.size < 3) messages.push('迷宫尺寸至少为 3。')
  if (form.bossCount < 1) messages.push('Boss 数量至少为 1。')
  if (form.skillCount < 1) messages.push('技能数量至少为 1。')
  if (form.roundSlack < 0) messages.push('额外回合冗余不能小于 0。')
  if (form.coinRatio < 0 || form.coinRatio > 1) messages.push('金币比例需要在 0 到 1 之间。')
  if (form.trapRatio < 0 || form.trapRatio > 1) messages.push('陷阱比例需要在 0 到 1 之间。')

  return messages
})

const canApply = computed(() => validationMessages.value.length === 0)

const requestPreview = computed(() => buildRequest())

function optionalInteger(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  return Math.max(0, Math.round(Number(value)))
}

function buildRequest(): GenerateLevelRequest {
  return {
    size: normalizedSize.value,
    algorithm: form.algorithm,
    seed: optionalInteger(form.seed),
    resourceConfig: {
      coinRatio: clamp01(form.coinRatio),
      trapRatio: clamp01(form.trapRatio),
      coinValue: Math.round(Number(form.coinValue) || 0),
      trapValue: Math.round(Number(form.trapValue) || 0),
      difficulty: form.difficulty,
    },
    bossConfig: {
      bossCount: Math.max(1, Math.round(Number(form.bossCount) || 1)),
      skillCount: Math.max(1, Math.round(Number(form.skillCount) || 1)),
      roundSlack: Math.max(0, Math.round(Number(form.roundSlack) || 0)),
    },
  }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function applyConfig(target: AppPage = 'maze') {
  if (!canApply.value) return
  emit('update:modelValue', buildRequest())
  emit('navigate', target)
}
</script>

<template>
  <section class="config-view">
    <aside class="intro-panel">
      <p class="eyebrow">Level Setup</p>
      <h1>配置关卡</h1>
      <p>先把迷宫、资源、Boss 和技能参数配置好，再进入迷宫或 Boss 战。这里生成的配置会作为后端 `/api/level/generate` 的请求体。</p>

      <div class="summary-card">
        <span>当前请求</span>
        <strong>{{ normalizedSize }} × {{ normalizedSize }} / {{ form.algorithm }}</strong>
        <small>{{ form.bossCount }} 个 Boss，生成 {{ form.skillCount }} 个技能，冗余 {{ form.roundSlack }} 回合</small>
      </div>
    </aside>

    <div class="config-content">
      <form class="config-grid" @submit.prevent="applyConfig('maze')">
        <fieldset>
          <legend>迷宫配置</legend>
          <label>
            <span>迷宫尺寸</span>
            <input v-model.number="form.size" type="number" min="3" step="2">
            <small>会自动修正为奇数：{{ normalizedSize }}</small>
          </label>

          <label>
            <span>生成算法</span>
            <select v-model="form.algorithm">
              <option value="dfs">DFS</option>
              <option value="divide">递归分割</option>
              <option value="mst">最小生成树</option>
              <option value="bfs_branch_bound">BFS 分支限界</option>
              <option value="rl">强化学习 RL</option>
            </select>
          </label>

          <label>
            <span>随机种子</span>
            <input v-model.number="form.seed" type="number" placeholder="可留空">
          </label>
        </fieldset>

        <fieldset>
          <legend>资源配置</legend>
          <label>
            <span>金币比例</span>
            <input v-model.number="form.coinRatio" type="number" min="0" max="1" step="0.01">
          </label>

          <label>
            <span>陷阱比例</span>
            <input v-model.number="form.trapRatio" type="number" min="0" max="1" step="0.01">
          </label>

          <label>
            <span>金币价值</span>
            <input v-model.number="form.coinValue" type="number">
          </label>

          <label>
            <span>陷阱价值</span>
            <input v-model.number="form.trapValue" type="number">
          </label>

          <label>
            <span>难度</span>
            <select v-model="form.difficulty">
              <option value="easy">简单</option>
              <option value="normal">普通</option>
              <option value="hard">困难</option>
              <option value="expert">专家</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Boss 配置</legend>
          <label>
            <span>Boss 数量</span>
            <input v-model.number="form.bossCount" type="number" min="1">
          </label>

          <label>
            <span>技能数量</span>
            <input v-model.number="form.skillCount" type="number" min="1">
            <small>对应后端 bossConfig.skillCount，默认 2。</small>
          </label>

          <label>
            <span>额外回合冗余</span>
            <input v-model.number="form.roundSlack" type="number" min="0">
            <small>对应后端 bossConfig.roundSlack，默认 2。</small>
          </label>
        </fieldset>

        <div v-if="validationMessages.length" class="validation-box">
          <strong>需要修正：</strong>
          <ul>
            <li v-for="message in validationMessages" :key="message">{{ message }}</li>
          </ul>
        </div>

        <div class="action-bar">
          <button type="button" class="ghost" @click="$emit('navigate', 'home')">返回目录</button>
          <button type="button" :disabled="!canApply" @click="applyConfig('boss')">保存并进入 Boss 战</button>
          <button type="submit" :disabled="!canApply">保存并进入迷宫</button>
        </div>
      </form>

      <aside class="preview-panel">
        <div class="preview-header">
          <span>Request JSON</span>
          <strong>/api/level/generate</strong>
        </div>
        <pre>{{ JSON.stringify(requestPreview, null, 2) }}</pre>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.config-view {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.6fr);
  min-height: calc(100vh - 72px);
  color: #f8fafc;
  background:
    radial-gradient(circle at 14% 18%, rgba(245, 158, 11, 0.28), transparent 32%),
    radial-gradient(circle at 82% 12%, rgba(59, 130, 246, 0.18), transparent 28%),
    linear-gradient(135deg, #111827 0%, #1e1b4b 52%, #0f172a 100%);
}

.intro-panel {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: clamp(28px, 5vw, 70px);
  border-right: 1px solid rgba(148, 163, 184, 0.16);
}

.eyebrow {
  margin: 0;
  color: #fbbf24;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.intro-panel h1 {
  margin: 0;
  font-size: clamp(3rem, 8vw, 6rem);
  line-height: 0.95;
}

.intro-panel p {
  margin: 0;
  color: rgba(226, 232, 240, 0.76);
  line-height: 1.85;
}

.summary-card,
.preview-panel,
fieldset,
.validation-box {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 26px;
  background: rgba(15, 23, 42, 0.58);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
}

.summary-card {
  display: grid;
  gap: 8px;
  padding: 22px;
}

.summary-card span,
.summary-card small,
.preview-header span,
label small {
  color: rgba(226, 232, 240, 0.62);
}

.summary-card strong {
  font-size: 1.45rem;
}

.config-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
  gap: 22px;
  padding: clamp(24px, 4vw, 46px);
}

.config-grid {
  display: grid;
  gap: 18px;
}

fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 22px;
}

legend {
  padding: 0 8px;
  color: #fbbf24;
  font-weight: 900;
}

label {
  display: grid;
  gap: 8px;
}

label.wide {
  grid-column: 1 / -1;
}

label span {
  color: rgba(248, 250, 252, 0.88);
  font-weight: 800;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 16px;
  padding: 12px 14px;
  color: #f8fafc;
  background: rgba(2, 6, 23, 0.42);
  outline: none;
}

textarea {
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: rgba(251, 191, 36, 0.68);
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.14);
}

.validation-box {
  padding: 18px 22px;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.38);
}

.validation-box ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

button {
  cursor: pointer;
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 999px;
  padding: 12px 20px;
  color: #fff7ed;
  background: rgba(180, 83, 9, 0.82);
  font-weight: 900;
}

button.ghost {
  border-color: rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.64);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.preview-panel {
  position: sticky;
  top: 96px;
  display: grid;
  align-self: start;
  overflow: hidden;
}

.preview-header {
  display: grid;
  gap: 4px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

pre {
  overflow: auto;
  max-height: calc(100vh - 190px);
  margin: 0;
  padding: 20px;
  color: #d9f99d;
  font-size: 0.82rem;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .config-view,
  .config-content {
    grid-template-columns: 1fr;
  }

  .intro-panel {
    border-right: 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  }

  .preview-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  fieldset {
    grid-template-columns: 1fr;
  }
}
</style>
