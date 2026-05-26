//它负责调用后端这几个接口：

//POST /api/level/generate   生成关卡
//POST /api/level/validate   校验关卡
//POST /api/level/solve      求解关卡，包括资源路径和BOSS战
import type {
  LevelDefinition,
  Position,
  Resource,
  PlanBossFightResponse,
  AgentRuntimeState,
  RuntimeEvent,
  AgentDecision,
} from '../types'

/**
 * 后端基础地址
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

/**
 * 通用后端响应格式
 */
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    detail?: unknown
  }
}

/**
 * 统一 POST 请求方法
 */
async function postApi<TReq, TRes>(
  path: string,
  body: TReq,
): Promise<TRes> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await res.json()) as ApiResponse<TRes>

  if (!payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? '后端请求失败')
  }

  return payload.data
}

/**
 * 迷宫生成算法类型
 */
export type MazeAlgorithm =
  | 'divide'
  | 'mst'
  | 'dfs'
  | 'bfs_branch_bound'

/**
 * 资源配置
 */
export interface ResourceConfig {
  /** 金币占可通行格比例 */
  coinRatio: number

  /** 陷阱占可通行格比例 */
  trapRatio: number

  /** 金币价值，默认 50 */
  coinValue: number

  /** 陷阱价值，默认 -30 */
  trapValue: number
}

/**
 * BOSS生成配置
 */
export interface BossGenerateConfig {
  /** BOSS数量 */
  bossCount: number

  /** 是否放在终点附近 */
  placeNearEnd: boolean

  /** 距离起点的最小距离 */
  minDistanceFromStart: number

  /** 可选，手动指定BOSS血量 */
  hpList?: number[]

  /** 可选，手动指定限定回合数 */
  minRounds?: number

  /** 可选，手动指定复活金币消耗 */
  coinConsumption?: number
}

/**
 * 生成关卡请求
 *
 * 对应 POST /api/level/generate
 */
export interface GenerateLevelRequest {
  /** 迷宫尺寸，推荐奇数，例如 15、21、31 */
  size: number

  /** 迷宫生成算法 */
  algorithm: MazeAlgorithm

  /** 随机种子，方便复现实验 */
  seed?: number

  /** 资源配置 */
  resourceConfig?: ResourceConfig

  /** BOSS配置 */
  bossConfig?: BossGenerateConfig

  /** 玩家技能，格式为 [伤害, 冷却] */
  playerSkills?: [number, number][]
}

/**
 * 生成关卡响应
 */
export interface GenerateLevelResponse {
  /** 完整关卡JSON */
  level: LevelDefinition

  /** 后端耗时 */
  elapsedMs: number
}

/**
 * 校验关卡请求
 *
 * 对应 POST /api/level/validate
 */
export interface ValidateLevelRequest {
  level: LevelDefinition
}

/**
 * 校验关卡响应
 */
export interface ValidateLevelResponse {
  /** 关卡是否合法 */
  valid: boolean

  /** 是否整体连通 */
  isConnected: boolean

  /** 是否存在唯一通路 */
  hasUniquePath: boolean

  /** 孤立格子 */
  isolatedCells: Position[]

  /** 校验说明 */
  message?: string
}

/**
 * 求解任务类型
 */
export type SolveTask = 'resource' | 'boss' | 'all'

/**
 * 资源路径求解结果
 */
export interface ResourceSolveResult {
  /** 最大资源价值 */
  maxValue: number

  /** 最优路径 */
  path: Position[]

  /** 收集到的资源 */
  collectedResources: Resource[]
}

/**
 * 求解关卡请求
 *
 * 对应 POST /api/level/solve
 */
export interface SolveLevelRequest {
  level: LevelDefinition

  /** resource: 只求资源路径；boss: 只求BOSS；all: 全部求解 */
  task: SolveTask
}

/**
 * 求解关卡响应
 */
export interface SolveLevelResponse {
  /** 资源路径结果 */
  resource?: ResourceSolveResult

  /** BOSS战结果 */
  boss?: PlanBossFightResponse

  /** Agent决策序列 */
  decisions: AgentDecision[]

  /** 最终运行状态 */
  finalState: AgentRuntimeState

  /** 运行事件，用于前端播放动画 */
  events: RuntimeEvent[]

  /** 是否存在可行方案 */
  feasible: boolean

  /** 后端耗时 */
  elapsedMs: number
}

/**
 * 调用后端：生成关卡
 */
export function generateLevel(
  request: GenerateLevelRequest,
): Promise<GenerateLevelResponse> {
  return postApi<GenerateLevelRequest, GenerateLevelResponse>(
    '/api/level/generate',
    request,
  )
}

/**
 * 调用后端：校验关卡
 */
export function validateLevel(
  request: ValidateLevelRequest,
): Promise<ValidateLevelResponse> {
  return postApi<ValidateLevelRequest, ValidateLevelResponse>(
    '/api/level/validate',
    request,
  )
}

/**
 * 调用后端：求解关卡
 */
export function solveLevel(
  request: SolveLevelRequest,
): Promise<SolveLevelResponse> {
  return postApi<SolveLevelRequest, SolveLevelResponse>(
    '/api/level/solve',
    request,
  )
}
