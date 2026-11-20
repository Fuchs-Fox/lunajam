import * as http from 'node:http'

export interface LoopbackJoinRequest {
  code: string
  serverUrl?: string
}

const VALID_TOKEN_RE = /^[A-Za-z0-9_-]{6,24}$/
const MAX_PENDING_JOINS = 16

let server: http.Server | null = null
let boundPort: number | null = null
const pendingJoins: LoopbackJoinRequest[] = []

function safeServerParam(raw: string | null): string | undefined {
  if (!raw) return undefined
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
    return undefined
  }
  return undefined
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-allow-private-network': 'true',
    'cache-control': 'no-store',
  }
}

function tryListen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const headers = corsHeaders()
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers).end()
        return
      }
      if (req.method !== 'GET') {
        res.writeHead(405, headers).end(JSON.stringify({ ok: false }))
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
        return
      }

      res.writeHead(200, { ...headers, 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }))
    })

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
  if (srv) {
    await new Promise<void>((resolve) => {
      srv.close(() => resolve())
      srv.closeAllConnections?.()
    })
  }
}
