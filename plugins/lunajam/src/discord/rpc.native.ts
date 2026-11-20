import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import * as http from 'node:http'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type { RpcStatus, RpcTestOpts, WireActivity } from './types'

const OP_HANDSHAKE = 0
const OP_FRAME = 1
const OP_CLOSE = 2
const OP_PING = 3
const OP_PONG = 4
const RPC_PID = 1000

interface RpcConnection {
  clientId: string
  transport: string
  isOpen(): boolean
  request(cmd: string, args: unknown): Promise<unknown>
  close(): void
}

let activeConn: RpcConnection | null = null
let connectPromise: Promise<RpcConnection | null> | null = null
let connectClientId = ''

function encodeIpcFrame(op: number, data: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(data), 'utf8')
  const frame = Buffer.allocUnsafe(8 + payload.length)
  frame.writeInt32LE(op, 0)
  frame.writeInt32LE(payload.length, 4)
  payload.copy(frame, 8)
  return frame
}

function candidateSockets(): string[] {
  if (process.platform === 'win32') {
    const out: string[] = []
    for (let i = 0; i < 10; i++) out.push(`\\\\.\\pipe\\discord-ipc-${i}`)
    return out
  }

  const bases = new Set<string>()
  const addBase = (dir: string | undefined) => {
    if (!dir) return
    const clean = dir.trim()
    if (!clean) return
    bases.add(clean)
    if (path.basename(path.dirname(clean)) === 'app') {
      bases.add(path.resolve(clean, '../..'))
    }
  }

  addBase(process.env.XDG_RUNTIME_DIR)
  addBase(process.env.TMPDIR)
  addBase(process.env.TMP)
  addBase(process.env.TEMP)
  addBase(os.tmpdir())
  addBase('/tmp')

  const subdirs = [
    '',
    'app/com.discordapp.Discord',
    'app/dev.vencord.Vesktop',
    'app/org.equicord.equibop',
    'snap.discord',
  ]

  const out: string[] = []
  for (const base of bases) {
    for (const sub of subdirs) {
      const dir = sub ? path.join(base, sub) : base
      for (let i = 0; i < 10; i++) {
        out.push(path.join(dir, `discord-ipc-${i}`))
      }
    }
  }
  return out
}

function connectIpcSocket(socketPath: string, clientId: string): Promise<RpcConnection> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let settled = false
    let open = true
    let rx = Buffer.alloc(0)
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

    const cleanup = () => {
      open = false
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new Error('IPC socket closed'))
      }
      pending.clear()
      if (activeConn && activeConn.transport === `ipc:${socketPath}`) activeConn = null
    }

    const readyTimer = setTimeout(() => {
      if (!settled) {
        settled = true
        socket.destroy()
        reject(new Error('IPC handshake timeout'))
      }
    }, 600)

    const handleFrame = (op: number, body: Buffer) => {
      if (op === OP_PING) {
        try {
          socket.write(encodeIpcFrame(OP_PONG, JSON.parse(body.toString('utf8'))))
        } catch {
          return
        }
        return
      }
      if (op === OP_CLOSE) {
        socket.end()
        return
      }
      if (op !== OP_FRAME) return

      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(body.toString('utf8')) as Record<string, unknown>
      } catch {
        return
      }

      if (!settled && msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
        settled = true
        clearTimeout(readyTimer)
        resolve({
          clientId,
          transport: `ipc:${socketPath}`,
          isOpen: () => open && !socket.destroyed,
          request: (cmd, args) => {
            if (!open || socket.destroyed) return Promise.reject(new Error('IPC socket closed'))
            const nonce = randomUUID()
            return new Promise((res, rej) => {
              const timer = setTimeout(() => {
                pending.delete(nonce)
                rej(new Error(`IPC timeout for ${cmd}`))
              }, 2000)
              pending.set(nonce, { resolve: res, reject: rej, timer })
              socket.write(encodeIpcFrame(OP_FRAME, { cmd, args, nonce }))
            })
          },
          close: () => {
            open = false
            try {
              socket.end(encodeIpcFrame(OP_CLOSE, {}))
            } catch {
              return
            }
            socket.destroy()
          },
        })
        return
      }

      const nonce = typeof msg.nonce === 'string' ? msg.nonce : null
      if (nonce && pending.has(nonce)) {
        const entry = pending.get(nonce)!
        pending.delete(nonce)
        clearTimeout(entry.timer)
        if (msg.evt === 'ERROR') {
          const data = msg.data as { message?: string } | undefined
          entry.reject(new Error(data?.message ?? 'IPC RPC error'))
        } else {
          entry.resolve(msg.data)
        }
      }
    }

    socket.on('connect', () => {
      socket.write(encodeIpcFrame(OP_HANDSHAKE, { v: 1, client_id: clientId }))
    })

    socket.on('data', (chunk) => {
      rx = Buffer.concat([rx, chunk])
      while (rx.length >= 8) {
        const op = rx.readInt32LE(0)
        const len = rx.readInt32LE(4)
        if (len < 0 || len > 1048576) {
          socket.destroy()
          return
        }
        if (rx.length < 8 + len) break
        const body = rx.subarray(8, 8 + len)
        rx = rx.subarray(8 + len)
        handleFrame(op, body)
      }
    })

    socket.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(readyTimer)
        reject(err)
      }
      cleanup()
    })

    socket.on('close', () => {
      if (!settled) {
        settled = true
        clearTimeout(readyTimer)
        reject(new Error('IPC socket closed during handshake'))
      }
      cleanup()
    })
  })
}

function encodeWsTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = randomBytes(4)
  let headerLen = 2
  if (payload.length >= 126 && payload.length < 65536) headerLen = 4
  else if (payload.length >= 65536) headerLen = 10

  const frame = Buffer.allocUnsafe(headerLen + 4 + payload.length)
  frame[0] = 0x81
  if (headerLen === 2) {
    frame[1] = 0x80 | payload.length
  } else if (headerLen === 4) {
    frame[1] = 0x80 | 126
    frame.writeUInt16BE(payload.length, 2)
  } else {
    frame[1] = 0x80 | 127
    frame.writeUInt32BE(0, 2)
    frame.writeUInt32BE(payload.length, 6)
  }
  mask.copy(frame, headerLen)
  for (let i = 0; i < payload.length; i++) {
    frame[headerLen + 4 + i] = payload[i]! ^ mask[i % 4]!
  }
  return frame
}

function encodeWsControlFrame(opcode: number, payload: Buffer): Buffer {
  const mask = randomBytes(4)
  const trimmed = payload.subarray(0, 125)
  const frame = Buffer.allocUnsafe(2 + 4 + trimmed.length)
  frame[0] = 0x80 | (opcode & 0x0f)
  frame[1] = 0x80 | trimmed.length
  mask.copy(frame, 2)
  for (let i = 0; i < trimmed.length; i++) {
    frame[6 + i] = trimmed[i]! ^ mask[i % 4]!
  }
  return frame
}

