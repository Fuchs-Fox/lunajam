import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { decodeClient, encode, type ClientMsg, type ResolveSummary, type ServerMsg } from '../../plugins/lunajam/src/protocol'
import type { Config } from './config'
import { renderJoinPage } from './joinPage'

const MAX_MESSAGE_BYTES = 262144
const MAX_WIRE_BYTES = MAX_MESSAGE_BYTES + 16384
const MAX_BUFFERED_BYTES = 2097152

interface Conn {
  cid: string
  ws: WebSocket
  ip: string
  windowStart: number
  count: number
  lastSeen: number
}

function extractClientIp(req: IncomingMessage): string {
  const remote = req.socket.remoteAddress ?? ''
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
  if (isLoopback) {
    const fwd = req.headers['x-forwarded-for']
    const raw = Array.isArray(fwd) ? fwd[0] : fwd
    const first = raw?.split(',')[0]?.trim()
    if (first) return first
  }
  return remote.replace(/^::ffff:/, '')
}

export interface HubHandler {
  onMessage(cid: string, msg: ClientMsg): void
  onDisconnect(cid: string): void
  resolveToken(token: string): ResolveSummary | null
}

export class Hub {
  private conns = new Map<string, Conn>()
  private reaper: ReturnType<typeof setInterval>
  private server: Server
  private wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WIRE_BYTES })
  private handler?: HubHandler

  constructor(private cfg: Config) {
    this.server = createServer((req, res) => this.onHttp(req, res))
    this.server.on('upgrade', (req, socket, head) => {
      if (this.conns.size >= this.cfg.maxConnections) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws, extractClientIp(req)))
    })

    const idleMs = this.cfg.idleTimeoutMs
    this.reaper = setInterval(
      () => {
        const now = Date.now()
        for (const c of [...this.conns.values()]) {
          if (now - c.lastSeen > idleMs) c.ws.terminate()
        }
      },
      Math.max(50, Math.min(2000, Math.floor(idleMs / 3))),
    )
    this.reaper.unref()
  }

  setHandler(handler: HubHandler): void {
    this.handler = handler
  }

  now(): number {
    return performance.now()
  }

  peerIp(cid: string): string | undefined {
    return this.conns.get(cid)?.ip
  }

  send(cid: string, msg: ServerMsg): void {
    const conn = this.conns.get(cid)
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return
    if (conn.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      conn.ws.terminate()
      return
    }
    conn.ws.send(encode(msg))
  }

  broadcast(cids: Iterable<string>, msg: ServerMsg): void {
    const wire = encode(msg)
    for (const cid of cids) {
      const conn = this.conns.get(cid)
      if (!conn || conn.ws.readyState !== WebSocket.OPEN) continue
      if (conn.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        conn.ws.terminate()
        continue
      }
      conn.ws.send(wire)
    }
  }

  listen(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.cfg.port, this.cfg.host, () => {
        const addr = this.server.address()
        resolve(typeof addr === 'object' && addr !== null ? addr.port : this.cfg.port)
      })
    })
  }

  async close(): Promise<void> {
    clearInterval(this.reaper)
    for (const conn of this.conns.values()) conn.ws.terminate()
    this.conns.clear()
    this.wss.close()
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve())
      this.server.closeIdleConnections()
      setTimeout(() => this.server.closeAllConnections(), 500).unref()
    })
  }

  private onHttp(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET'
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/'

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': '*',
      })
      res.end()
      return
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain' }).end('method not allowed')
      return
    }

    if (urlPath === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
      return
    }

    if (urlPath === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LunaJam</title></head><body><h1>LunaJam relay v2</h1></body></html>',
      )
      return
    }

    if (urlPath.startsWith('/api/resolve/')) {
      const token = decodeURIComponent(urlPath.slice('/api/resolve/'.length))
      const summary = this.handler?.resolveToken(token) ?? null
      const headers = {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      }
      if (!summary) {
        res.writeHead(404, headers).end(JSON.stringify({ error: 'not_found' }))
        return
      }
      res.writeHead(200, headers).end(JSON.stringify(summary))
      return
    }

    if (urlPath.startsWith('/join/')) {
      const token = decodeURIComponent(urlPath.slice('/join/'.length))
      const summary = this.handler?.resolveToken(token) ?? null
      res.writeHead(summary ? 200 : 404, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      }).end(renderJoinPage(summary, this.cfg.publicUrl))
      return
    }

    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }

  private attach(ws: WebSocket, ip: string): void {
    const cid = randomUUID()
    const conn: Conn = { cid, ws, ip, windowStart: Date.now(), count: 0, lastSeen: Date.now() }
    this.conns.set(cid, conn)

    ws.on('message', (data) => {
      conn.lastSeen = Date.now()
      const raw = typeof data === 'string' ? data : data.toString('utf8')
      if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) {
        this.send(cid, { v: 2, t: 'error', code: 'message_too_large', message: 'Payload limit exceeded' })
        ws.close(1009)
        return
      }
      if (!this.tickRate(conn)) return
      const msg = decodeClient(raw)
      if (!msg) return
      this.handler?.onMessage(cid, msg)
    })

    ws.on('close', () => {
      this.conns.delete(cid)
      this.handler?.onDisconnect(cid)
    })

    ws.on('error', () => ws.terminate())
    this.send(cid, { v: 2, t: 'welcome', cid, serverTs: this.now() })
  }

  private tickRate(conn: Conn): boolean {
    const now = Date.now()
    if (now - conn.windowStart >= 1000) {
      conn.windowStart = now
      conn.count = 0
    }
    conn.count += 1
    if (conn.count > this.cfg.rateLimitPerSec) {
      this.send(conn.cid, { v: 2, t: 'error', code: 'rate_limited', message: 'Too many requests' })
      return false
    }
    return true
  }
}
