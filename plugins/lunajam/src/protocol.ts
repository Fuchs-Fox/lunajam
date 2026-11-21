export const PROTOCOL_VERSION = 2 as const
export const DEFAULT_SERVER_URL = 'https://lunajam.sn0w13.de'
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const MAX_QUEUE_TRACKS = 200

export type AudioMode = 'remote' | 'speaker'
export type Role = 'host' | 'guest'
export type EndReason = 'host_ended' | 'host_timeout' | 'kicked' | 'banned'

export interface Profile {
  cid: string
  name: string
  avatarUrl: string | null
  tidalUserId?: string
  profilePath?: string
}

export interface Participant extends Profile {
  role: Role
  audioMode: AudioMode
  canAddTracks: boolean
}

export interface QueueTrack {
  uid: string
  trackId: string
  title: string
  artist: string
  album?: string
  coverUrl?: string
  durationSec?: number
  addedBy: Profile
}

export type QueueTrackInput = Omit<QueueTrack, 'uid' | 'addedBy'>
export type QueueTrackReplace = Omit<QueueTrack, 'addedBy'>

export interface PlaybackSnapshot {
  trackId: string | null
  queueUid: string | null
  posMs: number
  serverTs: number
  playing: boolean
  durationSec?: number
}

export type PlaybackInput = Omit<PlaybackSnapshot, 'serverTs'>

export interface RoomSnapshot {
  code: string
  hostCid: string
  hostToken?: string
  allowGuestControl: boolean
  allowGuestAdd: boolean
  participants: Participant[]
  queue: QueueTrack[]
  currentIndex: number
  playback: PlaybackSnapshot | null
}

export type ControlAction =
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'seek'; posMs: number }
  | { kind: 'select'; uid: string }

export interface TrackMetaUpdate {
  trackId: string
  title: string
  artist: string
  album?: string
  coverUrl?: string
  durationSec?: number
}

export type InsertPosition = 'next' | 'last' | number

export type ClientMsg =
  | { v: 2; t: 'ping'; clientTs: number }
  | {
      v: 2
      t: 'room.create'
      profile: Profile
      allowGuestControl: boolean
      allowGuestAdd?: boolean
      queue: QueueTrack[]
      currentIndex: number
      playback: PlaybackInput | null
      hostToken?: string
      code?: string
    }
  | { v: 2; t: 'room.join'; code: string; profile: Profile; audioMode: AudioMode; peerId?: string }
  | { v: 2; t: 'room.leave' }
  | { v: 2; t: 'room.end' }
  | { v: 2; t: 'room.kick'; targetCid: string }
  | { v: 2; t: 'room.kickAll' }
  | { v: 2; t: 'room.permissions'; allowGuestControl?: boolean; allowGuestAdd?: boolean }
  | { v: 2; t: 'room.memberPermission'; targetCid: string; canAddTracks: boolean }
  | { v: 2; t: 'room.mode'; audioMode: AudioMode }
  | { v: 2; t: 'playback.sync'; playback: PlaybackInput; currentIndex: number }
  | { v: 2; t: 'playback.control'; action: ControlAction }
  | { v: 2; t: 'queue.add'; tracks: QueueTrackInput[]; insert: InsertPosition }
  | { v: 2; t: 'queue.move'; uid: string; toIndex: number }
  | { v: 2; t: 'queue.remove'; uid: string }
  | { v: 2; t: 'queue.replace'; queue: QueueTrackReplace[]; currentIndex: number }
  | { v: 2; t: 'queue.meta'; updates: TrackMetaUpdate[] }
  | {
      v: 2
      t: 'standby.open'
      profile: Profile
      queue: QueueTrackInput[]
      currentIndex: number
      playback: PlaybackInput | null
      allowGuestControl: boolean
      allowGuestAdd?: boolean
    }
  | {
      v: 2
      t: 'standby.update'
      queue?: QueueTrackInput[]
      currentIndex?: number
      playback?: PlaybackInput | null
    }
  | { v: 2; t: 'standby.close' }
  | { v: 2; t: 'profile.update'; profile: Profile }

