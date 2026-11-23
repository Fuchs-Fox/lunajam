import {
  DEFAULT_SERVER_URL,
  decodeServer,
  encode,
  isStandbyToken,
  normalizeCode,
  parseJoinTarget,
  sanitizeBaseUrl,
  type AudioMode,
  type ClientMsg,
  type ControlAction,
  type EndReason,
  type InsertPosition,
  type PlaybackInput,
  type PlaybackSnapshot,
  type Profile,
  type QueueTrack,
  type QueueTrackInput,
  type QueueTrackReplace,
  type ResolveSummary,
  type Role,
  type RoomSnapshot,
  type ServerMsg,
  type TrackMetaUpdate,
} from '../protocol'
import { ClockSync } from '../sync/clock'
import { normalizeServerUrl, wsUrlFromServer } from './settings'

export interface WsLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number): void
  addEventListener?(type: string, listener: (ev: { data?: unknown }) => void): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev?: { code?: number; reason?: string }) => void) | null
  onerror: ((ev: unknown) => void) | null
}

export type SessionStatus = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'ended'

export interface SessionState {
  status: SessionStatus
  role: Role | null
  cid: string | null
  standbyId: string | null
  room: RoomSnapshot | null
  audioMode: AudioMode
  endReason: EndReason | null
  error: string | null
  serverUrl: string
}

export type CommandHandler = (from: Profile, action: ControlAction) => void
export type TickHandler = (playback: PlaybackSnapshot, currentIndex: number) => void
export type PromotedHandler = (room: RoomSnapshot) => void

type PendingIntent =
  | {
      kind: 'create'
      profile: Profile
      allowGuestControl: boolean
      allowGuestAdd: boolean
      queue: QueueTrack[]
      currentIndex: number
      playback: PlaybackInput | null
      code?: string
      hostToken?: string
    }
  | {
      kind: 'join'
      code: string
      profile: Profile
      audioMode: AudioMode
      peerId?: string
    }
  | {
      kind: 'standby'
      profile: Profile
      queue: QueueTrackInput[]
      currentIndex: number
      playback: PlaybackInput | null
      allowGuestControl: boolean
      allowGuestAdd: boolean
    }

const WS_OPEN = 1

