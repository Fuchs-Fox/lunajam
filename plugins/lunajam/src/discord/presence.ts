import type { LunaUnload } from '@luna/core'
import { MediaItem, PlayState, ipcRenderer, redux } from '@luna/lib'
import { parseJoinTarget } from '../protocol'
import type { SessionClient, SessionState } from '../session/client'
import { DEFAULT_DISCORD_CLIENT_ID, normalizeServerUrl } from '../session/settings'
import { localProfile } from '../tidal/identity'
import { resolveTrackMeta } from '../tidal/metadata'
import { storage } from '../tidal/storage'
import { drainLoopbackJoins, startLoopback, stopLoopback } from './loopback.native'
import { rpcDisconnect, rpcSetActivity } from './rpc.native'
import type { RpcButton, WireActivity } from './types'

const PAUSED_ICON_FALLBACK_URL = 'https://cdn.discordapp.com/app-assets/1130698654987067493/1130747558550061137.png'

function fmtField(raw: string | undefined, fallback = 'TIDAL'): string {
  const clean = (raw ?? '').trim()
  if (clean.length === 0) return fallback
  if (clean.length === 1) return `${clean} `
  return clean.length > 128 ? `${clean.slice(0, 125)}...` : clean
}

function composeTrackActivity(opts: {
  clientId: string
  trackId: string
  title: string
  artist: string
  album?: string
  coverUrl?: string
  playing: boolean
  durationSec?: number
  elapsedMs: number
  buttons: RpcButton[]
  party?: { id: string; size: [number, number] }
}): WireActivity {
  const isDefaultApp = opts.clientId === DEFAULT_DISCORD_CLIENT_ID
  const largeImage = opts.coverUrl || (isDefaultApp ? 'tidal-logo' : undefined)
  const pauseIcon = isDefaultApp ? 'paused-icon' : PAUSED_ICON_FALLBACK_URL
  const albumText = opts.album?.trim()
  const activity: WireActivity = {
    name: 'TIDAL',
    type: 2,
    status_display_type: 0,
    details: fmtField(opts.title),
    details_url: `https://tidal.com/browse/track/${opts.trackId}`,
    state: fmtField(opts.artist),
    ...(opts.party ? { party: opts.party } : {}),
    buttons: opts.buttons,
    instance: true,
    assets: {
      ...(largeImage ? { large_image: largeImage } : {}),
      ...(albumText ? { large_text: fmtField(albumText) } : {}),
      ...(!opts.playing ? { small_image: pauseIcon, small_text: 'Paused' } : {}),
    },
  }
  if (opts.playing && opts.durationSec && opts.durationSec > 0) {
    const start = Math.round(Date.now() - opts.elapsedMs)
    activity.timestamps = {
      start,
      end: Math.round(start + opts.durationSec * 1000),
    }
  }
  return activity
}