export type ServerMsg =
  | { v: 2; t: 'welcome'; cid: string; serverTs: number }
  | { v: 2; t: 'pong'; clientTs: number; serverTs: number }
  | { v: 2; t: 'room.joined'; role: Role; hostToken?: string; state: RoomSnapshot }
  | { v: 2; t: 'room.state'; state: RoomSnapshot }
  | { v: 2; t: 'playback.tick'; playback: PlaybackSnapshot; currentIndex: number }
  | { v: 2; t: 'playback.command'; from: Profile; action: ControlAction }
  | { v: 2; t: 'room.ended'; reason: EndReason }
  | { v: 2; t: 'standby.ready'; standbyId: string }
  | { v: 2; t: 'standby.promoted'; hostToken: string; state: RoomSnapshot }
  | { v: 2; t: 'error'; code: string; message: string }

export type Envelope = ClientMsg | ServerMsg

export interface ResolveSummary {
  token: string
  code: string
  hostName: string
  participantCount: number
  maxParticipants: number
  track: { title: string; artist: string; coverUrl?: string } | null
}

const ROOM_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/
const STANDBY_RE = /^s_[A-Za-z0-9_-]{8,24}$/

export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
}

export function formatCode(code: string): string {
  const clean = normalizeCode(code)
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

export function isRoomCode(raw: string): boolean {
  return ROOM_RE.test(normalizeCode(raw))
}

export function isStandbyToken(raw: string): boolean {
  return STANDBY_RE.test(raw.trim())
}

export function isJoinToken(raw: string): boolean {
  return isRoomCode(raw) || isStandbyToken(raw)
}

export function parseJoinTarget(input: string): { token: string; serverUrl?: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (isStandbyToken(trimmed)) return { token: trimmed }
  if (isRoomCode(trimmed)) return { token: normalizeCode(trimmed) }
  try {
    const normalizedScheme = trimmed.replace(/^tidaluna:/i, 'https:')
    const url = new URL(normalizedScheme)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      const codeParam = url.searchParams.get('code') ?? url.searchParams.get('token') ?? ''
      const serverParam = url.searchParams.get('server')
      const pathSeg = url.pathname.split('/').filter(Boolean).pop() ?? ''
      const rawToken = codeParam || pathSeg
      if (isStandbyToken(rawToken)) {
        return {
          token: rawToken.trim(),
          serverUrl: serverParam ? sanitizeBaseUrl(serverParam) ?? undefined : trimmed.startsWith('http') ? url.origin : undefined,
        }
      }
      if (isRoomCode(rawToken)) {
        return {
          token: normalizeCode(rawToken),
          serverUrl: serverParam ? sanitizeBaseUrl(serverParam) ?? undefined : trimmed.startsWith('http') ? url.origin : undefined,
        }
      }
    }
  } catch {
    return null
  }
  return null
}

export function sanitizeBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol === 'https:') return url.origin
    if (url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')) {
      return url.origin
    }
    return null
  } catch {
    return null
  }
}

export function encode(msg: Envelope): string {
  return JSON.stringify(msg)
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

const COVER_DOMAINS = ['tidal.com'] as const
const AVATAR_DOMAINS = [
  'tidal.com',
  'gravatar.com',
  'discordapp.com',
  'discordapp.net',
  'githubusercontent.com',
  'imgur.com',
  'catbox.moe',
  'googleusercontent.com',
  'twimg.com',
  'bsky.app',
] as const

function sanitizeText(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if ((c >= 0x20 && c < 0x7f) || (c > 0x9f && (c < 0x202a || c > 0x202e) && (c < 0x2066 || c > 0x2069))) {
      out += raw[i]
    }
  }
  return out.trim()
}

function str(x: unknown, max: number): string | null {
  if (typeof x !== 'string') return null
  const t = sanitizeText(x)
  return t.length > 0 && t.length <= max ? t : null
}

function optStr(x: unknown, max: number): string | undefined {
  if (x === undefined || x === null) return undefined
  if (typeof x !== 'string') return undefined
  const t = sanitizeText(x)
  return t.length <= max ? t : t.slice(0, max)
}

function matchesDomain(host: string, allowed: readonly string[]): boolean {
  const h = host.toLowerCase()
  return allowed.some((d) => h === d || h.endsWith(`.${d}`))
}

