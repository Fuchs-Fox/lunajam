import * as http from 'node:http'

export interface LoopbackJoinRequest {
  code: string
  serverUrl?: string
}

const VALID_TOKEN_RE = /^[A-Za-z0-9_-]{6,24}$/
const MAX_PENDING_JOINS = 16
const MAX_JOIN_BODY_BYTES = 1024
const RATE_WINDOW_MS = 5000
const RATE_LIMIT = 8
const DEFAULT_ORIGIN = 'https://lunajam.sn0w13.de'

let server: http.Server | null = null
let boundPort: number | null = null
const pendingJoins: LoopbackJoinRequest[] = []
let rateWindowStart = 0
let rateCount = 0

function safeOrigin(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'https:') return parsed.origin
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]')
    ) {
      return parsed.origin
    }
  } catch {
    return null
  }
  return null
}

function safeServerParam(raw: string | null): string | undefined {
  if (!raw) return undefined
  return safeOrigin(raw) ?? undefined
}

function corsHeaders(allowOrigin: string): Record<string, string> {
  return {
    'access-control-allow-origin': allowOrigin,
    vary: 'Origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-LunaJam-Join',
    'access-control-allow-private-network': 'true',
    'cache-control': 'no-store',
  }
}

function allowRate(): boolean {
  const now = Date.now()
  if (now - rateWindowStart >= RATE_WINDOW_MS) {
    rateWindowStart = now
    rateCount = 0
  }
  rateCount += 1
  return rateCount <= RATE_LIMIT
}

function tryListen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const reqOriginHeader = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
      const checkedOrigin = reqOriginHeader ? safeOrigin(reqOriginHeader) : DEFAULT_ORIGIN
      if (!checkedOrigin) {
        req.resume()
        res.writeHead(403, corsHeaders(DEFAULT_ORIGIN)).end(JSON.stringify({ ok: false, error: 'forbidden_origin' }))
        return
      }

      const headers = corsHeaders(checkedOrigin)
      const contentLen = Number.parseInt(String(req.headers['content-length'] ?? '0'), 10)
      if (Number.isFinite(contentLen) && contentLen > MAX_JOIN_BODY_BYTES) {
        req.resume()
        res.writeHead(413, headers).end(JSON.stringify({ ok: false, error: 'payload_too_large' }))
        return
      }
      req.resume()

      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers).end()
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, headers).end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
        return
      }
      if (req.headers['x-lunajam-join'] !== '1') {
        res.writeHead(403, headers).end(JSON.stringify({ ok: false, error: 'missing_header' }))
        return
      }
      if (!allowRate()) {
        res.writeHead(429, headers).end(JSON.stringify({ ok: false, error: 'rate_limited' }))
        return
      }

      let parsed: URL
      try {
        parsed = new URL(req.url ?? '/', 'http://127.0.0.1')
      } catch {
        res.writeHead(400, headers).end(JSON.stringify({ ok: false }))
        return
      }

      if (parsed.pathname !== '/lunajam-join') {
        res.writeHead(404, headers).end(JSON.stringify({ ok: false }))
        return
      }

      const code = (parsed.searchParams.get('code') ?? '').trim()
      if (!VALID_TOKEN_RE.test(code)) {
        res.writeHead(400, { ...headers, 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'invalid_code' }))
        return
      }

      const serverUrl = safeServerParam(parsed.searchParams.get('server'))
      if (pendingJoins.length >= MAX_PENDING_JOINS) pendingJoins.shift()
      pendingJoins.push({ code, ...(serverUrl ? { serverUrl } : {}) })

      try {
        const win = (globalThis as { luna?: { tidalWindow?: { show?: () => void; focus?: () => void } } }).luna?.tidalWindow
        win?.show?.()
        win?.focus?.()
      } catch {
        void 0
      }

      res.writeHead(200, { ...headers, 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }))
    })

    srv.headersTimeout = 5000
    srv.requestTimeout = 5000
    srv.keepAliveTimeout = 2000

    srv.once('error', (err) => {
      srv.close()
      reject(err)
    })

    srv.listen(port, '127.0.0.1', () => {
      server = srv
      const addr = srv.address()
      boundPort = typeof addr === 'object' && addr !== null ? addr.port : port
      resolve(boundPort)
    })
  })
}

export async function startLoopback(ports?: number[]): Promise<number | null> {
  if (server && boundPort !== null) return boundPort
  const candidates = ports ?? [24860, 24861, 24862, 24863, 24864, 24865, 24866, 24867, 24868, 24869]
  for (const port of candidates) {
    try {
      return await tryListen(port)
    } catch {
      continue
    }
  }
  return null
}

export async function drainLoopbackJoins(): Promise<LoopbackJoinRequest[]> {
  if (pendingJoins.length === 0) return []
  return pendingJoins.splice(0, pendingJoins.length)
}

export async function stopLoopback(): Promise<void> {
  const srv = server
  server = null
  boundPort = null
  pendingJoins.length = 0
  rateWindowStart = 0
  rateCount = 0
  if (srv) {
    await new Promise<void>((resolve) => {
      srv.close(() => resolve())
      srv.closeAllConnections?.()
    })
  }
}