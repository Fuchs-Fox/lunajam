import type { LunaUnload } from '@luna/core'
import { MediaItem, PlayState, redux } from '@luna/lib'
import type { AudioMode, ControlAction, PlaybackInput, PlaybackSnapshot, QueueTrack, Role } from '../protocol'
import type { ClockSync } from '../sync/clock'
import { DriftController } from '../sync/drift'
import { ensureTrackInStore, isTrackInStore, toNativeItemId } from './metadata'

const HOST_PLAYBACK_ACTIONS: redux.ActionType[] = [
  'playbackControls/PLAY',
  'playbackControls/PAUSE',
  'playbackControls/TOGGLE_PLAYBACK',
]

export class TidalPlaybackBridge {
  private selfOps = 0
  private drift = new DriftController()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastTrackId: string | null = null
  private pendingLoadTrackId: string | null = null
  private pendingLoadAt = 0
  private needsInitialSeekForTrack: string | null = null
  private disposed = false

  constructor(
    unloads: Set<LunaUnload>,
    private hooks: {
      isActive: () => boolean
      getRole: () => Role | null
      getAudioMode: () => AudioMode
      canGuestControl: () => boolean
      getQueueUidForIndex: (index: number) => string | null
      getIndexForQueueUid: (uid: string) => number
      getRoomIndexForNativeIndex?: (nativeIndex: number) => number
      onHostBroadcast: (playback: PlaybackInput, currentIndex: number) => void
      onGuestControl: (action: ControlAction) => void
      onGuestReadyToSync?: () => void
      onRestricted: () => void
    },
  ) {
    MediaItem.onMediaTransition(unloads, () => {
      if (!this.hooks.isActive()) return
      const role = this.hooks.getRole()
      if (role === 'host') {
        this.emitHostState()
      } else if (role === 'guest') {
        this.pendingLoadTrackId = null
        this.hooks.onGuestReadyToSync?.()
      }
    })

    PlayState.onState(unloads, () => {
      if (this.hooks.isActive() && this.hooks.getRole() === 'host') {
        this.emitHostState()
      }
    })

    redux.intercept('playbackControls/SEEK', unloads, (seconds) => {
      if (!this.hooks.isActive() || this.selfOps > 0) return
      const role = this.hooks.getRole()
      if (role === 'host') {
        queueMicrotask(() => this.emitHostState(typeof seconds === 'number' ? seconds * 1000 : undefined))
        return
      }
      if (role === 'guest') {
        if (this.hooks.canGuestControl() && typeof seconds === 'number') {
          this.hooks.onGuestControl({ kind: 'seek', posMs: Math.max(0, Math.round(seconds * 1000)) })
        } else {
          this.hooks.onRestricted()
        }
        return true
      }
    })

    redux.intercept(HOST_PLAYBACK_ACTIONS, unloads, (_, actionName) => {
      if (!this.hooks.isActive() || this.selfOps > 0) return
      if (this.hooks.getRole() !== 'guest') return
      if (!this.hooks.canGuestControl()) {
        this.hooks.onRestricted()
        return true
      }
      if (actionName === 'playbackControls/PLAY') this.hooks.onGuestControl({ kind: 'play' })
      else if (actionName === 'playbackControls/PAUSE') this.hooks.onGuestControl({ kind: 'pause' })
      else this.hooks.onGuestControl({ kind: PlayState.playing ? 'pause' : 'play' })
      return true
    })

    redux.intercept(['playbackControls/SKIP_NEXT', 'playbackControls/SKIP_PREVIOUS'], unloads, (_, actionName) => {
      if (!this.hooks.isActive() || this.selfOps > 0) return
      const role = this.hooks.getRole()
      if (role === 'host') {
        queueMicrotask(() => this.emitHostState())
        return
      }
      if (role === 'guest') {
        if (!this.hooks.canGuestControl()) {
          this.hooks.onRestricted()
          return true
        }
        this.hooks.onGuestControl({ kind: actionName === 'playbackControls/SKIP_NEXT' ? 'next' : 'prev' })
        return true
      }
    })

    redux.intercept(['playQueue/MOVE_NEXT', 'playQueue/MOVE_PREVIOUS', 'playQueue/MOVE_TO'], unloads, (payload, actionName) => {
      if (!this.hooks.isActive() || this.selfOps > 0) return
      const role = this.hooks.getRole()
      if (role === 'host') {
        queueMicrotask(() => this.emitHostState())
        return
      }
      if (role === 'guest') {
        if (!this.hooks.canGuestControl()) {
          this.hooks.onRestricted()
          return true
        }
        if (actionName === 'playQueue/MOVE_NEXT') this.hooks.onGuestControl({ kind: 'next' })
        else if (actionName === 'playQueue/MOVE_PREVIOUS') this.hooks.onGuestControl({ kind: 'prev' })
        else if (actionName === 'playQueue/MOVE_TO' && typeof payload === 'number') {
          const uid = this.hooks.getQueueUidForIndex(payload)
          if (uid) this.hooks.onGuestControl({ kind: 'select', uid })
        }
        return true
      }
    })

    this.heartbeatTimer = setInterval(() => {
      if (!this.disposed && this.hooks.isActive() && this.hooks.getRole() === 'host') {
        this.emitHostState()
      }
    }, 2500)

    unloads.add(() => this.dispose())
  }