function safeHttpsUrl(x: unknown, allowedDomains: readonly string[]): string | null {
  if (x === null || x === undefined || x === '') return null
  if (typeof x !== 'string' || x.length > 512) return null
  try {
    const u = new URL(x.trim())
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
    return matchesDomain(u.hostname, allowedDomains) ? u.href : null
  } catch {
    return null
  }
}

function safeCoverUrl(x: unknown): string | null {
  return safeHttpsUrl(x, COVER_DOMAINS)
}

function safeAvatarUrl(x: unknown): string | null {
  return safeHttpsUrl(x, AVATAR_DOMAINS)
}

function fin(x: unknown, min = 0, max = 1e14): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null
}

function int(x: unknown, min = 0, max = 10000): number | null {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : null
}

const TIDAL_USER_RE = /^\d{1,20}$/
const PROFILE_PATH_RE = /^\/(?:@[A-Za-z0-9._-]{1,64}|artist\/\d{1,20})$/
const PEER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

function parseProfile(x: unknown): Profile | null {
  if (!isObj(x)) return null
  const name = str(x.name, 80) ?? 'Listener'
  const cid = typeof x.cid === 'string' && x.cid.length <= 64 ? x.cid : ''
  const rawUid = typeof x.tidalUserId === 'string' ? x.tidalUserId.trim() : ''
  const tidalUserId = TIDAL_USER_RE.test(rawUid) ? rawUid : undefined
  const rawPath = typeof x.profilePath === 'string' ? x.profilePath.trim() : ''
  const profilePath = PROFILE_PATH_RE.test(rawPath) ? rawPath : undefined
  return {
    cid,
    name,
    avatarUrl: safeAvatarUrl(x.avatarUrl),
    ...(tidalUserId ? { tidalUserId } : {}),
    ...(profilePath ? { profilePath } : {}),
  }
}

function parseQueueInput(x: unknown): QueueTrackInput | null {
  if (!isObj(x)) return null
  const trackId = str(x.trackId, 64)
  if (!trackId) return null
  const title = optStr(x.title, 200) ?? ''
  const artist = optStr(x.artist, 200) ?? ''
  const album = optStr(x.album, 200)
  const coverUrl = safeCoverUrl(x.coverUrl) ?? undefined
  const durationSec = typeof x.durationSec === 'number' && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : undefined
  return { trackId, title, artist, ...(album ? { album } : {}), ...(coverUrl ? { coverUrl } : {}), ...(durationSec !== undefined ? { durationSec } : {}) }
}

function parseQueueTrackReplace(x: unknown): QueueTrackReplace | null {
  if (!isObj(x)) return null
  const base = parseQueueInput(x)
  const uid = str(x.uid, 64)
  if (!base || !uid) return null
  return { ...base, uid }
}

function parseQueueTrack(x: unknown): QueueTrack | null {
  const rep = parseQueueTrackReplace(x)
  if (!rep || !isObj(x)) return null
  const addedBy = parseProfile(x.addedBy)
  if (!addedBy) return null
  return { ...rep, addedBy }
}

function parsePlaybackInput(x: unknown): PlaybackInput | null {
  if (!isObj(x)) return null
  const trackId = x.trackId === null ? null : str(x.trackId, 64)
  if (x.trackId !== null && trackId === null) return null
  const queueUid = x.queueUid === null || x.queueUid === undefined ? null : str(x.queueUid, 64)
  const posMs = fin(x.posMs, 0, 86400000)
  if (posMs === null || typeof x.playing !== 'boolean') return null
  const durationSec = typeof x.durationSec === 'number' && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : undefined
  return { trackId, queueUid, posMs, playing: x.playing, ...(durationSec !== undefined ? { durationSec } : {}) }
}

function parsePlaybackSnapshot(x: unknown): PlaybackSnapshot | null {
  const base = parsePlaybackInput(x)
  if (!base || !isObj(x)) return null
  const serverTs = fin(x.serverTs, 0, 1e16)
  if (serverTs === null) return null
  return { ...base, serverTs }
}

