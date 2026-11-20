import { Tracer, type LunaUnload } from '@luna/core'
import { StyleTag } from '@luna/lib'
import styles from 'file://ui/styles.css?minify'
import { DiscordPresenceController } from './discord/presence'
import type { AudioMode, RoomSnapshot } from './protocol'
import { SessionClient } from './session/client'
import { localProfile } from './tidal/identity'
import { findMissingMetadata } from './tidal/metadata'
import { TidalPlaybackBridge } from './tidal/playback'
import { TidalQueueSync } from './tidal/queueSync'
import { FooterButtonMount } from './ui/footerButton'
import { PopoverController } from './ui/popover'
import { QueueAvatarDecorator } from './ui/queueAvatars'
import { QueueHeaderMount } from './ui/queueHeader'
import { LunaJamSettingsView } from './ui/settings'
import { unmountParticipantMenu } from './ui/participantMenu'
import { showToast, unmountToast } from './ui/toast'
import { storage } from './tidal/storage'

export const unloads = new Set<LunaUnload>()
export const { errSignal } = Tracer('lunajam')
export const Settings = LunaJamSettingsView

new StyleTag('LunaJam', unloads, styles)

const session = new SessionClient()
const attemptedMeta = new Set<string>()
let lastRoomCode: string | null = null
let lastParticipantCount = 0
let lastAppliedQueueKey = ''

function queueKey(room: RoomSnapshot): string {
  return `${room.currentIndex}:${room.queue.map((t) => `${t.uid}:${t.trackId}`).join(',')}`
}

async function startJam(seedTrackIds?: string[]): Promise<void> {
  const cfg = storage.get()
  const profile = localProfile(session.snapshot().cid ?? '')
  const seed = await queueSync.snapshotSeedQueue(profile)
  let queue = seed.queue
  let currentIndex = seed.currentIndex

  if (seedTrackIds && seedTrackIds.length > 0) {
    const inputs = await queueSync.snapshotInputsFromTrackIds(seedTrackIds)
    const seeded = inputs.map((t, i) => ({
      ...t,
      uid: `ctx-${Date.now()}-${i}`,
      addedBy: profile,
    }))
    queue = [...seeded, ...queue]
    currentIndex = 0
  }

  const pb = playback.readLocalPlayback()
  if (queue.length === 0 && pb.trackId) {
    const inputs = await queueSync.snapshotInputsFromTrackIds([pb.trackId])
    if (inputs[0]) {
      queue = [{ ...inputs[0], uid: `now-${Date.now()}`, addedBy: profile }]
      currentIndex = 0
    }
  }

  session.createRoom({
    serverUrl: cfg.serverUrl,
    profile,
    allowGuestControl: cfg.defaultAllowGuestControl,
    allowGuestAdd: cfg.defaultAllowGuestAdd,
    queue,
    currentIndex,
    playback: pb,
  })
}

async function joinJam(input: string, audioMode: AudioMode, serverUrl?: string): Promise<void> {
  const cfg = storage.get()
  const ok = await session.joinRoom({
    input,
    serverUrl: serverUrl ?? cfg.serverUrl,
    profile: localProfile(session.snapshot().cid ?? ''),
    audioMode,
    peerId: cfg.peerId,
  })
  if (!ok) {
    const err = session.snapshot().error
    if (err) showToast(err, 'warn')
  }
}

const queueSync = new TidalQueueSync(unloads, {
  isActive: () => Boolean(session.snapshot().room),
  getRole: () => session.snapshot().role,
  canGuestEdit: () => Boolean(session.snapshot().room?.allowGuestControl),
  canGuestAdd: () => {
    const s = session.snapshot()
    if (s.role === 'host') return true
    if (!s.room) return false
    const me = s.cid ? s.room.participants.find((p) => p.cid === s.cid) : undefined
    return me ? me.canAddTracks : s.room.allowGuestAdd
  },
  getLocalProfile: () => localProfile(session.snapshot().cid ?? ''),
  getRoom: () => session.snapshot().room,
  onGuestAdd: async (trackIds, insert) => {
    const inputs = await queueSync.snapshotInputsFromTrackIds(trackIds)
    session.addTracks(inputs, insert)
    showToast(inputs.length > 1 ? `Added ${inputs.length} tracks to Jam` : 'Added to Jam')
  },
  onGuestMove: (roomUid, toIndex) => session.moveTrack(roomUid, toIndex),
  onGuestRemove: (roomUid) => session.removeTrack(roomUid),
  onHostReplaceQueue: (queue, currentIndex) => session.replaceQueue(queue, currentIndex),
  onStartJamWithTracks: (trackIds) => {
    startJam(trackIds).catch(() => {})
  },
  onRestricted: () => showToast('Host restricted queue controls', 'warn'),
  onAddRestricted: () => showToast('Host turned off track additions for you', 'warn'),
})