export async function buildPresenceActivity(opts: {
  state: SessionState
  listenTogether: boolean
  showPaused: boolean
  clientId: string
  clockNowMs?: number
  onStandbySync?: (info: { trackKey: string; trackId: string; title: string; artist: string; album?: string; coverUrl?: string; durationSec?: number; playing: boolean; posMs: number }) => void
}): Promise<WireActivity | null> {
  const { state, listenTogether, showPaused, clientId } = opts
  const room = state.room
  if (room) {
    const activeTrack = room.currentIndex >= 0 ? room.queue[room.currentIndex] : undefined
    const pb = room.playback
    const trackId = pb?.trackId ?? activeTrack?.trackId ?? null
    const playing = pb?.playing ?? PlayState.playing
    if (!trackId || (!playing && !showPaused)) return null

    const cached =
      activeTrack?.title && activeTrack.coverUrl && activeTrack.album ? null : await resolveTrackMeta(trackId)
    const title = activeTrack?.title || cached?.title || 'Listening on TIDAL'
    const artist = activeTrack?.artist || cached?.artist || 'TIDAL'
    const album = activeTrack?.album || cached?.album
    const coverUrl = activeTrack?.coverUrl || cached?.coverUrl
    const durationSec = pb?.durationSec ?? activeTrack?.durationSec ?? cached?.durationSec

    const elapsedMs = pb
      ? pb.playing
        ? pb.posMs + Math.max(0, (opts.clockNowMs ?? Date.now()) - pb.serverTs)
        : pb.posMs
      : (PlayState.currentTime || PlayState.playTime || 0) * 1000
    const buttons: RpcButton[] = []
    if (listenTogether) {
      const origin = normalizeServerUrl(state.serverUrl)
      buttons.push({ label: 'Listen Together', url: `${origin}/join/${room.code}` })
    }
    buttons.push({ label: 'Play on TIDAL', url: `https://tidal.com/browse/track/${trackId}` })

    return composeTrackActivity({
      clientId,
      trackId,
      title,
      artist,
      album,
      coverUrl,
      playing,
      durationSec,
      elapsedMs,
      buttons,
      party: {
        id: `lunajam:${room.code}`,
        size: [Math.max(1, room.participants.length), 32],
      },
    })
  }

  const playing = PlayState.playing
  if (!playing && !showPaused) return null

  const item = await MediaItem.fromPlaybackContext().catch(() => undefined)
  if (!item) return null

  const trackId = String(item.id)
  const meta = await resolveTrackMeta(trackId)
  const title = meta?.title || item.tidalItem?.title || 'TIDAL'
  const artist = meta?.artist || 'TIDAL'
  const album = meta?.album || item.tidalItem?.album?.title
  const coverUrl = meta?.coverUrl
  const durationSec = meta?.durationSec ?? item.duration
  const posMs = Math.max(0, Math.round((PlayState.currentTime || PlayState.playTime || 0) * 1000))
  const trackKey = `${trackId}:${playing ? 1 : 0}:${Math.floor(posMs / 5000)}`

  opts.onStandbySync?.({
    trackKey,
    trackId,
    title,
    artist,
    ...(album ? { album } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(durationSec ? { durationSec } : {}),
    playing,
    posMs,
  })

  const buttons: RpcButton[] = []
  if (listenTogether && state.standbyId) {
    const origin = normalizeServerUrl(state.serverUrl)
    buttons.push({ label: 'Listen Together', url: `${origin}/join/${state.standbyId}` })
  }
  buttons.push({ label: 'Play on TIDAL', url: `https://tidal.com/browse/track/${trackId}` })

  return composeTrackActivity({
    clientId,
    trackId,
    title,
    artist,
    album,
    coverUrl,
    playing,
    durationSec,
    elapsedMs: posMs,
    buttons,
  })
}

function activitySignature(clientId: string, a: WireActivity): string {
  return JSON.stringify([
    clientId,
    a.name ?? '',
    a.details ?? '',
    a.state ?? '',
    a.assets?.large_image ?? '',
    a.assets?.large_text ?? '',
    a.assets?.small_image ?? '',
    a.party?.id ?? '',
    a.party?.size ?? null,
    a.buttons ?? [],
  ])
}

export class DiscordPresenceController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private updating = false
  private rerunRequested = false
  private disposed = false
  private lastStandbyTrackKey = ''
  private lastSentSig = ''
  private lastSentStartMs = 0

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
        this.lastSentSig = ''
        this.lastSentStartMs = 0
        await rpcDisconnect()
        return
      }

      const activePayload = await this.buildActivity(state, cfg.discordListenTogether, cfg.discordShowPaused, cfg.discordClientId)
      if (!activePayload) {
        if (!state.room) this.session.closeStandby()
        this.lastSentSig = ''
        this.lastSentStartMs = 0
        await rpcSetActivity(cfg.discordClientId, null)
        return
      }

      const sig = activitySignature(cfg.discordClientId, activePayload)
      const startMs = activePayload.timestamps?.start ?? 0
      if (sig === this.lastSentSig && Math.abs(startMs - this.lastSentStartMs) < 2000) {
        return
      }

      const res = await rpcSetActivity(cfg.discordClientId, activePayload)
      if (res.connected) {
        this.lastSentSig = sig
        this.lastSentStartMs = startMs
      } else {
        this.lastSentSig = ''
        this.lastSentStartMs = 0
      }
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
    clientId: string,
  ): Promise<WireActivity | null> {
    return buildPresenceActivity({
      state,
      listenTogether,
      showPaused,
      clientId,
      clockNowMs: this.session.clock.serverNow(),
      onStandbySync: (info) => {
        if (listenTogether) {
          const serverUrl = normalizeServerUrl(storage.get().serverUrl)
          const playbackInput = {
            trackId: info.trackId,
            queueUid: null,
            posMs: info.posMs,
            playing: info.playing,
            ...(info.durationSec ? { durationSec: info.durationSec } : {}),
          }
          if (!state.standbyId) {
            const pq = PlayState.playQueue
            const idx = Math.max(0, pq.currentIndex)
            const slice = pq.elements.slice(Math.max(0, idx - 2), idx + 15)
            const queueInputs = slice.map((el: redux.PlayQueueElement) => ({
              trackId: String(el.mediaItemId),
              title: String(el.mediaItemId) === info.trackId ? info.title : '',
              artist: String(el.mediaItemId) === info.trackId ? info.artist : '',
              ...(String(el.mediaItemId) === info.trackId && info.album ? { album: info.album } : {}),
              ...(String(el.mediaItemId) === info.trackId && info.coverUrl ? { coverUrl: info.coverUrl } : {}),
              ...(String(el.mediaItemId) === info.trackId && info.durationSec ? { durationSec: info.durationSec } : {}),
            }))
            const relIndex = Math.min(2, idx)
            this.lastStandbyTrackKey = info.trackKey
            this.session.openStandby({
              serverUrl,
              profile: localProfile(),
              queue: queueInputs,
              currentIndex: queueInputs.length > 0 ? relIndex : -1,
              playback: playbackInput,
              allowGuestControl: storage.get().defaultAllowGuestControl,
              allowGuestAdd: storage.get().defaultAllowGuestAdd,
            })
          } else if (info.trackKey !== this.lastStandbyTrackKey) {
            this.lastStandbyTrackKey = info.trackKey
            this.session.updateStandby({ playback: playbackInput })
          }
        } else if (state.standbyId) {
          this.session.closeStandby()
        }
      },
    })
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