function parseControlAction(x: unknown): ControlAction | null {
  if (!isObj(x) || typeof x.kind !== 'string') return null
  switch (x.kind) {
    case 'play':
    case 'pause':
    case 'next':
    case 'prev':
      return { kind: x.kind }
    case 'seek': {
      const posMs = fin(x.posMs, 0, 86400000)
      return posMs === null ? null : { kind: 'seek', posMs }
    }
    case 'select': {
      const uid = str(x.uid, 64)
      return uid ? { kind: 'select', uid } : null
    }
    default:
      return null
  }
}

function parseParticipant(x: unknown): Participant | null {
  if (!isObj(x)) return null
  const profile = parseProfile(x)
  if (!profile) return null
  if (x.role !== 'host' && x.role !== 'guest') return null
  if (x.audioMode !== 'remote' && x.audioMode !== 'speaker') return null
  const canAddTracks = typeof x.canAddTracks === 'boolean' ? x.canAddTracks : true
  return { ...profile, role: x.role, audioMode: x.audioMode, canAddTracks }
}

function parseRoomSnapshot(x: unknown): RoomSnapshot | null {
  if (!isObj(x)) return null
  const code = str(x.code, 16)
  const hostCid = str(x.hostCid, 64)
  if (!code || !hostCid || typeof x.allowGuestControl !== 'boolean') return null
  const allowGuestAdd = typeof x.allowGuestAdd === 'boolean' ? x.allowGuestAdd : true
  if (!Array.isArray(x.participants) || !Array.isArray(x.queue)) return null
  const participants: Participant[] = []
  for (const p of x.participants.slice(0, 64)) {
    const parsed = parseParticipant(p)
    if (!parsed) return null
    participants.push(parsed)
  }
  const queue: QueueTrack[] = []
  for (const q of x.queue.slice(0, MAX_QUEUE_TRACKS)) {
    const parsed = parseQueueTrack(q)
    if (!parsed) return null
    queue.push(parsed)
  }
  const currentIndex = int(x.currentIndex, -1, MAX_QUEUE_TRACKS)
  if (currentIndex === null) return null
  const playback = x.playback === null ? null : parsePlaybackSnapshot(x.playback)
  if (x.playback !== null && playback === null) return null
  const hostToken = str(x.hostToken, 128) ?? undefined
  return {
    code,
    hostCid,
    ...(hostToken ? { hostToken } : {}),
    allowGuestControl: x.allowGuestControl,
    allowGuestAdd,
    participants,
    queue,
    currentIndex,
    playback,
  }
}

function parseArray<T>(x: unknown, max: number, fn: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(x) || x.length > max) return null
  const out: T[] = []
  for (const item of x) {
    const parsed = fn(item)
    if (!parsed) return null
    out.push(parsed)
  }
  return out
}

function parseMetaUpdate(x: unknown): TrackMetaUpdate | null {
  if (!isObj(x)) return null
  const trackId = str(x.trackId, 64)
  const title = str(x.title, 200)
  const artist = optStr(x.artist, 200) ?? ''
  if (!trackId || !title) return null
  const album = optStr(x.album, 200)
  const coverUrl = safeCoverUrl(x.coverUrl) ?? undefined
  const durationSec = typeof x.durationSec === 'number' && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : undefined
  return { trackId, title, artist, ...(album ? { album } : {}), ...(coverUrl ? { coverUrl } : {}), ...(durationSec !== undefined ? { durationSec } : {}) }
}

