import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  CROCKFORD_ALPHABET,
  MAX_QUEUE_TRACKS,
  isRoomCode,
  isStandbyToken,
  normalizeCode,
  type AudioMode,
  type ClientMsg,
  type EndReason,
  type InsertPosition,
  type Participant,
  type PlaybackInput,
  type PlaybackSnapshot,
  type Profile,
  type QueueTrack,
  type QueueTrackInput,
  type ResolveSummary,
  type RoomSnapshot,
  type ServerMsg,
} from '../../plugins/lunajam/src/protocol'
import type { Config } from './config'

export interface Transport {
  now(): number
  peerIp?(cid: string): string | undefined
  send(cid: string, msg: ServerMsg): void
  broadcast(cids: Iterable<string>, msg: ServerMsg): void
}

interface PeerMeta {
  peerHash?: string
  ip?: string
}

interface Room {
  code: string
  hostCid: string
  hostToken: string
  allowGuestControl: boolean
  allowGuestAdd: boolean
  participants: Map<string, Participant>
  peerMeta: Map<string, PeerMeta>
  bannedPeerHashes: Set<string>
  bannedTidalUserIds: Set<string>
  bannedIps: Set<string>
  queue: QueueTrack[]
  currentIndex: number
  playback: PlaybackSnapshot | null
  lastActivity: number
  graceTimer: ReturnType<typeof setTimeout> | null
}

interface Standby {
  id: string
  cid: string
  profile: Profile
  queue: QueueTrackInput[]
  currentIndex: number
  playback: PlaybackSnapshot | null
  allowGuestControl: boolean
  allowGuestAdd: boolean
  updatedAt: number
}

function generateRoomCode(existing: ReadonlyMap<string, Room>): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = randomBytes(8)
    let out = ''
    for (let i = 0; i < 8; i++) out += CROCKFORD_ALPHABET[bytes[i]! % CROCKFORD_ALPHABET.length]
    if (!existing.has(out)) return out
  }
  return randomBytes(4).toString('hex').toUpperCase()
}

function generateStandbyId(): string {
  return `s_${randomBytes(9).toString('base64url')}`
}

