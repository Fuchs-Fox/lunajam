import { mkdtempSync, rmSync } from 'node:fs'
import * as http from 'node:http'
import * as net from 'node:net'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'
import { drainLoopbackJoins, startLoopback, stopLoopback } from '../plugins/lunajam/src/discord/loopback.native'
import { candidateSockets, rpcDisconnect, rpcSetActivity } from '../plugins/lunajam/src/discord/rpc.native'

function encodeIpc(op: number, data: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(data), 'utf8')
  const out = Buffer.allocUnsafe(8 + body.length)
  out.writeInt32LE(op, 0)
  out.writeInt32LE(body.length, 4)
  body.copy(out, 8)
  return out
}

describe('Discord native RPC & loopback bridge', () => {
  const cleanups: Array<() => Promise<void> | void> = []

  afterEach(async () => {
    await rpcDisconnect().catch(() => {})
    await stopLoopback().catch(() => {})
    while (cleanups.length > 0) {
      const fn = cleanups.pop()!
      await fn()
    }
  })

  it('connects to Discord Unix IPC socket, sets Listening activity with Listen Together button, and clears cleanly', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lj-ipc-'))
    const sockPath = path.join(dir, 'discord-ipc-0')
    const received: Array<{ cmd: string; args?: Record<string, unknown> }> = []

    const srv = net.createServer((socket) => {
      let buf = Buffer.alloc(0)
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk])
        while (buf.length >= 8) {
          const op = buf.readInt32LE(0)
          const len = buf.readInt32LE(4)
          if (buf.length < 8 + len) break
          const msg = JSON.parse(buf.subarray(8, 8 + len).toString('utf8')) as Record<string, unknown>
          buf = buf.subarray(8 + len)
          if (op === 0) {
            socket.write(encodeIpc(1, { cmd: 'DISPATCH', evt: 'READY', data: { v: 1 } }))
          } else if (op === 1) {
            received.push({
              cmd: String(msg.cmd),
              args: msg.args as Record<string, unknown> | undefined,
            })
            socket.write(encodeIpc(1, { cmd: msg.cmd, data: null, evt: null, nonce: msg.nonce }))
          }
        }
      })
    })

    await new Promise<void>((resolve) => srv.listen(sockPath, resolve))
    cleanups.push(async () => {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
      rmSync(dir, { recursive: true, force: true })
    })

    const res = await rpcSetActivity(
      '1130698654987067493',
      {
        type: 2,
        details: 'Midnight City',
        state: 'M83',
        party: { id: 'lunajam:K7M4P9Q2', size: [3, 32] },
        buttons: [
          { label: 'Listen Together', url: 'https://lunajam.sn0w13.de/join/K7M4P9Q2' },
          { label: 'Play on TIDAL', url: 'https://tidal.com/browse/track/101' },
        ],
      },
      { socketCandidates: [sockPath], wsPorts: [] },
    )

    expect(res.connected).toBe(true)
    expect(res.transport).toBe(`ipc:${sockPath}`)
    expect(received.length).toBe(1)
    expect(received[0]!.cmd).toBe('SET_ACTIVITY')
    expect(received[0]!.args?.pid).toBe(1000)

    await rpcDisconnect()
    expect(received.length).toBe(2)
    expect(received[1]!.args?.activity).toBeUndefined()
  })

  it('falls back to local arRPC WebSocket transport when no IPC socket is present', async () => {
    const httpSrv = http.createServer()
    const wss = new WebSocketServer({ server: httpSrv })
    const captured: Array<{ origin?: string; msg: Record<string, unknown> }> = []

    wss.on('connection', (ws, req) => {
      const origin = req.headers.origin
      ws.send(JSON.stringify({ cmd: 'DISPATCH', evt: 'READY', data: { v: 1 } }))
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString('utf8')) as Record<string, unknown>
        captured.push({ origin, msg })
        ws.send(JSON.stringify({ cmd: msg.cmd, data: {}, evt: null, nonce: msg.nonce }))
      })
    })

    await new Promise<void>((resolve) => httpSrv.listen(0, '127.0.0.1', resolve))
    const addr = httpSrv.address()
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0
    cleanups.push(async () => {
      wss.close()
      await new Promise<void>((resolve) => httpSrv.close(() => resolve()))
    })

    const res = await rpcSetActivity(
      '1130698654987067493',
      {
        type: 2,
        details: 'Genesis',
        state: 'Justice',
        buttons: [{ label: 'Listen Together', url: 'https://lunajam.sn0w13.de/join/s_test1234' }],
      },
      { socketCandidates: [], wsPorts: [port] },
    )

    expect(res.connected).toBe(true)
    expect(res.transport).toBe(`ws:${port}`)
    expect(captured.length).toBe(1)
    expect(captured[0]!.origin).toBe('https://discord.com')
    expect(captured[0]!.msg.cmd).toBe('SET_ACTIVITY')
  })

  it('serves local loopback join bridge with Private Network Access CORS headers', async () => {
    const port = await startLoopback([0])
    expect(port).toBeTypeOf('number')

    const preflight = await fetch(`http://127.0.0.1:${port}/lunajam-join`, { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-private-network')).toBe('true')

    const bad = await fetch(`http://127.0.0.1:${port}/lunajam-join?code=!!`)
    expect(bad.status).toBe(400)

    const ok = await fetch(
      `http://127.0.0.1:${port}/lunajam-join?code=K7M4P9Q2&server=${encodeURIComponent('https://lunajam.sn0w13.de')}`,
    )
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true })

    const joins = await drainLoopbackJoins()
    expect(joins).toEqual([{ code: 'K7M4P9Q2', serverUrl: 'https://lunajam.sn0w13.de' }])
    expect(await drainLoopbackJoins()).toEqual([])
  })

  it('includes Flatpak Equibop and Vesktop xdg-run IPC paths in Linux socket candidates', () => {
    if (process.platform === 'win32') return
    const prev = process.env.XDG_RUNTIME_DIR
    process.env.XDG_RUNTIME_DIR = '/run/user/1001'
    try {
      const candidates = candidateSockets()
      expect(candidates).toContain('/run/user/1001/.flatpak/org.equicord.equibop/xdg-run/discord-ipc-0')
      expect(candidates).toContain('/run/user/1001/.flatpak/dev.vencord.Vesktop/xdg-run/discord-ipc-0')
      expect(candidates).toContain('/run/user/1001/discord-ipc-0')
    } finally {
      if (prev === undefined) delete process.env.XDG_RUNTIME_DIR
      else process.env.XDG_RUNTIME_DIR = prev
    }
  })
})