export function decodeClient(raw: string): ClientMsg | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(obj) || obj.v !== PROTOCOL_VERSION || typeof obj.t !== 'string') return null
  switch (obj.t) {
    case 'ping': {
      const clientTs = fin(obj.clientTs, 0, 1e16)
      return clientTs === null ? null : { v: 2, t: 'ping', clientTs }
    }
    case 'room.create': {
      const profile = parseProfile(obj.profile)
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueTrack)
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      if (!profile || !queue || currentIndex === null || typeof obj.allowGuestControl !== 'boolean') return null
      if (obj.allowGuestAdd !== undefined && typeof obj.allowGuestAdd !== 'boolean') return null
      const playback = obj.playback === null ? null : parsePlaybackInput(obj.playback)
      if (obj.playback !== null && playback === null) return null
      const hostToken = str(obj.hostToken, 128) ?? undefined
      const code = typeof obj.code === 'string' && isRoomCode(obj.code) ? normalizeCode(obj.code) : undefined
      return {
        v: 2,
        t: 'room.create',
        profile,
        allowGuestControl: obj.allowGuestControl,
        ...(obj.allowGuestAdd !== undefined ? { allowGuestAdd: obj.allowGuestAdd } : {}),
        queue,
        currentIndex,
        playback,
        ...(hostToken ? { hostToken } : {}),
        ...(code ? { code } : {}),
      }
    }
    case 'room.join': {
      const code = typeof obj.code === 'string' && isRoomCode(obj.code) ? normalizeCode(obj.code) : null
      const profile = parseProfile(obj.profile)
      if (!code || !profile || (obj.audioMode !== 'remote' && obj.audioMode !== 'speaker')) return null
      const peerId = typeof obj.peerId === 'string' && PEER_ID_RE.test(obj.peerId.trim()) ? obj.peerId.trim() : undefined
      return { v: 2, t: 'room.join', code, profile, audioMode: obj.audioMode, ...(peerId ? { peerId } : {}) }
    }
    case 'room.leave':
    case 'room.end':
    case 'room.kickAll':
    case 'standby.close':
      return { v: 2, t: obj.t }
    case 'room.kick': {
      const targetCid = str(obj.targetCid, 64)
      return targetCid ? { v: 2, t: 'room.kick', targetCid } : null
    }
    case 'room.permissions': {
      const allowGuestControl = typeof obj.allowGuestControl === 'boolean' ? obj.allowGuestControl : undefined
      const allowGuestAdd = typeof obj.allowGuestAdd === 'boolean' ? obj.allowGuestAdd : undefined
      if (allowGuestControl === undefined && allowGuestAdd === undefined) return null
      return {
        v: 2,
        t: 'room.permissions',
        ...(allowGuestControl !== undefined ? { allowGuestControl } : {}),
        ...(allowGuestAdd !== undefined ? { allowGuestAdd } : {}),
      }
    }
    case 'room.memberPermission': {
      const targetCid = str(obj.targetCid, 64)
      if (!targetCid || typeof obj.canAddTracks !== 'boolean') return null
      return { v: 2, t: 'room.memberPermission', targetCid, canAddTracks: obj.canAddTracks }
    }
    case 'room.mode':
      return obj.audioMode === 'remote' || obj.audioMode === 'speaker'
        ? { v: 2, t: 'room.mode', audioMode: obj.audioMode }
        : null
    case 'playback.sync': {
      const playback = parsePlaybackInput(obj.playback)
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      return playback && currentIndex !== null ? { v: 2, t: 'playback.sync', playback, currentIndex } : null
    }
    case 'playback.control': {
      const action = parseControlAction(obj.action)
      return action ? { v: 2, t: 'playback.control', action } : null
    }
    case 'queue.add': {
      const tracks = parseArray(obj.tracks, 50, parseQueueInput)
      const insert = obj.insert === 'next' || obj.insert === 'last' ? obj.insert : int(obj.insert, 0, MAX_QUEUE_TRACKS)
      return tracks && tracks.length > 0 && insert !== null ? { v: 2, t: 'queue.add', tracks, insert } : null
    }
    case 'queue.move': {
      const uid = str(obj.uid, 64)
      const toIndex = int(obj.toIndex, 0, MAX_QUEUE_TRACKS)
      return uid && toIndex !== null ? { v: 2, t: 'queue.move', uid, toIndex } : null
    }
    case 'queue.remove': {
      const uid = str(obj.uid, 64)
      return uid ? { v: 2, t: 'queue.remove', uid } : null
    }
    case 'queue.replace': {
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueTrackReplace)
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      return queue && currentIndex !== null ? { v: 2, t: 'queue.replace', queue, currentIndex } : null
    }
    case 'queue.meta': {
      const updates = parseArray(obj.updates, 50, parseMetaUpdate)
      return updates && updates.length > 0 ? { v: 2, t: 'queue.meta', updates } : null
    }
    case 'standby.open': {
      const profile = parseProfile(obj.profile)
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueInput)
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      if (!profile || !queue || currentIndex === null || typeof obj.allowGuestControl !== 'boolean') return null
      if (obj.allowGuestAdd !== undefined && typeof obj.allowGuestAdd !== 'boolean') return null
      const playback = obj.playback === null ? null : parsePlaybackInput(obj.playback)
      if (obj.playback !== null && playback === null) return null
      return {
        v: 2,
        t: 'standby.open',
        profile,
        queue,
        currentIndex,
        playback,
        allowGuestControl: obj.allowGuestControl,
        ...(obj.allowGuestAdd !== undefined ? { allowGuestAdd: obj.allowGuestAdd } : {}),
      }
    }
    case 'standby.update': {
      const queue = obj.queue === undefined ? undefined : parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueInput)
      if (queue === null) return null
      const currentIndex = obj.currentIndex === undefined ? undefined : int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      if (currentIndex === null) return null
      const playback = obj.playback === undefined ? undefined : obj.playback === null ? null : parsePlaybackInput(obj.playback)
      if (obj.playback !== undefined && obj.playback !== null && playback === null) return null
      return {
        v: 2,
        t: 'standby.update',
        ...(queue !== undefined ? { queue } : {}),
        ...(currentIndex !== undefined ? { currentIndex } : {}),
        ...(playback !== undefined ? { playback } : {}),
      }
    }
    case 'profile.update': {
      const profile = parseProfile(obj.profile)
      return profile ? { v: 2, t: 'profile.update', profile } : null
    }
    default:
      return null
  }
}

