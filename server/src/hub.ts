import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { decodeClient, encode, type ClientMsg, type ResolveSummary, type ServerMsg } from '../../plugins/lunajam/src/protocol'
import type { Config } from './config'
import { renderJoinPage } from './joinPage'

const MAX_MESSAGE_BYTES = 262144
const MAX_WIRE_BYTES = MAX_MESSAGE_BYTES + 16384
const MAX_BUFFERED_BYTES = 2097152
const HTTP_RATE_WINDOW_MS = 10000
const HTTP_RATE_LIMIT = 60
const BOT_UA_RE = /Discordbot|TelegramBot|Slackbot|Twitterbot|WhatsApp|facebookexternalhit|LinkedInBot|Embedly|crawler|spider|preview/i
const RFC1918_172_RE = /^172\.(1[6-9]|2\d|3[01])\./
const JOIN_CSP =
  "default-src 'none'; img-src https://resources.tidal.com https://*.tidal.com; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src http://127.0.0.1:*; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
}

interface Conn {
  cid: string
  ws: WebSocket
  ip: string
  windowStart: number
  count: number
  lastSeen: number
}

interface HttpRateEntry {
  windowStart: number
  count: number
}

function isTrustedProxyRemote(addr: string): boolean {
  return (
    addr === '127.0.0.1' ||
    addr === '::1' ||
    addr.startsWith('10.') ||
    addr.startsWith('192.168.') ||
    RFC1918_172_RE.test(addr)
  )
}

function parseCandidateIp(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (s.startsWith('[')) {
    const end = s.indexOf(']')
    if (end > 1) s = s.slice(1, end)
  } else if (s.includes('.') && s.includes(':')) {
    s = s.slice(0, s.lastIndexOf(':'))
  }
  s = s.replace(/^::ffff:/, '')
  return isIP(s) !== 0 ? s : null
}

function extractClientIp(req: IncomingMessage): string {
  const cleanRemote = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
  if (isTrustedProxyRemote(cleanRemote)) {
    const xReal = req.headers['x-real-ip']
    const realStr = Array.isArray(xReal) ? xReal[0] : xReal
    const parsedReal = realStr ? parseCandidateIp(realStr) : null
    if (parsedReal) return parsedReal

    const fwd = req.headers['x-forwarded-for']
    const fwdRaw = Array.isArray(fwd) ? fwd[fwd.length - 1] : fwd
    if (fwdRaw) {
      const parts = fwdRaw.split(',')
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i]!.trim()
        if (!seg) continue
        const candidate = parseCandidateIp(seg)
        return candidate ?? cleanRemote
      }
    }
  }
  return cleanRemote
}

