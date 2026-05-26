/**
 * Map组核心类型定义
 *
 * 本文件负责：
 * 1. 完整关卡 LevelDefinition
 * 2. 地图、资源、BOSS、技能等基础数据结构
 * 3. Agent运行状态
 * 4. 运行事件 RuntimeEvent
 * 5. BOSS战求解结果
 *
 * 注意：
 * 本文件只定义 TypeScript 类型，
 * 不包含任何业务逻辑。
 */

/* =========================
   地图符号
========================= */

/**
 * 迷宫格子字符
 *
 * #：墙壁
 * 空格：普通通路
 * S：起点
 * E：终点
 * B：BOSS关卡
 * G / C：金币
 * T：陷阱
 */
export type MazeSymbol =
  | '#'
  | ' '
  | 'S'
  | 'E'
  | 'B'
  | 'G'
  | 'C'
  | 'T'

/* =========================
   坐标
========================= */

/**
 * 二维坐标
 *
 * x 表示列坐标，
 * y 表示行坐标。
 */
export interface Position {
  x: number
  y: number
}

/* =========================
   资源
========================= */

/**
 * 地图资源
 *
 * 金币和陷阱都属于资源。
 * 金币默认价值为 +50，
 * 陷阱默认价值为 -30。
 */
export interface Resource {
  /** 资源唯一编号 */
  id: string

  /** 资源所在位置 */
  position: Position

  /** 资源类型 */
  type: 'coin' | 'trap'

  /** 资源价值 */
  value: number
}

/* =========================
   技能
========================= */

/**
 * 玩家技能
 *
 * 对应课程输入：
 * PlayerSkills = [[damage, cooldown]]
 *
 * 例如：
 * [5, 0] 表示普通攻击，伤害 5，无冷却；
 * [10, 2] 表示大招，伤害 10，冷却 2 回合。
 */
export interface Skill {
  /** 技能ID */
  id: string

  /** 技能名称 */
  name: string

  /** 技能伤害 */
  damage: number

  /** 技能冷却回合 */
  cooldown: number
}

/* =========================
   BOSS
========================= */

/**
 * BOSS配置
 *
 * 注意：
 * 地图中只有一个 B 格子，
 * 但是 B 格子代表一组 BOSS。
 * BOSS 按照数组顺序依次挑战。
 */
export interface BossConfig {
  /** BOSS编号 */
  id: string

  /** BOSS名称 */
  name: string

  /** BOSS血量 */
  hp: number
}

/* =========================
   完整关卡
========================= */

/**
 * 完整关卡定义
 *
 * 这是整个 Map 组最核心的数据结构。
 *
 * 用于：
 * 1. 前端导出 JSON
 * 2. 后端生成地图
 * 3. Agent 运行
 * 4. 阶段测试
 * 5. 交叉测试
 */
export interface LevelDefinition {
  /**
   * 迷宫矩阵
   *
   * 每个格子都是 MazeSymbol。
   */
  maze: MazeSymbol[][]

  /**
   * BOSS群血量
   *
   * B[i] 表示第 i 个 BOSS 的血量。
   * 虽然地图中只有一个 B 格子，
   * 但进入该格子后需要按顺序挑战多个 BOSS。
   */
  B: number[]

  /**
   * 玩家技能数组
   *
   * PlayerSkills[i] = [伤害, 冷却]
   *
   * 例如：
   * [5, 0] 表示普通攻击；
   * [10, 2] 表示大招。
   */
  PlayerSkills: [number, number][]

  /**
   * 限定回合数
   *
   * AI 玩家必须在 minRouds 回合内击败全部 BOSS。
   *
   * 注意：
   * 课程输入字段拼写就是 minRouds，
   * 不是 minRounds。
   * 前端导入、导出和接口传输时都必须保持这个拼写。
   */
  minRouds: number

  /**
   * 复活金币消耗
   *
   * 如果 AI 玩家没有在限定回合数内击败全部 BOSS，
   * 则死亡并在 BOSS 格原地复活，
   * 同时扣除 CoinConsumption 个金币。
   *
   * 复活后 BOSS 战从第一个 BOSS 重新开始。
   */
  CoinConsumption: number
}

/* =========================
   运行事件
========================= */

/**
 * 运行事件类型
 *
 * 前端根据事件播放动画。
 */
export type RuntimeEventType =
  | 'move'
  | 'collect_coin'
  | 'trigger_trap'
  | 'enter_boss'
  | 'use_skill'
  | 'boss_defeated'
  | 'boss_timeout'
  | 'boss_retry'
  | 'level_finished'
  | 'level_failed'

/**
 * 运行事件
 *
 * 用于描述 Agent 或求解器运行过程中的一步事件。
 */
export interface RuntimeEvent {
  /** 事件类型 */
  type: RuntimeEventType

  /** 事件描述文本 */
  message: string

  /** 事件发生的位置 */
  position?: Position