function connectWsPort(port: number, clientId: string): Promise<RpcConnection> {
  return new Promise((resolve, reject) => {
    let settled = false
    let socketRef: net.Socket | null = null
    let open = false
    let rx = Buffer.alloc(0)
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

    const cleanup = () => {
      open = false
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new Error('WebSocket closed'))
      }
      pending.clear()
      if (activeConn && activeConn.transport === `ws:${port}`) activeConn = null
    }

    const req = http.request({
      host: '127.0.0.1',
      port,
      method: 'GET',
      path: `/?v=1&client_id=${encodeURIComponent(clientId)}&encoding=json`,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        Origin: 'https://discord.com',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    })

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        req.destroy()
        socketRef?.destroy()
        reject(new Error('WebSocket handshake timeout'))
      }
    }, 600)

    const processWsBuffer = () => {
      while (rx.length >= 2) {
        const b0 = rx[0]!
        const b1 = rx[1]!
        const opcode = b0 & 0x0f
        const masked = (b1 & 0x80) !== 0
        let len = b1 & 0x7f
        let offset = 2

        if (len === 126) {
          if (rx.length < 4) return
          len = rx.readUInt16BE(2)
          offset = 4
        } else if (len === 127) {
          if (rx.length < 10) return
          len = rx.readUInt32BE(6)
          offset = 10
        }

        const maskLen = masked ? 4 : 0
        if (rx.length < offset + maskLen + len) return

        const maskKey = masked ? rx.subarray(offset, offset + 4) : null
        const payload = Buffer.from(rx.subarray(offset + maskLen, offset + maskLen + len))
        rx = rx.subarray(offset + maskLen + len)

        if (maskKey) {
          for (let i = 0; i < payload.length; i++) payload[i] = payload[i]! ^ maskKey[i % 4]!
        }

        if (opcode === 0x8) {
          socketRef?.destroy()
          return
        }
        if (opcode === 0x9) {
          socketRef?.write(encodeWsControlFrame(0x0a, payload))
          continue
        }
        if (opcode !== 0x1 && opcode !== 0x0) continue

        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(payload.toString('utf8')) as Record<string, unknown>
        } catch {
          continue
        }

        if (!settled && msg.cmd === 'DISPATCH' && msg.evt === 'READY') {
          settled = true
          clearTimeout(timeout)
          resolve({
            clientId,
            transport: `ws:${port}`,
            isOpen: () => open && socketRef !== null && !socketRef.destroyed,
            request: (cmd, args) => {
              if (!open || !socketRef || socketRef.destroyed) return Promise.reject(new Error('WebSocket closed'))
              const nonce = randomUUID()
              return new Promise((res, rej) => {
                const timer = setTimeout(() => {
                  pending.delete(nonce)
                  rej(new Error(`WS RPC timeout for ${cmd}`))
                }, 2000)
                pending.set(nonce, { resolve: res, reject: rej, timer })
                socketRef!.write(encodeWsTextFrame(JSON.stringify({ cmd, args, nonce })))
              })
            },
            close: () => {
              open = false
              try {
                socketRef?.write(encodeWsControlFrame(0x08, Buffer.alloc(0)))
              } catch {
                return
              }
              socketRef?.destroy()
            },
          })
          continue
        }

        const nonce = typeof msg.nonce === 'string' ? msg.nonce : null
        if (nonce && pending.has(nonce)) {
          const entry = pending.get(nonce)!
          pending.delete(nonce)
          clearTimeout(entry.timer)
          if (msg.evt === 'ERROR') {
            const data = msg.data as { message?: string } | undefined
            entry.reject(new Error(data?.message ?? 'WS RPC error'))
          } else {
            entry.resolve(msg.data)
          }
        }
      }
    }

    req.on('upgrade', (_, socket, head) => {
      socketRef = socket
      open = true
      if (head.length > 0) rx = Buffer.concat([rx, head])
      socket.on('data', (chunk) => {
        rx = Buffer.concat([rx, chunk])
        processWsBuffer()
      })
      socket.on('error', () => cleanup())
      socket.on('close', () => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(new Error('WebSocket closed during handshake'))
        }
        cleanup()
      })
      processWsBuffer()
    })

    req.on('response', () => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        req.destroy()
        reject(new Error('Rejected WebSocket upgrade'))
      }
    })

    req.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(err)
      }
      cleanup()
    })

    req.end()
  })
}

async function openConnection(clientId: string, opts?: RpcTestOpts): Promise<RpcConnection | null> {
  if (activeConn && activeConn.isOpen() && activeConn.clientId === clientId) {
    return activeConn
  }
  if (activeConn) {
    activeConn.close()
    activeConn = null
  }

  if (connectPromise && connectClientId === clientId) {
    return connectPromise
  }

  connectClientId = clientId
  connectPromise = (async () => {
    const sockets = opts?.socketCandidates ?? candidateSockets()
    for (const sockPath of sockets) {
      if (process.platform !== 'win32' && !opts?.socketCandidates && !existsSync(sockPath)) continue
      try {
        const conn = await connectIpcSocket(sockPath, clientId)
        activeConn = conn
        return conn
      } catch {
        continue
      }
    }

    const ports = opts?.wsPorts ?? [6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472]
    for (const port of ports) {
      try {
        const conn = await connectWsPort(port, clientId)
        activeConn = conn
        return conn
      } catch {
        continue
      }
    }

    return null
  })().finally(() => {
    connectPromise = null
  })

  return connectPromise
}

export async function rpcSetActivity(
  clientId: string,
  activity: WireActivity | null,
  opts?: RpcTestOpts,
): Promise<RpcStatus> {
  const conn = await openConnection(clientId, opts)
  if (!conn) return { connected: false, transport: null }
  try {
    await conn.request('SET_ACTIVITY', activity ? { pid: RPC_PID, activity } : { pid: RPC_PID })
    return { connected: true, transport: conn.transport }
  } catch {
    conn.close()
    if (activeConn === conn) activeConn = null
    return { connected: false, transport: null }
  }
}

export async function rpcDisconnect(): Promise<void> {
  const conn = activeConn
  activeConn = null
  if (conn) {
    try {
      await conn.request('SET_ACTIVITY', { pid: RPC_PID }).catch(() => {})
    } finally {
      conn.close()
    }
  }
}
