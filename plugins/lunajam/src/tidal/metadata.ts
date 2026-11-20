import { MediaItem } from '@luna/lib'
import type { QueueTrack, QueueTrackInput, TrackMetaUpdate } from '../protocol'

const cache = new Map<string, TrackMetaUpdate>()
const inflight = new Map<string, Promise<TrackMetaUpdate | null>>()

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
      const item = await MediaItem.fromId(trackId)
      if (!item) return null
      const tidalItem = item.tidalItem
      const rawTitle = await item.title().catch(() => tidalItem?.title ?? '')
      const artistsList = await item.artists().catch(() => [])
      const resolvedArtists = await Promise.all(artistsList)
      const namesFromResolved = resolvedArtists.map((a) => a?.name).filter((n): n is string => Boolean(n))
      const namesFromRaw = (tidalItem?.artists ?? []).map((a) => a?.name).filter((n): n is string => Boolean(n))
      const artist = (namesFromResolved.length > 0 ? namesFromResolved : namesFromRaw).join(', ')
      const albumObj = await item.album().catch(() => undefined)
      const albumTitle = albumObj ? await albumObj.title().catch(() => tidalItem?.album?.title) : tidalItem?.album?.title
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
  const missing = queue.filter((t) => (!t.title || !t.artist || !t.coverUrl) && !attempted.has(t.trackId))
  if (missing.length === 0) return []
  const uniqueIds = [...new Set(missing.map((t) => t.trackId))].slice(0, 12)
  for (const id of uniqueIds) attempted.add(id)
  const resolved = await Promise.all(uniqueIds.map((id) => resolveTrackMeta(id)))
  return resolved.filter((m): m is TrackMetaUpdate => m !== null && Boolean(m.title))
}
