import { MediaItem, redux } from '@luna/lib'
import type { QueueTrack, QueueTrackInput, TrackMetaUpdate } from '../protocol'

const cache = new Map<string, TrackMetaUpdate>()
const inflight = new Map<string, Promise<TrackMetaUpdate | null>>()
const storeLoadInFlight = new Map<string, Promise<boolean>>()
const MAX_META_CACHE = 500

export function toNativeItemId(trackId: string): redux.ItemId {
  const num = Number(trackId)
  return Number.isInteger(num) && num > 0 ? num : trackId
}

export function isTrackInStore(trackId: string): boolean {
  const state = redux.store.getState() as { content?: { mediaItems?: Record<string, unknown> } }
  if (!state.content?.mediaItems) return true
  return Boolean(state.content.mediaItems[String(trackId)])
}

export function ensureTrackInStore(trackId: string): Promise<boolean> {
  if (isTrackInStore(trackId)) return Promise.resolve(true)
  const existing = storeLoadInFlight.get(trackId)
  if (existing) return existing
  const work = (async () => {
    try {
      const item = await MediaItem.fromId(toNativeItemId(trackId))
      if (item && !cache.has(trackId)) {
        resolveTrackMeta(trackId).catch(() => {})
      }
      return isTrackInStore(trackId) || Boolean(item)
    } catch {
      return false
    } finally {
      storeLoadInFlight.delete(trackId)
    }
  })()
  storeLoadInFlight.set(trackId, work)
  return work
}

export async function ensureQueueInStore(trackIds: string[], priorityTrackId?: string | null): Promise<boolean> {
  const uniqueIds = [...new Set(trackIds.filter(Boolean))]
  let fetchedAny = false
  if (priorityTrackId && !isTrackInStore(priorityTrackId)) {
    await ensureTrackInStore(priorityTrackId)
    fetchedAny = true
  }
  const missing = uniqueIds.filter((id) => id !== priorityTrackId && !isTrackInStore(id))
  if (missing.length > 0) {
    fetchedAny = true
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4)
      await Promise.all(chunk.map((id) => ensureTrackInStore(id)))
    }
  }
  return fetchedAny
}

export function getCachedMeta(trackId: string): TrackMetaUpdate | undefined {
  return cache.get(trackId)
}

export async function resolveTrackMeta(trackId: string): Promise<TrackMetaUpdate | null> {
  const hit = cache.get(trackId)
  if (hit) return hit
  const pending = inflight.get(trackId)
  if (pending) return pending

  const work = (async () => {
    try {
      const item = await MediaItem.fromId(toNativeItemId(trackId))
      if (!item) return null
      const tidalItem = item.tidalItem
      const rawTitle = await item.title().catch(() => tidalItem?.title ?? '')
      const artistsList = await item.artists().catch(() => [])
      const resolvedArtists = await Promise.all(artistsList)
      const namesFromResolved = resolvedArtists.map((a) => a?.name).filter((n): n is string => Boolean(n))
      const namesFromRaw = (tidalItem?.artists ?? []).map((a) => a?.name).filter((n): n is string => Boolean(n))
      const artist = (namesFromResolved.length > 0 ? namesFromResolved : namesFromRaw).join(', ')
      const directAlbum = tidalItem?.album?.title?.trim()
      const albumObj = directAlbum ? undefined : await item.album().catch(() => undefined)
      const albumTitle =
        directAlbum ||
        (albumObj as { tidalAlbum?: { title?: string } } | undefined)?.tidalAlbum?.title?.trim() ||
        (albumObj ? await albumObj.title().catch(() => undefined) : undefined)
      const coverUrl =
        (await item.coverUrl({ res: '320' }).catch(() => undefined)) ??
        (tidalItem?.album?.cover
          ? `https://resources.tidal.com/images/${tidalItem.album.cover.split('-').join('/')}/320x320.jpg`
          : undefined)
      const durationSec = typeof item.duration === 'number' && Number.isFinite(item.duration) ? item.duration : tidalItem?.duration
      const meta: TrackMetaUpdate = {
        trackId,
        title: rawTitle || tidalItem?.title || `Track ${trackId}`,
        artist,
        ...(albumTitle ? { album: albumTitle } : {}),
        ...(coverUrl ? { coverUrl } : {}),
        ...(durationSec !== undefined ? { durationSec } : {}),
      }
      if (!cache.has(trackId) && cache.size >= MAX_META_CACHE) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
      cache.set(trackId, meta)
      return meta
    } catch {
      return null
    } finally {
      inflight.delete(trackId)
    }
  })()

  inflight.set(trackId, work)
  return work
}

export async function buildQueueInputs(trackIds: string[]): Promise<QueueTrackInput[]> {
  const metas = await Promise.all(trackIds.map((id) => resolveTrackMeta(id)))
  return trackIds.map((trackId, i) => {
    const m = metas[i]
    return {
      trackId,
      title: m?.title ?? '',
      artist: m?.artist ?? '',
      ...(m?.album ? { album: m.album } : {}),
      ...(m?.coverUrl ? { coverUrl: m.coverUrl } : {}),
      ...(m?.durationSec !== undefined ? { durationSec: m.durationSec } : {}),
    }
  })
}

export async function findMissingMetadata(queue: QueueTrack[], attempted: Set<string>): Promise<TrackMetaUpdate[]> {
  const missing = queue.filter((t) => (!t.title || !t.artist || !t.album || !t.coverUrl) && !attempted.has(t.trackId))
  if (missing.length === 0) return []
  const uniqueIds = [...new Set(missing.map((t) => t.trackId))].slice(0, 12)
  for (const id of uniqueIds) attempted.add(id)
  const resolved = await Promise.all(uniqueIds.map((id) => resolveTrackMeta(id)))
  return resolved.filter((m): m is TrackMetaUpdate => m !== null && Boolean(m.title))
}
