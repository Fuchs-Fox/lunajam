import type { LunaUnload } from '@luna/core'
import { ContextMenu, MediaItem, PlayState, redux } from '@luna/lib'
import type { InsertPosition, Profile, QueueTrack, QueueTrackInput, QueueTrackReplace, Role, RoomSnapshot } from '../protocol'
import { buildQueueInputs, getCachedMeta, toNativeItemId } from './metadata'

const QUEUE_MUTATION_ACTIONS: redux.ActionType[] = [
  'content/FETCH_AND_PLAY_MEDIA_ITEM',
  'homepage/PLAY_SINGLE_TRACK',
  'homepage/LOAD_AND_ENQUEUE_ALL_VIEW_ALL_TRACKS',
  'mix/PLAY_MIX',
  'trackPrompts/PLAY_MY_PICKS_ITEM',
  'playQueue/ADD_NEXT',
  'playQueue/ADD_AT_INDEX',
  'playQueue/ADD_LAST',
  'playQueue/ADD_NOW',
  'playQueue/ADD_NOW_REST_OF_TRACK_LIST',
  'playQueue/ADD_TRACK_LIST_TO_PLAY_QUEUE',
  'playQueue/ADD_ALREADY_LOADED_ITEMS_TO_QUEUE',
  'playQueue/ADD_MEDIA_ITEMS_TO_QUEUE',
  'playQueue/ADD_PROMO_ITEM_TO_QUEUE',
  'playQueue/PLAY_SOUNDTRACK_PROMPT_TRACK',
  'playQueue/FETCH_FIRST_PAGE_AND_ADD_TO_QUEUE',
  'playQueue/FETCH_REST_OF_THE_TRACKS_AND_ADD_TO_QUEUE',
  'playQueue/ADD_SHUFFLED_REST_OF_TRACK_LIST' as redux.ActionType,
  'playQueue/LOAD_TRACK_LIST_AND_ADD_TO_PLAY_QUEUE' as redux.ActionType,
  'playQueue/RESET',
  'playQueue/SET_CURRENT_INDEX',
  'playQueue/CLONE_TRACK',
  'playQueue/MOVE_TRACK',
  'playQueue/REMOVE_AT_INDEX',
  'playQueue/REMOVE_ELEMENT',
  'playQueue/CLEAR_QUEUE',
  'playQueue/CLEAR_ACTIVE_ITEMS',
  'playQueue/ENABLE_SHUFFLE_MODE',
  'playQueue/ENABLE_SHUFFLE_MODE_AND_SHUFFLE_ITEMS',
  'playQueue/TOGGLE_SHUFFLE',
  'playQueue/SET_REPEAT_MODE',
  'playQueue/TOGGLE_REPEAT_MODE',
  'cloudQueue/CREATE_CLOUD_QUEUE',
  'cloudQueue/ADD_ITEMS_TO_CLOUD_QUEUE',
  'cloudQueue/MOVE_TRACKS',
  'cloudQueue/REMOVE_ELEMENT',
  'cloudQueue/SET_CURRENT_ITEM',
  'cloudQueue/SET_SHUFFLED',
  'cloudQueueV2/CREATE_QUEUE' as redux.ActionType,
  'cloudQueueV2/UPDATE_CURRENT' as redux.ActionType,
  'cloudQueueV2/ADD_TO_FUTURE' as redux.ActionType,
  'cloudQueueV2/REMOVE_FROM_FUTURE' as redux.ActionType,
  'cloudQueueV2/REMOVE_MANY_FROM_FUTURE' as redux.ActionType,
  'cloudQueueV2/UPDATE_FUTURE' as redux.ActionType,
  'cloudQueueV2/CLEAR_QUEUE' as redux.ActionType,
]

const CLOUD_ADD_ACTIONS = new Set<string>(['cloudQueue/ADD_ITEMS_TO_CLOUD_QUEUE', 'cloudQueueV2/ADD_TO_FUTURE'])
const PLAY_NOW_ACTIONS = new Set<string>(['playQueue/ADD_NOW', 'content/FETCH_AND_PLAY_MEDIA_ITEM', 'homepage/PLAY_SINGLE_TRACK'])

function extractIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  const out: string[] = []
  const pushId = (v: unknown) => {
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).trim()
      if (s && !out.includes(s)) out.push(s)
    } else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      pushId(obj.mediaItemId ?? obj.itemId ?? obj.id)
    }
  }
  for (const key of ['mediaItemIds', 'itemIds', 'items']) {
    const arr = p[key]
    if (Array.isArray(arr)) {
      for (const item of arr) pushId(item)
    }
  }
  if (out.length === 0) pushId(p.mediaItemId ?? p.itemId ?? p.id)
  return out
}

const MAX_SEED_ITEMS = 50

export class TidalQueueSync {
  private selfOps = 0
  private roomUidByNativeUid = new Map<string, string>()
  private roomTrackByNativeUid = new Map<string, QueueTrack>()
  private roomTrackByRoomUid = new Map<string, QueueTrack>()
  private pendingHostReconcile = false
  private pendingGuestRestore = false
  private lastObservedElements: unknown = null
  private contextBtn: ReturnType<typeof ContextMenu.addButton>

  constructor(
    unloads: Set<LunaUnload>,
    private hooks: {
      isActive: () => boolean
      getRole: () => Role | null
      canGuestEdit: () => boolean
      canGuestAdd: () => boolean
      getLocalProfile: () => Profile
      getRoom: () => RoomSnapshot | null
      onGuestAdd: (trackIds: string[], insert: InsertPosition) => void
      onGuestMove: (roomUid: string, toIndex: number) => void
      onGuestRemove: (roomUid: string) => void
      onHostReplaceQueue: (queue: QueueTrackReplace[], currentIndex: number) => void
      onHostQueueReconciled?: (currentIndex: number) => void
      onStartJamWithTracks: (trackIds: string[]) => void
      onRestricted: () => void
      onAddRestricted: () => void
    },
  ) {
    this.lastObservedElements = PlayState.playQueue.elements
    this.contextBtn = ContextMenu.addButton(unloads)
    if (typeof (redux.store as { subscribe?: unknown }).subscribe === 'function') {
      const unsubStore = redux.store.subscribe(() => {
        if (!this.hooks.isActive() || this.selfOps > 0) return
        const role = this.hooks.getRole()
        const elements = PlayState.playQueue.elements
        if (elements === this.lastObservedElements) return
        this.lastObservedElements = elements
        if (role === 'host') {
          this.scheduleHostReconcile()
        } else if (role === 'guest') {
          this.scheduleGuestRestore()
        }
      })
      unloads.add(unsubStore)
    }
    redux.intercept(QUEUE_MUTATION_ACTIONS, unloads, (payload, actionName) => {
      if (!this.hooks.isActive() || this.selfOps > 0) return
      const role = this.hooks.getRole()
      if (role === 'host') {
        this.scheduleHostReconcile()
        return
      }
      if (role !== 'guest') return

      if (actionName === 'playQueue/ADD_NEXT' || actionName === 'playQueue/ADD_LAST' || actionName === 'playQueue/ADD_AT_INDEX') {
        if (!this.hooks.canGuestAdd()) {
          this.hooks.onAddRestricted()
          return true
        }
        const ids = ((payload as { mediaItemIds?: unknown } | null)?.mediaItemIds ?? []) as unknown[]
        const trackIds = ids.map(String).filter(Boolean)
        if (trackIds.length > 0) {
          const insert: InsertPosition =
            actionName === 'playQueue/ADD_NEXT'
              ? 'next'
              : actionName === 'playQueue/ADD_AT_INDEX' && typeof (payload as { index?: unknown }).index === 'number'
                ? ((payload as { index: number }).index as number)
                : 'last'
          this.hooks.onGuestAdd(trackIds, insert)
        }
        return true
      }

      if (actionName === 'playQueue/MOVE_TRACK') {
        if (!this.hooks.canGuestEdit()) {
          this.hooks.onRestricted()
          return true
        }
        const p = payload as { fromIndex?: number; toIndex?: number } | null
        const nativeEl = typeof p?.fromIndex === 'number' ? PlayState.playQueue.elements[p.fromIndex] : undefined
        const roomUid = nativeEl ? this.roomUidByNativeUid.get(nativeEl.uid) : undefined
        if (roomUid && typeof p?.toIndex === 'number') {
          this.hooks.onGuestMove(roomUid, p.toIndex)
        }
        return true
      }

      if (actionName === 'playQueue/REMOVE_AT_INDEX' || actionName === 'playQueue/REMOVE_ELEMENT') {
        const p = payload as { index?: number; uid?: string } | null
        const nativeEl =
          typeof p?.index === 'number'
            ? PlayState.playQueue.elements[p.index]
            : p?.uid
              ? PlayState.playQueue.elements.find((el: redux.PlayQueueElement) => el.uid === p.uid)
              : undefined
        const roomTrack = nativeEl ? this.roomTrackByNativeUid.get(nativeEl.uid) : undefined
        const room = this.hooks.getRoom()
        const me = this.hooks.getLocalProfile()
        if (roomTrack && room && (this.hooks.canGuestEdit() || roomTrack.addedBy.cid === me.cid)) {
          this.hooks.onGuestRemove(roomTrack.uid)
        } else {
          this.hooks.onRestricted()
        }
        return true
      }

      if (actionName === 'playQueue/ADD_MEDIA_ITEMS_TO_QUEUE') {
        const pos = (payload as { position?: string } | null)?.position
        const trackIds = extractIds(payload)
        if (pos === 'next' || pos === 'last') {
          if (!this.hooks.canGuestAdd()) {
            this.hooks.onAddRestricted()
          } else if (trackIds.length > 0) {
            this.hooks.onGuestAdd(trackIds, pos)
          }
          return true
        }
        if (trackIds.length > 0 && this.hooks.canGuestEdit() && this.hooks.canGuestAdd()) {
          this.hooks.onGuestAdd(trackIds, 'next')
        } else {
          this.hooks.onRestricted()
        }
        return true
      }

      if (CLOUD_ADD_ACTIONS.has(actionName as string)) {
        if (!this.hooks.canGuestAdd()) {
          this.hooks.onAddRestricted()
        } else {
          const trackIds = extractIds(payload)
          if (trackIds.length > 0) this.hooks.onGuestAdd(trackIds, 'last')
        }
        return true
      }

      if (PLAY_NOW_ACTIONS.has(actionName as string)) {
        const trackIds = extractIds(payload)
        if (trackIds.length > 0 && this.hooks.canGuestEdit() && this.hooks.canGuestAdd()) {
          this.hooks.onGuestAdd(trackIds, 'next')
        } else {
          this.hooks.onRestricted()
        }
        return true
      }

      this.hooks.onRestricted()
      return true
    })

    ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
      const ids: string[] = []
      try {
        for await (const item of await mediaCollection.mediaItems()) {
          ids.push(String(item.id))
          if (ids.length >= 50) break
        }
      } catch {
        return
      }
      if (ids.length === 0) return

      if (this.hooks.isActive()) {
        if (this.hooks.getRole() === 'guest' && !this.hooks.canGuestAdd()) {
          return
        }
        this.contextBtn.text = ids.length > 1 ? `Add ${ids.length} to Jam` : 'Add to Jam'
        this.contextBtn.onClick(() => this.hooks.onGuestAdd(ids, 'last'))
      } else {
        this.contextBtn.text = 'Start a Jam'
        this.contextBtn.onClick(() => this.hooks.onStartJamWithTracks(ids))
      }
      await this.contextBtn.show(contextMenu)
    })
  }

  async snapshotSeedQueue(hostProfile: Profile): Promise<{ queue: QueueTrack[]; currentIndex: number }> {
    const pq = PlayState.playQueue
    const all = pq.elements
    if (all.length === 0) return { queue: [], currentIndex: -1 }
    const start =
      all.length <= MAX_SEED_ITEMS ? 0 : Math.max(0, Math.min(pq.currentIndex - 5, all.length - MAX_SEED_ITEMS))
    const slice = all.slice(start, start + MAX_SEED_ITEMS)
    const adjustedIndex = Math.max(0, Math.min(slice.length - 1, pq.currentIndex - start))

    const ids = slice.map((el: redux.PlayQueueElement) => String(el.mediaItemId))
    const built = await buildQueueInputs(ids)
    const queue: QueueTrack[] = slice.map((el: redux.PlayQueueElement, i: number) => {
      const uid = `seed-${i}-${el.uid}`
      return {
        ...built[i]!,
        trackId: String(el.mediaItemId),
        uid,
        addedBy: hostProfile,
      }
    })
    return { queue, currentIndex: adjustedIndex }
  }

  async snapshotInputsFromTrackIds(trackIds: string[]): Promise<QueueTrackInput[]> {
    return buildQueueInputs(trackIds)
  }

  applyRoomToNative(room: RoomSnapshot): void {
    this.roomTrackByRoomUid.clear()
    for (const item of room.queue) {
      this.roomTrackByRoomUid.set(item.uid, item)
    }

    const pq = PlayState.playQueue
    const currentNative = pq.elements[pq.currentIndex]
    const targetCurrent = room.currentIndex >= 0 ? room.queue[room.currentIndex] : undefined
    const sameTrackSet =
      pq.elements.length === room.queue.length &&
      pq.elements.every((el: redux.PlayQueueElement, i: number) => String(el.mediaItemId) === room.queue[i]?.trackId) &&
      pq.currentIndex === room.currentIndex

    if (sameTrackSet) {
      this.lastObservedElements = pq.elements
      this.rebuildNativeIndexMap(room)
      return
    }

    const activePreserved =
      currentNative !== undefined &&
      targetCurrent !== undefined &&
      String(currentNative.mediaItemId) === targetCurrent.trackId

    if (activePreserved && pq.elements.length > 0 && room.queue.length > 0) {
      this.syncSurroundings(room)
      this.rebuildNativeIndexMap(room)
      return
    }

    const baseCounter = (pq.uniqueIdCounter ?? 0) + 1
    const elements = room.queue.map((t, i) => ({
      mediaItemId: toNativeItemId(t.trackId),
      priority: 'priority_none' as const,
      context: { type: 'UNKNOWN' as const },
      uid: `lj_${t.uid}_${baseCounter + i}`,
    }))
    this.ownOp(() => {
      PlayState.updatePlayQueue({
        elements,
        originalSource: elements,
        currentIndex: room.currentIndex >= 0 ? room.currentIndex : 0,
        uniqueIdCounter: baseCounter + elements.length,
      })
      if (this.hooks.getRole() === 'host') {
        if (elements.length === 0) {
          if (PlayState.playing) PlayState.pause()
        } else if (room.currentIndex >= 0) {
          PlayState.moveTo(room.currentIndex)
        }
      }
    })
    this.rebuildNativeIndexMap(room)
  }

  trackByNativeUid(nativeUid: string): QueueTrack | undefined {
    return this.roomTrackByNativeUid.get(nativeUid)
  }

  trackByRoomUid(roomUid: string): QueueTrack | undefined {
    return this.roomTrackByRoomUid.get(roomUid)
  }

  roomUidAtNativeIndex(index: number): string | null {
    const el = PlayState.playQueue.elements[index]
    return el ? this.roomUidByNativeUid.get(el.uid) ?? null : null
  }

  nativeIndexForRoomUid(roomUid: string): number {
    for (let i = 0; i < PlayState.playQueue.elements.length; i++) {
      if (this.roomUidByNativeUid.get(PlayState.playQueue.elements[i]!.uid) === roomUid) return i
    }
    return -1
  }

  roomIndexForNativeIndex(nativeIndex: number): number {
    const room = this.hooks.getRoom()
    if (!room || room.queue.length === 0) return -1
    const el = PlayState.playQueue.elements[nativeIndex]
    if (el) {
      const roomUid = this.roomUidByNativeUid.get(el.uid)
      if (roomUid) {
        const idx = room.queue.findIndex((t) => t.uid === roomUid)
        if (idx >= 0) return idx
      }
      const trackIdx = room.queue.findIndex((t) => t.trackId === String(el.mediaItemId))
      if (trackIdx >= 0) return trackIdx
    }
    return Math.max(0, Math.min(room.queue.length - 1, nativeIndex))
  }

  clearMappings(): void {
    this.roomUidByNativeUid.clear()
    this.roomTrackByNativeUid.clear()
    this.roomTrackByRoomUid.clear()
  }

  private syncSurroundings(room: RoomSnapshot): void {
    const pq = PlayState.playQueue
    const targetCurrent = room.queue[room.currentIndex]
    if (!targetCurrent) return

    this.ownOp(() => {
      const currentEl = PlayState.playQueue.elements[PlayState.playQueue.currentIndex]
      const currentNativeUid = currentEl?.uid

      const currentLive = () => PlayState.playQueue.elements
      for (let i = currentLive().length - 1; i >= 0; i--) {
        const el = currentLive()[i]!
        if (el.uid !== currentNativeUid) {
          redux.actions['playQueue/REMOVE_AT_INDEX']({ index: i })
        }
      }

      const beforeIds = room.queue.slice(0, room.currentIndex).map((t) => toNativeItemId(t.trackId))
      if (beforeIds.length > 0) {
        redux.actions['playQueue/ADD_AT_INDEX']({
          mediaItemIds: beforeIds,
          index: 0,
          context: { type: 'UNKNOWN' },
        })
      }

      const afterIds = room.queue.slice(room.currentIndex + 1).map((t) => toNativeItemId(t.trackId))
      if (afterIds.length > 0) {
        redux.actions['playQueue/ADD_LAST']({
          mediaItemIds: afterIds,
          context: { type: 'UNKNOWN' },
        })
      }

      if (PlayState.playQueue.currentIndex !== room.currentIndex) {
        redux.actions['playQueue/SET_CURRENT_INDEX'](room.currentIndex)
      }

      if (pq.shuffleModeEnabled) {
        redux.actions['playQueue/DISABLE_SHUFFLE_MODE']()
      }
    })
  }

  private rebuildNativeIndexMap(room: RoomSnapshot): void {
    this.roomUidByNativeUid.clear()
    this.roomTrackByNativeUid.clear()
    const elements = PlayState.playQueue.elements
    const count = Math.min(elements.length, room.queue.length)
    for (let i = 0; i < count; i++) {
      const el = elements[i]!
      const roomTrack = room.queue[i]!
      if (String(el.mediaItemId) === roomTrack.trackId) {
        this.roomUidByNativeUid.set(el.uid, roomTrack.uid)
        this.roomTrackByNativeUid.set(el.uid, roomTrack)
      }
    }
  }

  private scheduleGuestRestore(): void {
    if (this.pendingGuestRestore) return
    this.pendingGuestRestore = true
    queueMicrotask(() => {
      this.pendingGuestRestore = false
      if (!this.hooks.isActive() || this.hooks.getRole() !== 'guest') return
      const room = this.hooks.getRoom()
      if (room) this.applyRoomToNative(room)
    })
  }

  private scheduleHostReconcile(): void {
    if (this.pendingHostReconcile) return
    this.pendingHostReconcile = true
    queueMicrotask(async () => {
      this.pendingHostReconcile = false
      if (!this.hooks.isActive() || this.hooks.getRole() !== 'host') return
      const pq = PlayState.playQueue
      const existingByNative = new Map(this.roomTrackByNativeUid)
      const win = 80
      const start = pq.elements.length <= win ? 0 : Math.max(0, Math.min(pq.currentIndex - 10, pq.elements.length - win))
      const slices = pq.elements.slice(start, start + win)
      const relIndex = slices.length === 0 ? -1 : Math.max(0, Math.min(slices.length - 1, pq.currentIndex - start))

      const replacements: QueueTrackReplace[] = await Promise.all(
        slices.map(async (el: redux.PlayQueueElement, i: number) => {
          const trackId = String(el.mediaItemId)
          const existing = existingByNative.get(el.uid)
          if (existing && existing.trackId === trackId) {
            return {
              uid: existing.uid,
              trackId,
              title: existing.title,
              artist: existing.artist,
              ...(existing.album ? { album: existing.album } : {}),
              ...(existing.coverUrl ? { coverUrl: existing.coverUrl } : {}),
              ...(existing.durationSec !== undefined ? { durationSec: existing.durationSec } : {}),
            }
          }
          const cached = getCachedMeta(trackId)
          const item = cached ? null : await MediaItem.fromId(trackId).catch(() => undefined)
          const title = cached?.title ?? (item ? await item.title().catch(() => item.tidalItem?.title ?? '') : '')
          const artist =
            cached?.artist ??
            (item?.tidalItem?.artists ?? [])
              .map((a) => a.name)
              .filter(Boolean)
              .join(', ')
          const album = cached?.album ?? item?.tidalItem?.album?.title?.trim()
          const coverUrl = cached?.coverUrl ?? (item ? await item.coverUrl({ res: '320' }).catch(() => undefined) : undefined)
          const durationSec = cached?.durationSec ?? item?.duration
          return {
            uid: `host-${el.uid}-${i}`,
            trackId,
            title,
            artist,
            ...(album ? { album } : {}),
            ...(coverUrl ? { coverUrl } : {}),
            ...(durationSec !== undefined ? { durationSec } : {}),
          }
        }),
      )

      this.hooks.onHostReplaceQueue(replacements, relIndex)
      this.hooks.onHostQueueReconciled?.(relIndex)
    })
  }

  private ownOp(fn: () => void): void {
    this.selfOps++
    try {
      fn()
    } finally {
      this.lastObservedElements = PlayState.playQueue.elements
      this.selfOps--
    }
  }
}
