import type { LunaUnload } from '@luna/core'
import { MediaItem, PlayState, ipcRenderer, redux } from '@luna/lib'
import { parseJoinTarget } from '../protocol'
import type { SessionClient, SessionState } from '../session/client'
import { normalizeServerUrl } from '../session/settings'
import { localProfile } from '../tidal/identity'
import { resolveTrackMeta } from '../tidal/metadata'
import { storage } from '../tidal/storage'
import { drainLoopbackJoins, startLoopback, stopLoopback } from './loopback.native'
import { rpcDisconnect, rpcSetActivity } from './rpc.native'
import type { RpcButton, WireActivity } from './types'

function fmtField(raw: string | undefined, fallback = 'TIDAL'): string {
  const clean = (raw ?? '').trim()
  if (clean.length === 0) return fallback
  if (clean.length === 1) return `${clean} `
  return clean.length > 128 ? `${clean.slice(0, 125)}...` : clean
}

export class DiscordPresenceController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private updating = false
  private rerunRequested = false
  private disposed = false
  private lastStandbyTrackKey = ''

  constructor(
    unloads: Set<LunaUnload>,
    private session: SessionClient,
    private hooks: {
      onJoinLink: (code: string, serverUrl?: string) => void
    },
  ) {
    MediaItem.onMediaTransition(unloads, () => this.schedule())
    PlayState.onState(unloads, () => this.schedule())
    redux.intercept('playbackControls/SEEK', unloads, () => {
      setTimeout(() => this.schedule(), 60)
    })

    const unsubSession = this.session.subscribe(() => this.schedule())
    unloads.add(unsubSession)

    const onSettings = () => this.schedule()
    storage.onChange(onSettings)
    unloads.add(() => storage.off(onSettings))

    ipcRenderer.onOpenUrl(unloads, (rawUrl: string) => this.handleIncomingUri(rawUrl))

    startLoopback().catch(() => null)
    this.pollTimer = setInterval(() => {
      drainLoopbackJoins()
        .then((items) => {
          for (const item of items) {
            this.hooks.onJoinLink(item.code, item.serverUrl)
          }
        })
        .catch(() => {})
    }, 900)

    unloads.add(() => this.dispose())
    setTimeout(() => this.schedule(), 250)
  }

  schedule(): void {
    if (this.disposed) return
    if (this.updating) {
      this.rerunRequested = true
      return
    }
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.runUpdate().catch(() => {})
    }, 280)
  }

  private handleIncomingUri(rawUrl: string): void {
    const parsed = parseJoinTarget(rawUrl)
    if (!parsed) return
    this.hooks.onJoinLink(parsed.token, parsed.serverUrl)
  }

  private async runUpdate(): Promise<void> {
    if (this.disposed) return
    this.updating = true
    try {
      const cfg = storage.get()
      const state = this.session.snapshot()

      if (!cfg.discordRpcEnabled) {
        if (!state.room) this.session.closeStandby()
        await rpcDisconnect()
        return
      }

      const activePayload = await this.buildActivity(state, cfg.discordListenTogether, cfg.discordShowPaused)
      if (!activePayload) {
        if (!state.room) this.session.closeStandby()
        await rpcSetActivity(cfg.discordClientId, null)
        return
      }

      await rpcSetActivity(cfg.discordClientId, activePayload)
    } finally {
      this.updating = false
      if (this.rerunRequested && !this.disposed) {
        this.rerunRequested = false
        this.schedule()
      }
    }
  }

  private async buildActivity(
    state: SessionState,
    listenTogether: boolean,
    showPaused: boolean,
  ): Promise<WireActivity | null> {
    const room = state.room
    if (room) {
      const activeTrack = room.currentIndex >= 0 ? room.queue[room.currentIndex] : undefined
      const pb = room.playback
      const trackId = pb?.trackId ?? activeTrack?.trackId ?? null
      const playing = pb?.playing ?? PlayState.playing
      if (!trackId || (!playing && !showPaused)) return null

      const cached = activeTrack?.title && activeTrack.coverUrl ? null : await resolveTrackMeta(trackId)
      const title = activeTrack?.title || cached?.title || 'Listening on TIDAL'
      const artist = activeTrack?.artist || cached?.artist || 'TIDAL'
      const album = activeTrack?.album || cached?.album
      const coverUrl = activeTrack?.coverUrl || cached?.coverUrl
      const durationSec = pb?.durationSec ?? activeTrack?.durationSec ?? cached?.durationSec

      const elapsedMs = pb
        ? pb.playing
          ? pb.posMs + Math.max(0, this.session.clock.serverNow() - pb.serverTs)
          : pb.posMs
        : (PlayState.currentTime || PlayState.playTime || 0) * 1000

      const buttons: RpcButton[] = []
      if (listenTogether) {
        const origin = normalizeServerUrl(state.serverUrl)
        buttons.push({ label: 'Listen Together', url: `${origin}/join/${room.code}` })
      }
      buttons.push({ label: 'Play on TIDAL', url: `https://tidal.com/browse/track/${trackId}` })

      const activity: WireActivity = {
        type: 2,
        status_display_type: 0,
        details: fmtField(title),
        state: fmtField(artist),
        party: {
          id: `lunajam:${room.code}`,
          size: [Math.max(1, room.participants.length), 32],
        },
        buttons,
        instance: true,
        assets: {
          ...(coverUrl ? { large_image: coverUrl } : {}),
          ...(album ? { large_text: fmtField(album) } : {}),
          small_text: `Jam · ${room.participants.length} listening`,
        },
      }

      if (playing && durationSec && durationSec > 0) {
        const start = Math.round(Date.now() - elapsedMs)
        activity.timestamps = {
          start,
          end: Math.round(start + durationSec * 1000),
        }
      }
      return activity
    }

    const playing = PlayState.playing
    if (!playing && !showPaused) return null

    const item = await MediaItem.fromPlaybackContext().catch(() => undefined)
    if (!item) return null

    const trackId = String(item.id)
    const meta = await resolveTrackMeta(trackId)
    const title = meta?.title || item.tidalItem?.title || 'TIDAL'
    const artist = meta?.artist || 'TIDAL'
    const album = meta?.album
    const coverUrl = meta?.coverUrl
    const durationSec = meta?.durationSec ?? item.duration
    const posMs = Math.max(0, Math.round((PlayState.currentTime || PlayState.playTime || 0) * 1000))

    if (listenTogether) {
      const serverUrl = normalizeServerUrl(storage.get().serverUrl)
      const trackKey = `${trackId}:${playing ? 1 : 0}:${Math.floor(posMs / 5000)}`
      const playbackInput = {
        trackId,
        queueUid: null,
        posMs,
        playing,
        ...(durationSec ? { durationSec } : {}),
      }
      if (!state.standbyId) {
        const pq = PlayState.playQueue
        const idx = Math.max(0, pq.currentIndex)
        const slice = pq.elements.slice(Math.max(0, idx - 2), idx + 15)
        const queueInputs = slice.map((el: redux.PlayQueueElement) => ({
          trackId: String(el.mediaItemId),
          title: String(el.mediaItemId) === trackId ? title : '',
          artist: String(el.mediaItemId) === trackId ? artist : '',
          ...(String(el.mediaItemId) === trackId && coverUrl ? { coverUrl } : {}),
          ...(String(el.mediaItemId) === trackId && durationSec ? { durationSec } : {}),
        }))
        const relIndex = Math.min(2, idx)
        this.lastStandbyTrackKey = trackKey
        this.session.openStandby({
          serverUrl,
          profile: localProfile(),
          queue: queueInputs,
          currentIndex: queueInputs.length > 0 ? relIndex : -1,
          playback: playbackInput,
          allowGuestControl: storage.get().defaultAllowGuestControl,
          allowGuestAdd: storage.get().defaultAllowGuestAdd,
        })
      } else if (trackKey !== this.lastStandbyTrackKey) {
        this.lastStandbyTrackKey = trackKey
        this.session.updateStandby({ playback: playbackInput })
      }
    } else if (state.standbyId) {
      this.session.closeStandby()
    }

    const buttons: RpcButton[] = []
    if (listenTogether && state.standbyId) {
      const origin = normalizeServerUrl(state.serverUrl)
      buttons.push({ label: 'Listen Together', url: `${origin}/join/${state.standbyId}` })
    }
    buttons.push({ label: 'Play on TIDAL', url: `https://tidal.com/browse/track/${trackId}` })

    const activity: WireActivity = {
      type: 2,
      status_display_type: 0,
      details: fmtField(title),
      state: fmtField(artist),
      buttons,
      instance: false,
      assets: {
        ...(coverUrl ? { large_image: coverUrl } : {}),
        ...(album ? { large_text: fmtField(album) } : {}),
      },
    }

    if (playing && durationSec && durationSec > 0) {
      const start = Math.round(Date.now() - posMs)
      activity.timestamps = {
        start,
        end: Math.round(start + durationSec * 1000),
      }
    }

    return activity
  }

  private dispose(): void {
    this.disposed = true
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    if (this.pollTimer !== null) clearInterval(this.pollTimer)
    this.session.closeStandby()
    rpcDisconnect().catch(() => {})
    stopLoopback().catch(() => {})
  }
}