  readLocalPlayback(): PlaybackInput {
    const pq = PlayState.playQueue
    const currentEl = pq.elements[pq.currentIndex]
    const trackId =
      currentEl?.mediaItemId !== undefined
        ? String(currentEl.mediaItemId)
        : PlayState.playbackContext?.actualProductId
          ? String(PlayState.playbackContext.actualProductId)
          : null
    const timeSec = PlayState.currentTime || PlayState.playTime || 0
    const durationSec = PlayState.playbackContext?.actualDuration
    return {
      trackId,
      queueUid: this.hooks.getQueueUidForIndex(pq.currentIndex),
      posMs: Math.max(0, Math.round(timeSec * 1000)),
      playing: PlayState.playing,
      ...(typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0 ? { durationSec } : {}),
    }
  }

  executeHostCommand(action: ControlAction): void {
    if (this.hooks.getRole() !== 'host') return
    this.ownOp(() => {
      switch (action.kind) {
        case 'play':
          PlayState.play()
          break
        case 'pause':
          PlayState.pause()
          break
        case 'next':
          PlayState.next()
          break
        case 'prev':
          PlayState.previous()
          break
        case 'seek':
          PlayState.seek(action.posMs / 1000)
          break
        case 'select': {
          const idx = this.hooks.getIndexForQueueUid(action.uid)
          if (idx >= 0) PlayState.moveTo(idx)
          break
        }
      }
    })
    queueMicrotask(() => this.emitHostState(action.kind === 'seek' ? action.posMs : undefined))
  }