function safeDecodeSegment(raw: string): string | null {
  if (!raw || raw.length > 96) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

function rawByteLength(data: RawData): number {
  if (typeof data === 'string') return Buffer.byteLength(data)
  if (Buffer.isBuffer(data)) return data.length
  if (Array.isArray(data)) return data.reduce((sum, buf) => sum + buf.length, 0)
  return data.byteLength
}

export interface HubHandler {
  onMessage(cid: string, msg: ClientMsg): void
  onDisconnect(cid: string): void
  resolveToken(token: string): ResolveSummary | null
  peekToken(token: string): ResolveSummary | null
}

export class Hub {
  private conns = new Map<string, Conn>()
  private ipConnCount = new Map<string, number>()
  private httpRate = new Map<string, HttpRateEntry>()
  private reaper: ReturnType<typeof setInterval>
  private server: Server
  private wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WIRE_BYTES })
  private handler?: HubHandler

  constructor(private cfg: Config) {
    this.server = createServer((req, res) => {
      try {
        this.onHttp(req, res)
      } catch {
        if (!res.headersSent) {
          res.writeHead(400, { ...BASE_SECURITY_HEADERS, 'content-type': 'text/plain' }).end('bad request')
        } else {
          res.destroy()
        }
      }
    })
    this.server.headersTimeout = 10000
    this.server.requestTimeout = 10000
    this.server.keepAliveTimeout = 5000

    this.server.on('upgrade', (req, socket, head) => {
      const ip = extractClientIp(req)
      if (this.conns.size >= this.cfg.maxConnections) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      if ((this.ipConnCount.get(ip) ?? 0) >= this.cfg.maxConnsPerIp) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws, ip))
    })

    const idleMs = this.cfg.idleTimeoutMs
    this.reaper = setInterval(
      () => {
        const now = Date.now()
        for (const c of [...this.conns.values()]) {
          if (now - c.lastSeen > idleMs) c.ws.terminate()
        }
        for (const [ip, entry] of this.httpRate) {
          if (now - entry.windowStart >= HTTP_RATE_WINDOW_MS) this.httpRate.delete(ip)
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
    this.ipConnCount.clear()
    this.httpRate.clear()
    this.wss.close()
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve())
      this.server.closeIdleConnections()
      setTimeout(() => this.server.closeAllConnections(), 500).unref()
    })
  }

  private allowHttp(ip: string): boolean {
    const now = Date.now()
    let entry = this.httpRate.get(ip)
    if (!entry || now - entry.windowStart >= HTTP_RATE_WINDOW_MS) {
      entry = { windowStart: now, count: 0 }
      this.httpRate.set(ip, entry)
    }
    entry.count += 1
    return entry.count <= HTTP_RATE_LIMIT
  }

  private onHttp(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET'
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/'

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        ...BASE_SECURITY_HEADERS,
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': '*',
      })
      res.end()
      return
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, {
        ...BASE_SECURITY_HEADERS,
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'content-type': 'text/plain',
      }).end('method not allowed')
      return
    }

    if (urlPath === '/healthz') {
      res.writeHead(200, { ...BASE_SECURITY_HEADERS, 'content-type': 'text/plain' }).end('ok')
      return
    }

    if (urlPath === '/') {
      res.writeHead(200, {
        ...BASE_SECURITY_HEADERS,
        'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
        'content-type': 'text/html; charset=utf-8',
      }).end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LunaJam</title></head><body><h1>LunaJam relay</h1></body></html>')
      return
    }

    if (urlPath.startsWith('/api/resolve/')) {
      const ip = extractClientIp(req)
      const jsonHeaders = {
        ...BASE_SECURITY_HEADERS,
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      }
      if (!this.allowHttp(ip)) {
        res.writeHead(429, { ...jsonHeaders, 'retry-after': '10' }).end(JSON.stringify({ error: 'rate_limited' }))
        return
      }
      const token = safeDecodeSegment(urlPath.slice('/api/resolve/'.length))
      if (!token) {
        res.writeHead(400, jsonHeaders).end(JSON.stringify({ error: 'bad_request' }))
        return
      }
      const summary = this.handler?.resolveToken(token) ?? null
      if (!summary) {
        res.writeHead(404, jsonHeaders).end(JSON.stringify({ error: 'not_found' }))
        return
      }
      res.writeHead(200, jsonHeaders).end(JSON.stringify(summary))
      return
    }

    if (urlPath.startsWith('/join/')) {
      const ip = extractClientIp(req)
      const htmlHeaders = {
        ...BASE_SECURITY_HEADERS,
        'content-security-policy': JOIN_CSP,
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      }
      if (!this.allowHttp(ip)) {
        res.writeHead(429, { ...BASE_SECURITY_HEADERS, 'content-type': 'text/plain', 'retry-after': '10' }).end('too many requests')
        return
      }
      const token = safeDecodeSegment(urlPath.slice('/join/'.length))
      if (!token) {
        res.writeHead(400, htmlHeaders).end(renderJoinPage(null, this.cfg.publicUrl))
        return
      }
      const ua = String(req.headers['user-agent'] ?? '')
      const isPreview = method === 'HEAD' || BOT_UA_RE.test(ua)
      const summary = isPreview ? this.handler?.peekToken(token) ?? null : this.handler?.resolveToken(token) ?? null
      res.writeHead(summary ? 200 : 404, htmlHeaders).end(method === 'HEAD' ? undefined : renderJoinPage(summary, this.cfg.publicUrl))
      return
    }

    res.writeHead(404, {
      ...BASE_SECURITY_HEADERS,
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'content-type': 'text/plain',
    }).end('not found')
  }

  private attach(ws: WebSocket, ip: string): void {
    const cid = randomUUID()
    const conn: Conn = { cid, ws, ip, windowStart: Date.now(), count: 0, lastSeen: Date.now() }
    this.conns.set(cid, conn)
    this.ipConnCount.set(ip, (this.ipConnCount.get(ip) ?? 0) + 1)

    ws.on('message', (data) => {
      conn.lastSeen = Date.now()
      if (rawByteLength(data) > MAX_MESSAGE_BYTES) {
        this.send(cid, { v: 2, t: 'error', code: 'message_too_large', message: 'Payload limit exceeded' })
        ws.close(1009)
        return
      }
      if (!this.tickRate(conn)) return
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8')
        const msg = decodeClient(raw)
        if (!msg) return
        this.handler?.onMessage(cid, msg)
      } catch {
        return
      }
    })

    ws.on('close', () => {
      this.conns.delete(cid)
      const prev = this.ipConnCount.get(ip) ?? 0
      if (prev <= 1) this.ipConnCount.delete(ip)
      else this.ipConnCount.set(ip, prev - 1)
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