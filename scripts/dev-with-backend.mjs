import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

const BACKEND_PORT = Number(process.env.PORT ?? 8000)
const BACKEND_HOST = '127.0.0.1'
const children = []

function isWindows() {
  return process.platform === 'win32'
}

function pnpmCommand() {
  return isWindows() ? 'pnpm.cmd' : 'pnpm'
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })

    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })

    socket.once('error', () => {
      resolve(false)
    })

    socket.setTimeout(1000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function run(name, args) {
  const child = spawn(pnpmCommand(), args, {
    stdio: 'inherit',
    shell: isWindows(),
    env: process.env,
  })

  children.push(child)

  child.once('exit', (code, signal) => {
    if (signal) {
      return
    }

    if (code && !shuttingDown) {
      console.error(`${name} exited with code ${code}`)
      shutdown(code)
    }
  })

  return child
}

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => process.exit(code), 100)
}

process.once('SIGINT', () => shutdown(0))
process.once('SIGTERM', () => shutdown(0))

if (await isPortOpen(BACKEND_HOST, BACKEND_PORT)) {
  console.log(`Backend already running at http://${BACKEND_HOST}:${BACKEND_PORT}`)
} else {
  run('backend', ['backend'])
}

run('vite', ['dev'])