  applyRemoteTick(
    playback: PlaybackSnapshot,
    queue: QueueTrack[],
    currentIndex: number,
    audioMode: AudioMode,
    clock: ClockSync,
  ): void {
    if (audioMode === 'speaker') {
      this.setMediaRate(1)
      if (PlayState.playing) {
        this.ownOp(() => PlayState.pause())
      }
      this.drift.reset()
      this.lastTrackId = playback.trackId
      this.pendingLoadTrackId = null
      this.needsInitialSeekForTrack = null
      return
    }

    if (!playback.trackId) return
    const targetTrackId = playback.trackId

    if (!isTrackInStore(targetTrackId)) {
      ensureTrackInStore(targetTrackId)
        .then((loaded) => {
          if (loaded && !this.disposed) this.hooks.onGuestReadyToSync?.()
        })
        .catch(() => {})
      return
    }

    const pq = PlayState.playQueue
    const targetIdx =
      currentIndex >= 0 && currentIndex < pq.elements.length && String(pq.elements[currentIndex]?.mediaItemId) === targetTrackId
        ? currentIndex
        : pq.elements.findIndex((el: redux.PlayQueueElement) => String(el.mediaItemId) === targetTrackId)

    const rawActual = PlayState.playbackContext?.actualProductId
    const actualTrackId = rawActual !== undefined && rawActual !== null && String(rawActual) !== '' ? String(rawActual) : null
    const actualMismatch = actualTrackId !== null && actualTrackId !== targetTrackId
    const trackSwitched = this.lastTrackId !== targetTrackId

    if (trackSwitched) {
      this.needsInitialSeekForTrack = targetTrackId
      this.lastTrackId = targetTrackId
    }

    const mustTriggerLoad = targetIdx >= 0 ? pq.currentIndex !== targetIdx || actualMismatch || trackSwitched : actualMismatch || trackSwitched

    if (mustTriggerLoad) {
      const nowMs = performance.now()
      const loadInFlight = this.pendingLoadTrackId === targetTrackId && nowMs - this.pendingLoadAt < 3000
      if (!loadInFlight) {
        this.pendingLoadTrackId = targetTrackId
        this.pendingLoadAt = nowMs
        this.needsInitialSeekForTrack = targetTrackId
        if (targetIdx >= 0) {
          this.ownOp(() => PlayState.moveTo(targetIdx))
        } else {
          this.ownOp(() => PlayState.play(toNativeItemId(targetTrackId)))
        }
      }
      const postActual = PlayState.playbackContext?.actualProductId
      const postTrackId = postActual !== undefined && postActual !== null && String(postActual) !== '' ? String(postActual) : null
      if (postTrackId !== null && postTrackId !== targetTrackId) {
        return
      }
    }

    this.pendingLoadTrackId = null

    if (playback.playing && !PlayState.playing) {
      this.ownOp(() => PlayState.play())
    } else if (!playback.playing && PlayState.playing) {
      this.ownOp(() => PlayState.pause())
    }

    const finalActual = PlayState.playbackContext?.actualProductId
    const finalTrackId = finalActual !== undefined && finalActual !== null && String(finalActual) !== '' ? String(finalActual) : null
    const needsSeek = this.needsInitialSeekForTrack === targetTrackId
    if (finalTrackId === targetTrackId) {
      this.needsInitialSeekForTrack = null
    }

    const elapsedMs = playback.playing ? Math.max(0, clock.serverNow() - playback.serverTs) : 0
    const expectedMs = playback.posMs + elapsedMs
    const actualMs = Math.max(0, (PlayState.currentTime || PlayState.playTime || 0) * 1000)
    const decision = this.drift.evaluate({
      expectedMs,
      actualMs,
      playing: playback.playing,
      nowMs: performance.now(),
      forceSeek: needsSeek || trackSwitched || queue.length === 0,
    })

    if (decision.action === 'seek') {
      this.setMediaRate(1)
      this.ownOp(() => PlayState.seek(decision.targetSec))
    } else if (decision.action === 'rate') {
      this.setMediaRate(decision.rate)
    }
  }

  resetSync(): void {
    this.drift.reset()
    this.lastTrackId = null
    this.pendingLoadTrackId = null
    this.needsInitialSeekForTrack = null
    this.setMediaRate(1)
  }

  private emitHostState(overridePosMs?: number): void {
    const pb = this.readLocalPlayback()
    if (overridePosMs !== undefined) pb.posMs = Math.max(0, Math.round(overridePosMs))
    const nativeIdx = PlayState.playQueue.currentIndex
    const roomIdx = this.hooks.getRoomIndexForNativeIndex?.(nativeIdx) ?? -1
    this.hooks.onHostBroadcast(pb, roomIdx >= 0 ? roomIdx : nativeIdx)
  }

  private ownOp(fn: () => void): void {
    this.selfOps++
    try {
      fn()
    } finally {
      this.selfOps--
    }
  }

  private setMediaRate(rate: number): void {
    try {
      if (typeof document === 'undefined') return
      const media = document.querySelector<HTMLMediaElement>('audio, video')
      if (media && Math.abs(media.playbackRate - rate) > 0.001) {
        media.playbackRate = rate
      }
    } catch {
      return
    }
  }

  private dispose(): void {
    this.disposed = true
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.resetSync()
  }
}
