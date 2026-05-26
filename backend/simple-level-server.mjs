import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8000)
const INPUT_FILE = process.env.LEVEL_INPUT_FILE
  ? resolve(process.env.LEVEL_INPUT_FILE)
  : resolve(__dirname, 'input-level.json')

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

async function readRequestJson(req) {
  let body = ''

  for await (const chunk of req) {
    body += chunk
  }

  if (!body.trim()) {
    return {}
  }

  return JSON.parse(body)
}

async function readDefaultLevel() {
  const raw = await readFile(INPUT_FILE, 'utf8')
  return JSON.parse(raw)
}

function isLevelInput(value) {
  return Boolean(
    value
    && Array.isArray(value.maze)
    && Array.isArray(value.B)
    && Array.isArray(value.PlayerSkills)
    && Number.isFinite(Number(value.minRouds))
    && Number.isFinite(Number(value.CoinConsumption)),
  )
}

function normalizeLevel(value) {
  if (!isLevelInput(value)) {
    throw new Error('输入必须包含 maze、B、PlayerSkills、minRouds、CoinConsumption')
  }

  return {
    maze: value.maze,
    B: value.B.map((hp) => Number(hp)),
    PlayerSkills: value.PlayerSkills.map((skill) => [
      Number(skill[0]),
      Number(skill[1]),
    ]),
    minRouds: Number(value.minRouds),
    CoinConsumption: Number(value.CoinConsumption),
  }
}

async function buildLevelFromRequest(body) {
  const defaultLevel = normalizeLevel(await readDefaultLevel())

  if (isLevelInput(body)) {
    return normalizeLevel(body)
  }

  const bossConfig = body?.bossConfig ?? {}

  return normalizeLevel({
    ...defaultLevel,
    B: bossConfig.hpList ?? defaultLevel.B,
    PlayerSkills: body?.playerSkills ?? defaultLevel.PlayerSkills,
    minRouds: bossConfig.minRounds ?? defaultLevel.minRouds,
    CoinConsumption: bossConfig.coinConsumption ?? defaultLevel.CoinConsumption,
  })
}

async function handleGenerate(req, res) {
  const startedAt = performance.now()
  const body = await readRequestJson(req)
  const level = await buildLevelFromRequest(body)

  sendJson(res, 200, {
    ok: true,
    data: {
      level,
      elapsedMs: Math.round(performance.now() - startedAt),
    },
  })
}

function createErrorResponse(error) {
  return {
    ok: false,
    error: {
      code: 'BAD_REQUEST',
      message: error instanceof Error ? error.message : '请求失败',
    },
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    if (req.method === 'GET' && req.url === '/api/level/input') {
      sendJson(res, 200, {
        ok: true,
        data: {
          level: normalizeLevel(await readDefaultLevel()),
        },
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/level/generate') {
      await handleGenerate(req, res)
      return
    }

    sendJson(res, 404, {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '接口不存在',
      },
    })
  } catch (error) {
    sendJson(res, 400, createErrorResponse(error))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Simple level backend: http://127.0.0.1:${PORT}`)
  console.log(`Input file: ${INPUT_FILE}`)
})