export function decodeServer(raw: string): ServerMsg | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(obj) || obj.v !== PROTOCOL_VERSION || typeof obj.t !== 'string') return null
  switch (obj.t) {
    case 'welcome': {
      const cid = str(obj.cid, 64)
      const serverTs = fin(obj.serverTs, 0, 1e16)
      return cid && serverTs !== null ? { v: 2, t: 'welcome', cid, serverTs } : null
    }
    case 'pong': {
      const clientTs = fin(obj.clientTs, 0, 1e16)
      const serverTs = fin(obj.serverTs, 0, 1e16)
      return clientTs !== null && serverTs !== null ? { v: 2, t: 'pong', clientTs, serverTs } : null
    }
    case 'room.joined': {
      if (obj.role !== 'host' && obj.role !== 'guest') return null
      const state = parseRoomSnapshot(obj.state)
      if (!state) return null
      const hostToken = str(obj.hostToken, 128) ?? undefined
      return { v: 2, t: 'room.joined', role: obj.role, ...(hostToken ? { hostToken } : {}), state }
    }
    case 'room.state': {
      const state = parseRoomSnapshot(obj.state)
      return state ? { v: 2, t: 'room.state', state } : null
    }
    case 'playback.tick': {
      const playback = parsePlaybackSnapshot(obj.playback)
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS)
      return playback && currentIndex !== null ? { v: 2, t: 'playback.tick', playback, currentIndex } : null
    }
    case 'playback.command': {
      const from = parseProfile(obj.from)
      const action = parseControlAction(obj.action)
      return from && action ? { v: 2, t: 'playback.command', from, action } : null
    }
    case 'room.ended': {
      if (obj.reason !== 'host_ended' && obj.reason !== 'host_timeout' && obj.reason !== 'kicked' && obj.reason !== 'banned') return null
      return { v: 2, t: 'room.ended', reason: obj.reason }
    }
    case 'standby.ready': {
      const standbyId = str(obj.standbyId, 64)
      return standbyId ? { v: 2, t: 'standby.ready', standbyId } : null
    }
    case 'standby.promoted': {
      const hostToken = str(obj.hostToken, 128)
      const state = parseRoomSnapshot(obj.state)
      return hostToken && state ? { v: 2, t: 'standby.promoted', hostToken, state } : null
    }
    case 'error': {
      const code = str(obj.code, 64)
      const message = optStr(obj.message, 256) ?? ''
      return code ? { v: 2, t: 'error', code, message } : null
    }
    default:
      return null
  }
}

export function decode(raw: string): Envelope | null {
  return decodeClient(raw) ?? decodeServer(raw)
}