  /** 金币变化，例如拾取金币为正数，复活扣金币为负数 */
  coinDelta?: number

  /** 血量变化，例如攻击 BOSS 时为负数 */
  hpDelta?: number

  /** 当前回合数，主要用于 BOSS 战 */
  round?: number
}

/* =========================
   Agent运行阶段
========================= */

/**
 * Agent 当前运行阶段
 *
 * map：地图探索阶段
 * boss：BOSS 战阶段
 * finished：关卡完成
 * failed：关卡失败
 */
export type AgentPhase =
  | 'map'
  | 'boss'
  | 'finished'
  | 'failed'

/* =========================
   Agent决策
========================= */

/**
 * 地图阶段移动动作
 */
export type MoveAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'stay'

/**
 * 地图阶段 Agent 决策
 */
export interface MapAgentDecision {
  /** 当前处于地图阶段 */
  phase: 'map'

  /** 移动方向 */
  action: MoveAction

  /** 移动目标位置 */
  target?: Position

  /** 决策原因 */
  reason: string
}

/**
 * BOSS 阶段 Agent 决策
 */
export interface BossAgentDecision {
  /** 当前处于 BOSS 战阶段 */
  phase: 'boss'

  /** 使用第几个技能 */
  skillIndex: number

  /** 决策原因 */
  reason: string
}

/**
 * Agent 决策
 *
 * 地图阶段返回移动方向，
 * BOSS 阶段返回技能编号。
 */
export type AgentDecision =
  | MapAgentDecision
  | BossAgentDecision

/* =========================
   玩家运行状态
========================= */

/**
 * 玩家运行状态
 */
export interface RuntimePlayerState {
  /** 玩家当前位置 */
  position: Position

  /** 当前金币数量 */
  coins: number

  /** 已移动步数 */
  steps: number

  /** 已收集资源 ID */
  collected: string[]

  /** 已触发陷阱 ID */
  triggeredTraps: string[]

  /** 是否已经击败 BOSS */
  clearedBoss: boolean

  /** 已访问路径 */
  visited: Position[]
}

/* =========================
   BOSS运行状态
========================= */

/**
 * BOSS 战运行状态
 *
 * 该结构用于 Agent 运行和前端可视化。
 */
export interface RuntimeBossState {
  /**
   * 当前正在挑战第几个 BOSS
   */
  bossIndex: number

  /**
   * 当前 BOSS 剩余血量
   */
  currentHp: number

  /**
   * 每个技能的剩余冷却回合
   */
  skillCooldowns: number[]

  /**
   * 本轮 BOSS 战已经使用的回合数
   */
  usedRounds: number

  /**
   * 本轮 BOSS 战剩余回合数
   */
  remainingRounds: number

  /**
   * 本轮已经击败的 BOSS 下标
   */
  defeatedBosses: number[]

  /**
   * 当前是第几次挑战 BOSS 战
   *
   * 第一次进入 BOSS 格时 attempt = 1。
   * 每次超时并复活后 attempt 增加。
   */
  attempt: number

  /**
   * 已失败次数
   */
  failedAttempts: number
}

/* =========================
   Agent运行时状态
========================= */

/**
 * Agent 完整运行状态
 */
export interface AgentRuntimeState {
  /** 会话 ID */
  sessionId: string

  /** 当前阶段 */
  phase: AgentPhase

  /** 玩家状态 */
  player: RuntimePlayerState

  /** BOSS 状态，只有进入 BOSS 阶段时才存在 */
  boss?: RuntimeBossState

  /**
   * 已消耗格子
   *
   * 金币、陷阱、BOSS 被触发后，
   * 前端渲染时应显示为普通地面，
   * 避免重复触发。
   */
  consumedCells: Position[]

  /**
   * limited_view_3x3 模式下的可见区域
   */
  visibleMaze?: MazeSymbol[][]

  /** 状态提示信息 */
  message?: string
}

/* =========================
   BOSS技能动作
========================= */

/**
 * 技能释放动作
 *
 * 用于描述 BOSS 战最优技能序列中的每一步。
 */
export interface SkillAction {
  /** 第几回合，从 1 开始 */
  turn: number

  /** 当前攻击的 BOSS ID */
  bossId: string

  /** 当前使用的技能 ID */
  skillId: string

  /** 本回合造成的伤害 */
  damage: number

  /** 本次攻击后当前 BOSS 剩余血量 */
  remainingHp: number
}

/* =========================
   BOSS战求解结果
========================= */

/**
 * BOSS 战最优求解结果
 *
 * 后端通过 BFS、分支限界或动态规划求解后返回。
 */
export interface PlanBossFightResponse {
  /** 击败全部 BOSS 所需的最少回合数 */
  minTurns: number

  /** 最优技能释放序列 */
  optimalSequence: SkillAction[]

  /** 推荐限定回合数 */
  turnLimit: number

  /** 推荐复活金币数 */
  reviveCoinCost: number

  /** 当前配置下是否存在可行解 */
  feasible: boolean
}