export class SessionClient {
  readonly clock = new ClockSync()
  private ws: WsLike | null = null
  private wsUrl = ''
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private burstTimers: ReturnType<typeof setTimeout>[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private hostToken: string | null = null
  private intent: PendingIntent | null = null
  private disposed = false

  private stateListeners = new Set<(state: SessionState) => void>()
  private commandListeners = new Set<CommandHandler>()
  private tickListeners = new Set<TickHandler>()
  private promotedListeners = new Set<PromotedHandler>()

  private state: SessionState = {
    status: 'idle',
    role: null,
    cid: null,
    standbyId: null,
    room: null,
    audioMode: 'remote',
    endReason: null,
    error: null,
    serverUrl: DEFAULT_SERVER_URL,
  }

  constructor(
    private wsFactory: (url: string) => WsLike = (url) => new WebSocket(url) as unknown as WsLike,
    private fetchFn: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  snapshot(): SessionState {
    return this.state
  }

  subscribe(cb: (state: SessionState) => void): () => void {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  onCommand(cb: CommandHandler): () => void {
    this.commandListeners.add(cb)
    return () => this.commandListeners.delete(cb)
  }

  onTick(cb: TickHandler): () => void {
    this.tickListeners.add(cb)
    return () => this.tickListeners.delete(cb)
  }

  onPromoted(cb: PromotedHandler): () => void {
    this.promotedListeners.add(cb)
    return () => this.promotedListeners.delete(cb)
  }

  createRoom(opts: {
    serverUrl: string
    profile: Profile
    allowGuestControl: boolean
    allowGuestAdd?: boolean
    queue: QueueTrack[]
    currentIndex: number
    playback: PlaybackInput | null
  }): void {
    const serverUrl = normalizeServerUrl(opts.serverUrl)
    this.clearReconnect()
    this.hostToken = null
    this.intent = {
      kind: 'create',
      profile: opts.profile,
      allowGuestControl: opts.allowGuestControl,
      allowGuestAdd: opts.allowGuestAdd ?? true,
      queue: opts.queue,
      currentIndex: opts.currentIndex,
      playback: opts.playback,
    }
    this.updateState({
      status: 'connecting',
      role: 'host',
      room: null,
      standbyId: null,
      endReason: null,
      error: null,
      audioMode: 'remote',
      serverUrl,
    })
    this.ensureSocket(serverUrl)
  }

  async joinRoom(opts: {
    input: string
    serverUrl: string
    profile: Profile
    audioMode: AudioMode
    peerId?: string
  }): Promise<boolean> {
    const parsed = parseJoinTarget(opts.input)
    if (!parsed) {
      this.updateState({ error: 'Invalid room code or invite link' })
      return false
    }
    const configuredUrl = normalizeServerUrl(opts.serverUrl)
    const trustedServers = new Set<string>([DEFAULT_SERVER_URL, 'https://jam.sn0w13.de', configuredUrl])
    if (parsed.serverUrl !== undefined) {
      const candidate = sanitizeBaseUrl(parsed.serverUrl)
      if (!candidate || !trustedServers.has(candidate)) {
        this.updateState({
          status: 'idle',
          error: 'Invite link uses an untrusted Jam server. Change Server URL in Settings first.',
        })
        return false
      }
    }
    const serverUrl = normalizeServerUrl(parsed.serverUrl ?? configuredUrl)
    this.clearReconnect()
    this.hostToken = null
    let code = parsed.token

    if (isStandbyToken(code)) {
      this.updateState({ status: 'connecting', error: null, endReason: null, serverUrl })
      try {
        const res = await this.fetchFn(`${serverUrl}/api/resolve/${encodeURIComponent(code)}`)
        if (!res.ok) {
          this.updateState({ status: 'idle', error: 'Session is no longer active' })
          return false
        }
        const summary = (await res.json()) as ResolveSummary
        code = normalizeCode(summary.code)
      } catch {
        this.updateState({ status: 'idle', error: 'Could not reach relay server' })
        return false
      }
    }

    this.intent = {
      kind: 'join',
      code: normalizeCode(code),
      profile: opts.profile,
      audioMode: opts.audioMode,
      ...(opts.peerId ? { peerId: opts.peerId } : {}),
    }
    this.updateState({
      status: 'connecting',
      role: 'guest',
      room: null,
      standbyId: null,
      endReason: null,
      error: null,
      audioMode: opts.audioMode,
      serverUrl,
    })
    this.ensureSocket(serverUrl)
    return true
  }

  openStandby(opts: {
    serverUrl: string
    profile: Profile
    queue: QueueTrackInput[]
    currentIndex: number
    playback: PlaybackInput | null
    allowGuestControl: boolean
    allowGuestAdd?: boolean
  }): void {
    if (this.state.room || this.state.status === 'connecting' || this.state.status === 'reconnecting') return
    const serverUrl = normalizeServerUrl(opts.serverUrl)
    this.intent = {
      kind: 'standby',
      profile: opts.profile,
      queue: opts.queue,
      currentIndex: opts.currentIndex,
      playback: opts.playback,
      allowGuestControl: opts.allowGuestControl,
      allowGuestAdd: opts.allowGuestAdd ?? true,
    }
    if (this.state.serverUrl !== serverUrl) {
      this.updateState({ serverUrl, standbyId: null })
    }
    if (this.ws && this.ws.readyState === WS_OPEN && this.wsUrl === wsUrlFromServer(serverUrl)) {
      this.send({
        v: 2,
        t: 'standby.open',
        profile: opts.profile,
        queue: opts.queue,
        currentIndex: opts.currentIndex,
        playback: opts.playback,
        allowGuestControl: opts.allowGuestControl,
        allowGuestAdd: opts.allowGuestAdd ?? true,
      })
      return
    }
    this.ensureSocket(serverUrl)
  }

  updateStandby(opts: { queue?: QueueTrackInput[]; currentIndex?: number; playback?: PlaybackInput | null }): void {
    if (this.state.room || !this.state.standbyId) return
    if (this.intent?.kind === 'standby') {
      if (opts.queue !== undefined) this.intent.queue = opts.queue
      if (opts.currentIndex !== undefined) this.intent.currentIndex = opts.currentIndex
      if (opts.playback !== undefined) this.intent.playback = opts.playback
    }
    this.send({ v: 2, t: 'standby.update', ...opts })
  }

  closeStandby(): void {
    if (this.intent?.kind === 'standby') this.intent = null
    if (this.state.standbyId) {
      this.send({ v: 2, t: 'standby.close' })
      this.updateState({ standbyId: null })
    }
    if (!this.state.room && this.state.status === 'idle') {
      this.teardownSocket()
    }
  }

  leaveRoom(): void {
    this.clearReconnect()
    this.intent = null
    this.hostToken = null
    if (this.state.room) this.send({ v: 2, t: 'room.leave' })
    this.updateState({
      status: 'idle',
      role: null,
      room: null,
      standbyId: null,
      endReason: null,
      error: null,
    })
    this.teardownSocket()
  }

  endRoom(): void {
    this.clearReconnect()
    this.intent = null
    this.hostToken = null
    if (this.state.room && this.state.role === 'host') this.send({ v: 2, t: 'room.end' })
    this.updateState({
      status: 'idle',
      role: null,
      room: null,
      standbyId: null,
      endReason: null,
      error: null,
    })
    this.teardownSocket()
  }

  kick(targetCid: string): void {
    this.send({ v: 2, t: 'room.kick', targetCid })
  }

  kickAll(): void {
    this.send({ v: 2, t: 'room.kickAll' })
  }

  setPermissions(patch: { allowGuestControl?: boolean; allowGuestAdd?: boolean }): void {
    if (this.state.role !== 'host') return
    if (patch.allowGuestControl === undefined && patch.allowGuestAdd === undefined) return
    this.send({ v: 2, t: 'room.permissions', ...patch })
    if (this.state.room) {
      const nextRoom: RoomSnapshot = {
        ...this.state.room,
        ...(patch.allowGuestControl !== undefined ? { allowGuestControl: patch.allowGuestControl } : {}),
        ...(patch.allowGuestAdd !== undefined
          ? {
              allowGuestAdd: patch.allowGuestAdd,
              participants: this.state.room.participants.map((p) =>
                p.role === 'host' ? p : { ...p, canAddTracks: patch.allowGuestAdd! },
              ),
            }
          : {}),
      }
      this.updateState({ room: nextRoom })
    }
  }

  setMemberCanAdd(targetCid: string, canAddTracks: boolean): void {
    if (this.state.role !== 'host') return
    this.send({ v: 2, t: 'room.memberPermission', targetCid, canAddTracks })
    if (this.state.room) {
      this.updateState({
        room: {
          ...this.state.room,
          participants: this.state.room.participants.map((p) =>
            p.cid === targetCid ? { ...p, canAddTracks } : p,
          ),
        },
      })
    }
  }

  setAudioMode(audioMode: AudioMode): void {
    this.updateState({ audioMode })
    if (this.intent?.kind === 'join') this.intent.audioMode = audioMode
    if (this.state.room) {
      this.send({ v: 2, t: 'room.mode', audioMode })
    }
  }

  syncPlayback(playback: PlaybackInput, currentIndex: number): void {
    if (this.state.role !== 'host' || !this.state.room) return
    this.send({ v: 2, t: 'playback.sync', playback, currentIndex })
  }

  sendControl(action: ControlAction): void {
    if (!this.state.room) return
    this.send({ v: 2, t: 'playback.control', action })
  }

  addTracks(tracks: QueueTrackInput[], insert: InsertPosition = 'last'): void {
    if (!this.state.room || tracks.length === 0) return
    this.send({ v: 2, t: 'queue.add', tracks, insert })
  }

  moveTrack(uid: string, toIndex: number): void {
    if (!this.state.room) return
    this.send({ v: 2, t: 'queue.move', uid, toIndex })
  }

  removeTrack(uid: string): void {
    if (!this.state.room) return
    this.send({ v: 2, t: 'queue.remove', uid })
  }

  replaceQueue(queue: QueueTrackReplace[], currentIndex: number): void {
    if (!this.state.room || this.state.role !== 'host') return
    this.send({ v: 2, t: 'queue.replace', queue, currentIndex })
  }

  sendMetaUpdates(updates: TrackMetaUpdate[]): void {
    if (!this.state.room || updates.length === 0) return
    this.send({ v: 2, t: 'queue.meta', updates })
  }

  updateProfile(profile: Profile): void {
    if (this.intent) this.intent.profile = profile
    if (this.state.room || this.state.standbyId) {
      this.send({ v: 2, t: 'profile.update', profile })
    }
  }

  clearNotice(): void {
    if (this.state.error || this.state.status === 'ended') {
      this.updateState({
        error: null,
        ...(this.state.status === 'ended' ? { status: 'idle', endReason: null } : {}),
      })
    }
  }

  dispose(): void {
    this.disposed = true
    this.clearReconnect()
    this.intent = null
    this.teardownSocket()
    this.stateListeners.clear()
    this.commandListeners.clear()
    this.tickListeners.clear()
    this.promotedListeners.clear()
  }

  private ensureSocket(serverUrl: string): void {
    const targetWs = wsUrlFromServer(serverUrl)
    if (this.ws && this.wsUrl === targetWs && (this.ws.readyState === 0 || this.ws.readyState === WS_OPEN)) {
      if (this.ws.readyState === WS_OPEN) this.dispatchIntent()
      return
    }
    this.teardownSocket()
    this.clock.reset()
    this.wsUrl = targetWs
    const ws = this.wsFactory(targetWs)
    this.ws = ws
    ws.onopen = () => {
      if (this.ws !== ws) return
      this.startPings()
      this.dispatchIntent()
    }
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return
      const raw = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
      const msg = decodeServer(raw)
      if (msg) this.handleServer(msg)
    }
    ws.onerror = () => {
      if (this.ws !== ws) return
      if (!this.state.room && this.state.status === 'connecting') {
        this.updateState({ error: 'Could not reach relay server' })
      }
    }
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.stopPings()
      this.ws = null
      this.wsUrl = ''
      if (this.disposed) return
      const code = typeof ev?.code === 'number' ? ev.code : 1006
      if (!this.state.room && (code === 1009 || code === 1008 || code === 1003 || this.reconnectAttempt >= 6)) {
        this.clearReconnect()
        this.intent = null
        this.hostToken = null
        this.updateState({
          status: 'idle',
          role: null,
          error: code === 1009 ? 'Queue payload exceeded server limit' : 'Could not connect to Jam server',
        })
        return
      }
      if (this.state.room && this.intent && this.intent.kind !== 'standby') {
        this.scheduleReconnect()
      } else if (this.intent?.kind === 'create' || this.intent?.kind === 'join') {
        this.scheduleReconnect()
      } else {
        this.updateState({ standbyId: null })
      }
    }
  }

  private dispatchIntent(): void {
    const intent = this.intent
    if (!intent) return
    if (intent.kind === 'create') {
      this.send({
        v: 2,
        t: 'room.create',
        profile: intent.profile,
        allowGuestControl: intent.allowGuestControl,
        allowGuestAdd: intent.allowGuestAdd,
        queue: intent.queue,
        currentIndex: intent.currentIndex,
        playback: intent.playback,
        ...(intent.code && intent.hostToken ? { code: intent.code, hostToken: intent.hostToken } : {}),
      })
      return
    }
    if (intent.kind === 'join') {
      this.send({
        v: 2,
        t: 'room.join',
        code: intent.code,
        profile: intent.profile,
        audioMode: intent.audioMode,
        ...(intent.peerId ? { peerId: intent.peerId } : {}),
      })
      return
    }
    if (intent.kind === 'standby') {
      this.send({
        v: 2,
        t: 'standby.open',
        profile: intent.profile,
        queue: intent.queue,
        currentIndex: intent.currentIndex,
        playback: intent.playback,
        allowGuestControl: intent.allowGuestControl,
        allowGuestAdd: intent.allowGuestAdd,
      })
    }
  }

  private handleServer(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.updateState({ cid: msg.cid })
        return
      case 'pong':
        this.clock.addSample(msg.clientTs, msg.serverTs)
        return
      case 'room.joined':
        this.reconnectAttempt = 0
        if (msg.hostToken) this.hostToken = msg.hostToken
        if (msg.role === 'host' && this.hostToken) {
          const prevProfile = this.intent?.kind === 'create' ? this.intent.profile : { cid: msg.state.hostCid, name: 'Host', avatarUrl: null }
          this.intent = {
            kind: 'create',
            profile: prevProfile,
            allowGuestControl: msg.state.allowGuestControl,
            allowGuestAdd: msg.state.allowGuestAdd,
            queue: msg.state.queue,
            currentIndex: msg.state.currentIndex,
            playback: msg.state.playback,
            code: msg.state.code,
            hostToken: this.hostToken,
          }
        }
        this.updateState({
          status: 'connected',
          role: msg.role,
          room: msg.state,
          standbyId: null,
          endReason: null,
          error: null,
        })
        return
      case 'room.state':
        this.reconnectAttempt = 0
        this.updateState({
          status: 'connected',
          room: msg.state,
          error: null,
        })
        return
      case 'playback.tick':
        if (this.state.room) {
          const prevPb = this.state.room.playback
          const prevIdx = this.state.room.currentIndex
          this.state = {
            ...this.state,
            room: {
              ...this.state.room,
              playback: msg.playback,
              currentIndex: msg.currentIndex,
            },
          }
          for (const cb of this.tickListeners) cb(msg.playback, msg.currentIndex)
          const changedMeta =
            prevIdx !== msg.currentIndex ||
            prevPb?.trackId !== msg.playback.trackId ||
            prevPb?.queueUid !== msg.playback.queueUid ||
            prevPb?.playing !== msg.playback.playing
          if (changedMeta) this.emitState()
        }
        return
      case 'playback.command':
        for (const cb of this.commandListeners) cb(msg.from, msg.action)
        return
      case 'room.ended':
        this.clearReconnect()
        this.intent = null
        this.hostToken = null
        this.updateState({
          status: 'ended',
          role: null,
          room: null,
          standbyId: null,
          endReason: msg.reason,
        })
        this.teardownSocket()
        return
      case 'standby.ready':
        this.reconnectAttempt = 0
        this.updateState({ standbyId: msg.standbyId })
        return
      case 'standby.promoted':
        this.reconnectAttempt = 0
        this.hostToken = msg.hostToken
        this.intent = {
          kind: 'create',
          profile: msg.state.participants[0] ?? { cid: msg.state.hostCid, name: 'Host', avatarUrl: null },
          allowGuestControl: msg.state.allowGuestControl,
          allowGuestAdd: msg.state.allowGuestAdd,
          queue: msg.state.queue,
          currentIndex: msg.state.currentIndex,
          playback: msg.state.playback,
          code: msg.state.code,
          hostToken: msg.hostToken,
        }
        this.updateState({
          status: 'connected',
          role: 'host',
          room: msg.state,
          standbyId: null,
          endReason: null,
          error: null,
          audioMode: 'remote',
        })
        for (const cb of this.promotedListeners) cb(msg.state)
        return
      case 'error':
        if (this.state.status === 'connecting' && !this.state.room) {
          this.intent = null
          this.updateState({ status: 'idle', role: null, error: msg.message || msg.code })
          this.teardownSocket()
        } else {
          this.updateState({ error: msg.message || msg.code })
        }
        return
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    const delay = Math.min(5000, 600 * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    if (this.intent?.kind === 'create' && this.state.room && this.hostToken) {
      this.intent.code = this.state.room.code
      this.intent.hostToken = this.hostToken
      this.intent.queue = this.state.room.queue
      this.intent.currentIndex = this.state.room.currentIndex
      this.intent.playback = this.state.room.playback
    }
    this.updateState({ status: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.disposed && this.intent) {
        this.ensureSocket(this.state.serverUrl)
      }
    }, delay)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
  }

  private startPings(): void {
    this.stopPings()
    const sendPing = () => this.send({ v: 2, t: 'ping', clientTs: performance.now() })
    sendPing()
    for (const delay of [150, 350, 650]) {
      this.burstTimers.push(setTimeout(sendPing, delay))
    }
    this.pingTimer = setInterval(sendPing, 10000)
  }

  private stopPings(): void {
    for (const t of this.burstTimers) clearTimeout(t)
    this.burstTimers = []
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return
    this.ws.send(encode(msg))
  }

  private teardownSocket(): void {
    this.stopPings()
    const ws = this.ws
    this.ws = null
    this.wsUrl = ''
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      try {
        ws.close(1000)
      } catch {
        return
      }
    }
  }

  private updateState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch }
    this.emitState()
  }

  private emitState(): void {
    for (const cb of this.stateListeners) cb(this.state)
  }
}