const playback = new TidalPlaybackBridge(unloads, {
  isActive: () => Boolean(session.snapshot().room),
  getRole: () => session.snapshot().role,
  getAudioMode: () => session.snapshot().audioMode,
  canGuestControl: () => Boolean(session.snapshot().room?.allowGuestControl),
  getQueueUidForIndex: (index) => queueSync.roomUidAtNativeIndex(index),
  getIndexForQueueUid: (uid) => queueSync.nativeIndexForRoomUid(uid),
  onHostBroadcast: (pb, currentIndex) => session.syncPlayback(pb, currentIndex),
  onGuestControl: (action) => session.sendControl(action),
  onRestricted: () => showToast('Host restricted playback controls', 'warn'),
})

const queueHeader = new QueueHeaderMount(unloads, session, (uid) => {
  const s = session.snapshot()
  if (s.role === 'host') {
    playback.executeHostCommand({ kind: 'select', uid })
  } else if (s.room?.allowGuestControl) {
    session.sendControl({ kind: 'select', uid })
  }
})

const queueAvatars = new QueueAvatarDecorator(unloads, session, queueSync)

const popover = new PopoverController({
  session,
  onStartJam: () => {
    startJam().catch(() => {})
  },
  onJoinJam: (input, mode) => {
    joinJam(input, mode).catch(() => {})
  },
  onSelectTrack: (uid) => {
    const s = session.snapshot()
    if (s.role === 'host') playback.executeHostCommand({ kind: 'select', uid })
    else if (s.room?.allowGuestControl) session.sendControl({ kind: 'select', uid })
  },
})

new FooterButtonMount(unloads, session, popover, queueHeader)

new DiscordPresenceController(unloads, session, {
  onJoinLink: (token, serverUrl) => {
    const mode = storage.get().defaultGuestAudioMode
    showToast('Joining Jam from link')
    joinJam(token, mode, serverUrl).catch(() => {})
  },
})

unloads.add(
  session.onCommand((_, action) => {
    playback.executeHostCommand(action)
  }),
)

unloads.add(
  session.onTick((pb, currentIndex) => {
    const s = session.snapshot()
    if (s.role === 'guest' && s.room) {
      playback.applyRemoteTick(pb, s.room.queue, currentIndex, s.audioMode, session.clock)
    }
  }),
)

unloads.add(
  session.onPromoted((room) => {
    showToast(`Started Jam ${room.code} from Discord`)
  }),
)

unloads.add(
  session.subscribe((state) => {
    const room = state.room
    if (!room) {
      if (lastRoomCode !== null) {
        lastRoomCode = null
        lastParticipantCount = 0
        lastAppliedQueueKey = ''
        attemptedMeta.clear()
        queueSync.clearMappings()
        playback.resetSync()
        queueAvatars.refresh()
        if (state.endReason === 'banned') showToast('You were banned from this Jam', 'warn')
        else if (state.endReason === 'kicked') showToast('Removed from Jam', 'warn')
        else if (state.endReason === 'host_ended' || state.endReason === 'host_timeout') showToast('Jam ended')
      }
      return
    }

    if (lastRoomCode === null) {
      lastRoomCode = room.code
      lastParticipantCount = room.participants.length
    } else if (room.participants.length > lastParticipantCount) {
      const joined = room.participants[room.participants.length - 1]
      if (joined && joined.cid !== state.cid) showToast(`${joined.name} joined`)
      lastParticipantCount = room.participants.length
    } else {
      lastParticipantCount = room.participants.length
    }

    const key = queueKey(room)
    if (key !== lastAppliedQueueKey) {
      lastAppliedQueueKey = key
      queueSync.applyRoomToNative(room)
    }

    if (state.role === 'guest' && room.playback) {
      playback.applyRemoteTick(room.playback, room.queue, room.currentIndex, state.audioMode, session.clock)
    }

    queueAvatars.refresh()

    findMissingMetadata(room.queue, attemptedMeta)
      .then((updates) => {
        if (updates.length > 0) session.sendMetaUpdates(updates)
      })
      .catch(() => {})
  }),
)

unloads.add(() => {
  popover.unmount()
  unmountParticipantMenu()
  unmountToast()
  queueSync.clearMappings()
  session.dispose()
})
