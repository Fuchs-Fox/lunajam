import { DEFAULT_SERVER_URL } from '../../plugins/lunajam/src/protocol'

export interface Config {
  port: number
  host: string
  publicUrl: string
  maxParticipants: number
  hostGraceMs: number
  roomTtlMs: number
  rateLimitPerSec: number
  maxConnections: number
  idleTimeoutMs: number
  maxRooms: number
  roomsPerConn: number
  maxConnsPerIp: number
}

function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= min ? n : fallback
}

export function loadConfig(): Config {
  const publicUrl = (process.env.LUNAJAM_PUBLIC_URL ?? DEFAULT_SERVER_URL).trim().replace(/\/+$/, '') || DEFAULT_SERVER_URL
  return {
    port: intEnv('LUNAJAM_PORT', 8642),
    host: (process.env.LUNAJAM_HOST ?? '0.0.0.0').trim() || '0.0.0.0',
    publicUrl,
    maxParticipants: intEnv('LUNAJAM_MAX_PARTICIPANTS', 32),
    hostGraceMs: intEnv('LUNAJAM_HOST_GRACE_MS', 20000, 100),
    roomTtlMs: intEnv('LUNAJAM_ROOM_TTL_MS', 900000, 1000),
    rateLimitPerSec: intEnv('LUNAJAM_RATE_LIMIT', 60),
    maxConnections: intEnv('LUNAJAM_MAX_CONNECTIONS', 512),
    idleTimeoutMs: intEnv('LUNAJAM_IDLE_MS', 90000, 1000),
    maxRooms: intEnv('LUNAJAM_MAX_ROOMS', 256),
    roomsPerConn: intEnv('LUNAJAM_ROOMS_PER_CONN', 4, 1),
    maxConnsPerIp: intEnv('LUNAJAM_MAX_CONNS_PER_IP', 24, 1),
  }
}