function makeUid(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function withServerTs(playback: PlaybackInput | null, now: number): PlaybackSnapshot | null {
  if (!playback) return null
  return { ...playback, serverTs: now }
}

function hashPeerId(peerId?: string): string | undefined {
  if (!peerId) return undefined
  return createHash('sha256').update(peerId).digest('hex').slice(0, 24)
}

function safeTokenEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function toProfile(p: Profile, cid = p.cid): Profile {
  return {
    cid,
    name: p.name,
    avatarUrl: p.avatarUrl,
    ...(p.tidalUserId ? { tidalUserId: p.tidalUserId } : {}),
    ...(p.profilePath ? { profilePath: p.profilePath } : {}),
  }
}

function toRoomSnapshot(room: Room, includeToken = false): RoomSnapshot {
  return {
    code: room.code,
    hostCid: room.hostCid,
    ...(includeToken ? { hostToken: room.hostToken } : {}),
    allowGuestControl: room.allowGuestControl,
    allowGuestAdd: room.allowGuestAdd,
    participants: [...room.participants.values()],
    queue: room.queue,
    currentIndex: room.currentIndex,
    playback: room.playback,
  }
}

export class Rooms {
  private rooms = new Map<string, Room>()
  private connRoom = new Map<string, string>()
  private standbys = new Map<string, Standby>()
  private connStandby = new Map<string, string>()
  private promoted = new Map<string, { code: string; expiresAt: number }>()
  private roomCreates = new Map<string, { windowStart: number; count: number }>()
  private sweeper: ReturnType<typeof setInterval>

  constructor(
    private hub: Transport,
    private cfg: Config,
  ) {
    this.sweeper = setInterval(() => this.sweep(), Math.max(500, Math.min(30000, Math.floor(cfg.roomTtlMs / 4))))
    this.sweeper.unref()
  }

  stop(): void {
    clearInterval(this.sweeper)
    for (const room of this.rooms.values()) {
      if (room.graceTimer) clearTimeout(room.graceTimer)
    }
    this.rooms.clear()
    this.connRoom.clear()
    this.standbys.clear()
    this.connStandby.clear()
    this.promoted.clear()
    this.roomCreates.clear()
  }

  onMessage(cid: string, msg: ClientMsg): void {
    switch (msg.t) {
      case 'ping':
        this.hub.send(cid, { v: 2, t: 'pong', clientTs: msg.clientTs, serverTs: this.hub.now() })
        return
      case 'room.create':
        this.handleCreate(cid, msg)
        return
      case 'room.join':
        this.handleJoin(cid, msg)
        return
      case 'room.leave':
        this.leaveRoom(cid)
        return
      case 'room.end':
        this.handleEnd(cid)
        return
      case 'room.kick':
        this.handleKick(cid, msg.targetCid)
        return
      case 'room.kickAll':
        this.handleKickAll(cid)
        return
      case 'room.permissions':
        this.handlePermissions(cid, msg.allowGuestControl, msg.allowGuestAdd)
        return
      case 'room.memberPermission':
        this.handleMemberPermission(cid, msg.targetCid, msg.canAddTracks)
        return
      case 'room.mode':
        this.handleMode(cid, msg.audioMode)
        return
      case 'playback.sync':
        this.handlePlaybackSync(cid, msg.playback, msg.currentIndex)
        return
      case 'playback.control':
        this.handlePlaybackControl(cid, msg.action)
        return
      case 'queue.add':
        this.handleQueueAdd(cid, msg.tracks, msg.insert)
        return
      case 'queue.move':
        this.handleQueueMove(cid, msg.uid, msg.toIndex)
        return
      case 'queue.remove':
        this.handleQueueRemove(cid, msg.uid)
        return
      case 'queue.replace':
        this.handleQueueReplace(cid, msg.queue, msg.currentIndex)
        return
      case 'queue.meta':
        this.handleQueueMeta(cid, msg.updates)
        return
      case 'standby.open':
        this.handleStandbyOpen(cid, msg)
        return
      case 'standby.update':
        this.handleStandbyUpdate(cid, msg)
        return
      case 'standby.close':
        this.closeStandby(cid)
        return
      case 'profile.update':
        this.handleProfileUpdate(cid, msg.profile)
        return
    }
  }

  onDisconnect(cid: string): void {
    this.closeStandby(cid)
    this.roomCreates.delete(cid)
    const code = this.connRoom.get(cid)
    if (!code) return
    this.connRoom.delete(cid)
    const room = this.rooms.get(code)
    if (!room) return

    if (cid === room.hostCid) {
      if (room.graceTimer) clearTimeout(room.graceTimer)
      room.graceTimer = setTimeout(() => {
        room.graceTimer = null
        if (this.rooms.has(room.code)) this.destroyRoom(room.code, 'host_timeout')
      }, this.cfg.hostGraceMs)
      room.graceTimer.unref()
      return
    }

    if (room.participants.delete(cid)) {
      room.peerMeta.delete(cid)
      room.lastActivity = Date.now()
      this.broadcastState(room)
    }
  }

  resolveOrPromote(rawToken: string): ResolveSummary | null {
    const token = rawToken.trim()
    if (isRoomCode(token)) {
      const room = this.rooms.get(normalizeCode(token))
      return room ? this.summarizeRoom(token, room) : null
    }
    if (isStandbyToken(token)) {
      const cached = this.promoted.get(token)
      if (cached && cached.expiresAt > Date.now()) {
        const room = this.rooms.get(cached.code)
        if (room) return this.summarizeRoom(token, room)
      }
      const standby = this.standbys.get(token)
      if (!standby) return null
      const room = this.promoteStandby(standby)
      if (!room) return null
      this.promoted.set(token, { code: room.code, expiresAt: Date.now() + 60000 })
      return this.summarizeRoom(token, room)
    }
    return null
  }

  peekToken(rawToken: string): ResolveSummary | null {
    const token = rawToken.trim()
    if (isRoomCode(token)) {
      const room = this.rooms.get(normalizeCode(token))
      return room ? this.summarizeRoom(token, room) : null
    }
    if (isStandbyToken(token)) {
      const cached = this.promoted.get(token)
      if (cached && cached.expiresAt > Date.now()) {
        const room = this.rooms.get(cached.code)
        if (room) return this.summarizeRoom(token, room)
      }
      const standby = this.standbys.get(token)
      if (!standby) return null
      const active =
        standby.currentIndex >= 0 && standby.currentIndex < standby.queue.length
          ? standby.queue[standby.currentIndex]
          : null
      return {
        token,
        code: standby.id,
        hostName: standby.profile.name,
        participantCount: 1,
        maxParticipants: this.cfg.maxParticipants,
        track: active
          ? { title: active.title || 'Untitled', artist: active.artist || '', ...(active.coverUrl ? { coverUrl: active.coverUrl } : {}) }
          : null,
      }
    }
    return null
  }

  getRoomCount(): number {
    return this.rooms.size
  }

  private summarizeRoom(token: string, room: Room): ResolveSummary {
    const host = room.participants.get(room.hostCid)
    const active = room.currentIndex >= 0 && room.currentIndex < room.queue.length ? room.queue[room.currentIndex] : null
    return {
      token,
      code: room.code,
      hostName: host?.name ?? 'Host',
      participantCount: room.participants.size,
      maxParticipants: this.cfg.maxParticipants,
      track: active ? { title: active.title || 'Untitled', artist: active.artist || '', ...(active.coverUrl ? { coverUrl: active.coverUrl } : {}) } : null,
    }
  }

  private promoteStandby(standby: Standby): Room | null {
    if (this.rooms.size >= this.cfg.maxRooms) return null
    this.standbys.delete(standby.id)
    this.connStandby.delete(standby.cid)
    this.leaveRoom(standby.cid)

    const code = generateRoomCode(this.rooms)
    const hostToken = randomUUID()
    const profile: Profile = { ...standby.profile, cid: standby.cid }
    const queue: QueueTrack[] = standby.queue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      uid: makeUid(),
      addedBy: profile,
    }))
    const currentIndex = queue.length === 0 ? -1 : Math.max(-1, Math.min(queue.length - 1, standby.currentIndex))
    const activeTrack = currentIndex >= 0 ? queue[currentIndex] : undefined
    const playback = standby.playback
      ? { ...standby.playback, queueUid: activeTrack?.uid ?? standby.playback.queueUid, serverTs: this.hub.now() }
      : null

    const participants = new Map<string, Participant>()
    participants.set(standby.cid, { ...profile, role: 'host', audioMode: 'remote', canAddTracks: true })
    const peerMeta = new Map<string, PeerMeta>()
    const ip = this.hub.peerIp?.(standby.cid)
    if (ip) peerMeta.set(standby.cid, { ip })

    const room: Room = {
      code,
      hostCid: standby.cid,
      hostToken,
      allowGuestControl: standby.allowGuestControl,
      allowGuestAdd: standby.allowGuestAdd,
      participants,
      peerMeta,
      bannedPeerHashes: new Set(),
      bannedTidalUserIds: new Set(),
      bannedIps: new Set(),
      queue,
      currentIndex,
      playback,
      lastActivity: Date.now(),
      graceTimer: null,
    }
    this.rooms.set(code, room)
    this.connRoom.set(standby.cid, code)
    this.hub.send(standby.cid, {
      v: 2,
      t: 'standby.promoted',
      hostToken,
      state: toRoomSnapshot(room, true),
    })
    return room
  }

  private handleCreate(cid: string, msg: Extract<ClientMsg, { t: 'room.create' }>): void {
    this.closeStandby(cid)
    if (msg.code && msg.hostToken) {
      const existing = this.rooms.get(msg.code)
      if (existing && safeTokenEqual(existing.hostToken, msg.hostToken)) {
        if (existing.graceTimer) {
          clearTimeout(existing.graceTimer)
          existing.graceTimer = null
        }
        const prevHostCid = existing.hostCid
        existing.participants.delete(prevHostCid)
        existing.peerMeta.delete(prevHostCid)
        existing.hostCid = cid
        const hostProfile = toProfile(msg.profile, cid)
        existing.participants.set(cid, { ...hostProfile, role: 'host', audioMode: 'remote', canAddTracks: true })
        const hostIp = this.hub.peerIp?.(cid)
        if (hostIp) existing.peerMeta.set(cid, { ip: hostIp })
        for (const item of existing.queue) {
          if (item.addedBy.cid === prevHostCid) item.addedBy = hostProfile
        }
        this.connRoom.set(cid, existing.code)
        existing.lastActivity = Date.now()
        this.hub.send(cid, {
          v: 2,
          t: 'room.joined',
          role: 'host',
          hostToken: existing.hostToken,
          state: toRoomSnapshot(existing, true),
        })
        this.broadcastState(existing)
        return
      }
    }

    const now = Date.now()
    let createEntry = this.roomCreates.get(cid)
    if (!createEntry || now - createEntry.windowStart >= 60000) {
      createEntry = { windowStart: now, count: 0 }
      this.roomCreates.set(cid, createEntry)
    }
    createEntry.count += 1
    if (createEntry.count > Math.max(2, this.cfg.roomsPerConn)) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'room_rate_limit', message: 'Creating rooms too quickly' })
      return
    }

    if (this.rooms.size >= this.cfg.maxRooms) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'room_limit', message: 'Server room limit reached' })
      return
    }

    this.leaveRoom(cid)
    const code = generateRoomCode(this.rooms)
    const hostToken = randomUUID()
    const profile = toProfile(msg.profile, cid)
    const participants = new Map<string, Participant>()
    participants.set(cid, { ...profile, role: 'host', audioMode: 'remote', canAddTracks: true })
    const peerMeta = new Map<string, PeerMeta>()
    const ip = this.hub.peerIp?.(cid)
    if (ip) peerMeta.set(cid, { ip })
    const queue = msg.queue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      uid: t.uid || makeUid(),
      addedBy: profile,
    }))
    const currentIndex = queue.length === 0 ? -1 : Math.max(-1, Math.min(queue.length - 1, msg.currentIndex))
    const allowGuestAdd = msg.allowGuestAdd ?? true
    const room: Room = {
      code,
      hostCid: cid,
      hostToken,
      allowGuestControl: msg.allowGuestControl,
      allowGuestAdd,
      participants,
      peerMeta,
      bannedPeerHashes: new Set(),
      bannedTidalUserIds: new Set(),
      bannedIps: new Set(),
      queue,
      currentIndex,
      playback: withServerTs(msg.playback, this.hub.now()),
      lastActivity: Date.now(),
      graceTimer: null,
    }
    this.rooms.set(code, room)
    this.connRoom.set(cid, code)
    this.hub.send(cid, {
      v: 2,
      t: 'room.joined',
      role: 'host',
      hostToken,
      state: toRoomSnapshot(room, true),
    })
  }

  private handleJoin(cid: string, msg: Extract<ClientMsg, { t: 'room.join' }>): void {
    this.closeStandby(cid)
    const room = this.rooms.get(msg.code)
    if (!room) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'room_not_found', message: 'Jam session not found' })
      return
    }
    if (this.connRoom.get(cid) === room.code && room.participants.has(cid)) {
      this.hub.send(cid, { v: 2, t: 'room.joined', role: cid === room.hostCid ? 'host' : 'guest', state: toRoomSnapshot(room) })
      return
    }
    const peerHash = hashPeerId(msg.peerId)
    const ip = this.hub.peerIp?.(cid)
    const tidalUserId = msg.profile.tidalUserId
    if (
      (peerHash && room.bannedPeerHashes.has(peerHash)) ||
      (tidalUserId && room.bannedTidalUserIds.has(tidalUserId)) ||
      (ip && room.bannedIps.has(ip))
    ) {
      this.hub.send(cid, {
        v: 2,
        t: 'error',
        code: 'room_banned',
        message: 'You are banned from this Jam until a new room is created',
      })
      return
    }
    if (room.participants.size >= this.cfg.maxParticipants) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'room_full', message: 'Jam session is full' })
      return
    }
    this.leaveRoom(cid)
    const participant: Participant = {
      ...toProfile(msg.profile, cid),
      role: 'guest',
      audioMode: msg.audioMode,
      canAddTracks: room.allowGuestAdd,
    }
    room.participants.set(cid, participant)
    room.peerMeta.set(cid, { ...(peerHash ? { peerHash } : {}), ...(ip ? { ip } : {}) })
    room.lastActivity = Date.now()
    this.connRoom.set(cid, room.code)
    this.hub.send(cid, { v: 2, t: 'room.joined', role: 'guest', state: toRoomSnapshot(room) })
    this.broadcastState(room, cid)
  }

  private leaveRoom(cid: string): void {
    const code = this.connRoom.get(cid)
    if (!code) return
    this.connRoom.delete(cid)
    const room = this.rooms.get(code)
    if (!room) return
    if (cid === room.hostCid) {
      this.destroyRoom(code, 'host_ended')
      return
    }
    if (room.participants.delete(cid)) {
      room.peerMeta.delete(cid)
      room.lastActivity = Date.now()
      this.broadcastState(room)
    }
  }

  private handleEnd(cid: string): void {
    const room = this.hostRoom(cid)
    if (!room) return
    this.destroyRoom(room.code, 'host_ended')
  }

  private banFromRoom(room: Room, targetCid: string, target: Participant): void {
    const meta = room.peerMeta.get(targetCid)
    room.participants.delete(targetCid)
    room.peerMeta.delete(targetCid)
    this.connRoom.delete(targetCid)
    if (meta?.peerHash) room.bannedPeerHashes.add(meta.peerHash)
    if (target.tidalUserId) room.bannedTidalUserIds.add(target.tidalUserId)
    if (meta?.ip) {
      const sharedIp = [...room.peerMeta.values()].some((m) => m.ip === meta.ip)
      if (!sharedIp) room.bannedIps.add(meta.ip)
    }

    const isBannedTrack = (t: QueueTrack): boolean =>
      t.addedBy.cid === targetCid || Boolean(target.tidalUserId && t.addedBy.tidalUserId === target.tidalUserId)
    const prevQueue = room.queue
    const prevIdx = room.currentIndex
    const nextQueue = prevQueue.filter((t) => !isBannedTrack(t))
    if (nextQueue.length !== prevQueue.length) {
      if (nextQueue.length === 0) {
        room.queue = []
        room.currentIndex = -1
        room.playback = null
      } else {
        const prevActive = prevIdx >= 0 ? prevQueue[prevIdx] : undefined
        if (prevActive && !isBannedTrack(prevActive)) {
          room.queue = nextQueue
          room.currentIndex = nextQueue.findIndex((t) => t.uid === prevActive.uid)
        } else if (prevIdx < 0) {
          room.queue = nextQueue
          room.currentIndex = -1
        } else {
          const survivingBefore = prevQueue.slice(0, prevIdx).filter((t) => !isBannedTrack(t)).length
          const nextIdx = Math.min(survivingBefore, nextQueue.length - 1)
          const nextTrack = nextQueue[nextIdx]!
          room.queue = nextQueue
          room.currentIndex = nextIdx
          if (room.playback) {
            room.playback = {
              trackId: nextTrack.trackId,
              queueUid: nextTrack.uid,
              posMs: 0,
              serverTs: this.hub.now(),
              playing: room.playback.playing,
              ...(nextTrack.durationSec !== undefined ? { durationSec: nextTrack.durationSec } : {}),
            }
          }
        }
      }
    }
  }

  private handleKick(cid: string, targetCid: string): void {
    const room = this.hostRoom(cid)
    if (!room || targetCid === room.hostCid) return
    const target = room.participants.get(targetCid)
    if (!target) return
    this.banFromRoom(room, targetCid, target)
    room.lastActivity = Date.now()
    this.hub.send(targetCid, { v: 2, t: 'room.ended', reason: 'banned' })
    this.broadcastState(room)
  }

  private handleKickAll(cid: string): void {
    const room = this.hostRoom(cid)
    if (!room) return
    const removed: string[] = []
    for (const [pid, p] of [...room.participants.entries()]) {
      if (p.role === 'guest') {
        this.banFromRoom(room, pid, p)
        removed.push(pid)
      }
    }
    if (removed.length === 0) return
    room.lastActivity = Date.now()
    this.hub.broadcast(removed, { v: 2, t: 'room.ended', reason: 'banned' })
    this.broadcastState(room)
  }

  private handlePermissions(cid: string, allowGuestControl?: boolean, allowGuestAdd?: boolean): void {
    const room = this.hostRoom(cid)
    if (!room) return
    let changed = false
    if (allowGuestControl !== undefined && room.allowGuestControl !== allowGuestControl) {
      room.allowGuestControl = allowGuestControl
      changed = true
    }
    if (allowGuestAdd !== undefined && room.allowGuestAdd !== allowGuestAdd) {
      room.allowGuestAdd = allowGuestAdd
      for (const p of room.participants.values()) {
        if (p.role === 'guest') p.canAddTracks = allowGuestAdd
      }
      changed = true
    }
    if (!changed) return
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleMemberPermission(cid: string, targetCid: string, canAddTracks: boolean): void {
    const room = this.hostRoom(cid)
    if (!room || targetCid === room.hostCid) return
    const target = room.participants.get(targetCid)
    if (!target || target.role !== 'guest' || target.canAddTracks === canAddTracks) return
    target.canAddTracks = canAddTracks
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleMode(cid: string, audioMode: AudioMode): void {
    const room = this.memberRoom(cid)
    if (!room) return
    const p = room.participants.get(cid)
    if (!p || p.audioMode === audioMode) return
    p.audioMode = audioMode
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handlePlaybackSync(cid: string, playback: PlaybackInput, currentIndex: number): void {
    const room = this.hostRoom(cid)
    if (!room) return
    room.playback = withServerTs(playback, this.hub.now())
    if (room.queue.length > 0 && currentIndex >= -1 && currentIndex < room.queue.length) {
      room.currentIndex = currentIndex
    }
    room.lastActivity = Date.now()
    if (room.participants.size <= 1 || !room.playback) return
    const recipients = [...room.participants.keys()].filter((pid) => pid !== cid)
    if (recipients.length > 0) {
      this.hub.broadcast(recipients, {
        v: 2,
        t: 'playback.tick',
        playback: room.playback,
        currentIndex: room.currentIndex,
      })
    }
  }

  private handlePlaybackControl(cid: string, action: Extract<ClientMsg, { t: 'playback.control' }>['action']): void {
    const room = this.memberRoom(cid)
    if (!room) return
    const isHost = cid === room.hostCid
    if (!isHost && !room.allowGuestControl) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'forbidden', message: 'Host restricted playback controls' })
      return
    }
    const sender = room.participants.get(cid)
    if (!sender) return
    room.lastActivity = Date.now()
    if (!isHost) {
      this.hub.send(room.hostCid, { v: 2, t: 'playback.command', from: sender, action })
    }
  }

  private handleQueueAdd(cid: string, tracks: QueueTrackInput[], insert: InsertPosition): void {
    const room = this.memberRoom(cid)
    if (!room) return
    const sender = room.participants.get(cid)
    if (!sender) return
    if (sender.role !== 'host' && !sender.canAddTracks) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'add_forbidden', message: 'Host disabled adding tracks for you' })
      return
    }
    if (room.queue.length >= MAX_QUEUE_TRACKS) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'queue_full', message: 'Queue limit reached' })
      return
    }
    const available = MAX_QUEUE_TRACKS - room.queue.length
    const senderProfile = toProfile(sender)
    const additions: QueueTrack[] = tracks.slice(0, available).map((t) => ({
      ...t,
      uid: makeUid(),
      addedBy: senderProfile,
    }))
    let idx: number
    if (insert === 'next') {
      idx = room.currentIndex >= 0 ? Math.min(room.queue.length, room.currentIndex + 1) : 0
    } else if (insert === 'last') {
      idx = room.queue.length
    } else {
      idx = Math.max(0, Math.min(room.queue.length, insert))
    }
    room.queue.splice(idx, 0, ...additions)
    if (room.currentIndex >= idx) {
      room.currentIndex += additions.length
    } else if (room.currentIndex === -1 && room.queue.length > 0) {
      room.currentIndex = 0
    }
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleQueueMove(cid: string, uid: string, toIndex: number): void {
    const room = this.memberRoom(cid)
    if (!room) return
    if (cid !== room.hostCid && !room.allowGuestControl) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'forbidden', message: 'Host restricted queue reordering' })
      return
    }
    const fromIndex = room.queue.findIndex((t) => t.uid === uid)
    if (fromIndex === -1) return
    const clampedTo = Math.max(0, Math.min(room.queue.length - 1, toIndex))
    if (fromIndex === clampedTo) return
    const activeUid = room.currentIndex >= 0 ? room.queue[room.currentIndex]?.uid : undefined
    const [moved] = room.queue.splice(fromIndex, 1)
    if (!moved) return
    room.queue.splice(clampedTo, 0, moved)
    if (activeUid) {
      room.currentIndex = room.queue.findIndex((t) => t.uid === activeUid)
    }
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleQueueRemove(cid: string, uid: string): void {
    const room = this.memberRoom(cid)
    if (!room) return
    const idx = room.queue.findIndex((t) => t.uid === uid)
    if (idx === -1) return
    const target = room.queue[idx]!
    const canRemove = cid === room.hostCid || room.allowGuestControl || target.addedBy.cid === cid
    if (!canRemove) {
      this.hub.send(cid, { v: 2, t: 'error', code: 'forbidden', message: 'Cannot remove track added by another listener' })
      return
    }
    room.queue.splice(idx, 1)
    if (room.queue.length === 0) {
      room.currentIndex = -1
    } else if (idx < room.currentIndex) {
      room.currentIndex -= 1
    } else if (idx === room.currentIndex && room.currentIndex >= room.queue.length) {
      room.currentIndex = room.queue.length - 1
    }
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleQueueReplace(cid: string, nextQueue: Extract<ClientMsg, { t: 'queue.replace' }>['queue'], currentIndex: number): void {
    const room = this.hostRoom(cid)
    if (!room) return
    const host = room.participants.get(cid)
    if (!host) return
    const hostProfile = toProfile(host)
    const existingByUid = new Map(room.queue.map((t) => [t.uid, t.addedBy]))
    room.queue = nextQueue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      addedBy: existingByUid.get(t.uid) ?? hostProfile,
    }))
    room.currentIndex = room.queue.length === 0 ? -1 : Math.max(-1, Math.min(room.queue.length - 1, currentIndex))
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private handleQueueMeta(cid: string, updates: Extract<ClientMsg, { t: 'queue.meta' }>['updates']): void {
    const room = this.memberRoom(cid)
    if (!room) return
    const sender = room.participants.get(cid)
    if (!sender) return
    const restrictOwn = sender.role !== 'host' && !sender.canAddTracks
    const byId = new Map(updates.map((u) => [u.trackId, u]))
    let changed = false
    for (const item of room.queue) {
      if (restrictOwn && item.addedBy.cid !== cid) continue
      const u = byId.get(item.trackId)
      if (!u) continue
      if (!item.title && u.title) {
        item.title = u.title
        changed = true
      }
      if (!item.artist && u.artist) {
        item.artist = u.artist
        changed = true
      }
      if (!item.album && u.album) {
        item.album = u.album
        changed = true
      }
      if (!item.coverUrl && u.coverUrl) {
        item.coverUrl = u.coverUrl
        changed = true
      }
      if (item.durationSec === undefined && u.durationSec !== undefined) {
        item.durationSec = u.durationSec
        changed = true
      }
    }
    if (changed) {
      room.lastActivity = Date.now()
      this.broadcastState(room)
    }
  }

  private handleStandbyOpen(cid: string, msg: Extract<ClientMsg, { t: 'standby.open' }>): void {
    if (this.connRoom.has(cid)) return
    const existingId = this.connStandby.get(cid)
    if (!existingId && this.standbys.size >= this.cfg.maxRooms * 2) return
    const id = existingId ?? generateStandbyId()
    const standby: Standby = {
      id,
      cid,
      profile: toProfile(msg.profile, cid),
      queue: msg.queue.slice(0, MAX_QUEUE_TRACKS),
      currentIndex: msg.currentIndex,
      playback: withServerTs(msg.playback, this.hub.now()),
      allowGuestControl: msg.allowGuestControl,
      allowGuestAdd: msg.allowGuestAdd ?? true,
      updatedAt: Date.now(),
    }
    this.standbys.set(id, standby)
    this.connStandby.set(cid, id)
    this.hub.send(cid, { v: 2, t: 'standby.ready', standbyId: id })
  }

  private handleStandbyUpdate(cid: string, msg: Extract<ClientMsg, { t: 'standby.update' }>): void {
    const id = this.connStandby.get(cid)
    if (!id) return
    const standby = this.standbys.get(id)
    if (!standby) return
    if (msg.queue !== undefined) standby.queue = msg.queue.slice(0, MAX_QUEUE_TRACKS)
    if (msg.currentIndex !== undefined) standby.currentIndex = msg.currentIndex
    if (msg.playback !== undefined) standby.playback = withServerTs(msg.playback, this.hub.now())
    standby.updatedAt = Date.now()
  }

  private closeStandby(cid: string): void {
    const id = this.connStandby.get(cid)
    if (!id) return
    this.connStandby.delete(cid)
    this.standbys.delete(id)
  }

  private handleProfileUpdate(cid: string, rawProfile: Profile): void {
    const next = toProfile(rawProfile, cid)
    const standbyId = this.connStandby.get(cid)
    if (standbyId) {
      const standby = this.standbys.get(standbyId)
      if (standby) standby.profile = next
    }
    const room = this.memberRoom(cid)
    if (!room) return
    const participant = room.participants.get(cid)
    if (!participant) return
    if (participant.role === 'guest' && next.tidalUserId && room.bannedTidalUserIds.has(next.tidalUserId)) {
      this.banFromRoom(room, cid, participant)
      this.hub.send(cid, { v: 2, t: 'room.ended', reason: 'banned' })
      this.broadcastState(room)
      return
    }
    const changed =
      participant.name !== next.name ||
      participant.avatarUrl !== next.avatarUrl ||
      participant.tidalUserId !== next.tidalUserId ||
      participant.profilePath !== next.profilePath
    if (!changed) return
    room.participants.set(cid, {
      ...next,
      role: participant.role,
      audioMode: participant.audioMode,
      canAddTracks: participant.canAddTracks,
    })
    for (const item of room.queue) {
      if (item.addedBy.cid === cid) item.addedBy = next
    }
    room.lastActivity = Date.now()
    this.broadcastState(room)
  }

  private hostRoom(cid: string): Room | null {
    const code = this.connRoom.get(cid)
    if (!code) return null
    const room = this.rooms.get(code)
    if (!room || room.hostCid !== cid) return null
    return room
  }

  private memberRoom(cid: string): Room | null {
    const code = this.connRoom.get(cid)
    if (!code) return null
    return this.rooms.get(code) ?? null
  }

  private broadcastState(room: Room, excludeCid?: string): void {
    const recipients = [...room.participants.keys()].filter((id) => id !== excludeCid)
    if (recipients.length === 0) return
    this.hub.broadcast(recipients, { v: 2, t: 'room.state', state: toRoomSnapshot(room) })
  }

  private destroyRoom(code: string, reason: EndReason): void {
    const room = this.rooms.get(code)
    if (!room) return
    if (room.graceTimer) clearTimeout(room.graceTimer)
    this.rooms.delete(code)
    const recipients: string[] = []
    for (const pid of room.participants.keys()) {
      this.connRoom.delete(pid)
      recipients.push(pid)
    }
    if (recipients.length > 0) {
      this.hub.broadcast(recipients, { v: 2, t: 'room.ended', reason })
    }
  }

  private sweep(): void {
    const now = Date.now()
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivity > this.cfg.roomTtlMs) {
        this.destroyRoom(room.code, 'host_timeout')
      }
    }
    for (const [token, entry] of this.promoted) {
      if (entry.expiresAt <= now) this.promoted.delete(token)
    }
    for (const [id, sb] of this.standbys) {
      if (now - sb.updatedAt > this.cfg.roomTtlMs) {
        this.standbys.delete(id)
        this.connStandby.delete(sb.cid)
      }
    }
    for (const [cid, entry] of this.roomCreates) {
      if (now - entry.windowStart >= 60000) this.roomCreates.delete(cid)
    }
  }
}
