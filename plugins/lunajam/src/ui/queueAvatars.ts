import type { LunaUnload } from '@luna/core'
import { PlayState } from '@luna/lib'
import type { QueueTrack } from '../protocol'
import type { SessionClient } from '../session/client'
import type { TidalQueueSync } from '../tidal/queueSync'
import { avatarColor, initialsFor } from './Avatar'
import { openParticipantMenu } from './participantMenu'
import { findPlayQueueAside } from './queueHeader'

type FiberNode = {
  memoizedProps?: Record<string, unknown>
  return?: FiberNode | null
  alternate?: FiberNode | null
  tag?: number
  stateNode?: { current?: FiberNode }
}

function isCurrentFiber(fiber: FiberNode): boolean {
  let node: FiberNode = fiber
  while (node.return) node = node.return
  return node.tag === 3 && node.stateNode?.current === node
}

function extractRowProps(row: Element): { uid?: string; trackId?: string; index?: number } {
  const attrUid = row.getAttribute('data-lj-uid') ?? undefined
  const attrTrackId = row.getAttribute('data-lj-track-id') ?? undefined
  const attrIndex = row.getAttribute('data-lj-index')
  const domMediaId = row.getAttribute('data-test-media-item-id') ?? undefined
  if (attrUid || attrTrackId || attrIndex !== null) {
    return {
      uid: attrUid,
      trackId: attrTrackId ?? domMediaId,
      index: attrIndex !== null ? Number.parseInt(attrIndex, 10) : undefined,
    }
  }

  const fiberKey = Object.keys(row).find((k) => k.startsWith('__reactFiber$'))
  if (!fiberKey) return domMediaId ? { trackId: domMediaId } : {}
  let fiber = (row as unknown as Record<string, FiberNode | undefined>)[fiberKey]
  for (let depth = 0; fiber && depth < 16; depth++, fiber = fiber.return ?? undefined) {
    const active = isCurrentFiber(fiber) ? fiber : fiber.alternate ?? fiber
    const props = active?.memoizedProps
    if (!props) continue
    const item = props.item as Record<string, unknown> | undefined
    const element = props.element as Record<string, unknown> | undefined
    const uid =
      (typeof props.uid === 'string' && props.uid) ||
      (typeof element?.uid === 'string' && element.uid) ||
      (typeof item?.uid === 'string' && item.uid) ||
      undefined
    const rawTrackId =
      props.mediaItemId ??
      element?.mediaItemId ??
      item?.mediaItemId ??
      (item?.item as Record<string, unknown> | undefined)?.id ??
      item?.id
    const trackId = rawTrackId !== undefined && rawTrackId !== null ? String(rawTrackId) : undefined
    const index = typeof props.index === 'number' ? props.index : undefined
    if (uid || trackId || index !== undefined) {
      return { uid, trackId: trackId ?? domMediaId, index }
    }
  }
  return domMediaId ? { trackId: domMediaId } : {}
}

function findQueueRows(aside: HTMLElement): HTMLElement[] {
  const rows = [
    ...aside.querySelectorAll<HTMLElement>(
      '[data-test="playqueue-item"], [data-test="play-queue-item"], [data-lj-queue-row], [class*="_queueItem_"], [data-test="tracklist-row"]',
    ),
  ]
  return rows.filter((r) => !r.closest('.lj-queue-mount'))
}

function renderAvatarBadge(
  track: QueueTrack,
  muted: boolean,
  onInspect: (anchor: HTMLElement) => void,
): HTMLButtonElement {
  const wrap = document.createElement('button')
  wrap.type = 'button'
  wrap.className = `lj-root lj-track-avatar${muted ? ' is-muted-add' : ''}`
  wrap.setAttribute('data-tooltip', `Added by ${track.addedBy.name}`)
  wrap.setAttribute('data-lj-uid', track.uid)
  wrap.setAttribute('aria-label', `Added by ${track.addedBy.name}`)
  wrap.addEventListener('mousedown', (ev) => ev.stopPropagation())
  wrap.addEventListener('click', (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    onInspect(wrap)
  })

  const inner = document.createElement('span')
  inner.className = 'lj-track-avatar-inner'
  inner.style.backgroundColor = avatarColor(track.addedBy.name)

  if (track.addedBy.avatarUrl) {
    const img = document.createElement('img')
    img.src = track.addedBy.avatarUrl
    img.alt = track.addedBy.name
    inner.appendChild(img)
  } else {
    inner.textContent = initialsFor(track.addedBy.name)
  }

  wrap.appendChild(inner)
  return wrap
}

export class QueueAvatarDecorator {
  private observer: MutationObserver | null = null
  private syncing = false

  constructor(
    unloads: Set<LunaUnload>,
    private session: SessionClient,
    private queueSync: TidalQueueSync,
  ) {
    const unsub = this.session.subscribe(() => this.refresh())
    unloads.add(unsub)

    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
      this.observer = new MutationObserver((mutations) => {
        if (this.syncing) return
        const relevant = mutations.some((m) => {
          const el = m.target as Element | null
          return !el?.closest?.('.lj-track-avatar') && !el?.closest?.('.lj-queue-mount') && !el?.closest?.('.lj-ctx-layer')
        })
        if (relevant) this.refresh()
      })
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-test-media-item-id'],
      })
    }

    unloads.add(() => this.dispose())
    this.refresh()
  }

  refresh(): void {
    if (this.syncing || typeof document === 'undefined') return
    this.syncing = true
    try {
      const room = this.session.snapshot().room
      const aside = room ? findPlayQueueAside() : null
      if (!room || !aside) {
        this.clearBadges()
        return
      }

      const rows = findQueueRows(aside)
      const elements = PlayState.playQueue.elements
      const usedTrackIdx = new Set<number>()

      rows.forEach((row, domIdx) => {
        const info = extractRowProps(row)
        let track: QueueTrack | undefined

        if (info.uid) {
          track = this.queueSync.trackByNativeUid(info.uid) ?? this.queueSync.trackByRoomUid(info.uid)
        }
        if (!track && info.index !== undefined && info.index >= 0) {
          const nativeEl = elements[info.index]
          if (nativeEl) track = this.queueSync.trackByNativeUid(nativeEl.uid)
          track ??= room.queue[info.index]
        }
        if (!track && info.trackId) {
          const matchIdx = room.queue.findIndex((t, i) => t.trackId === info.trackId && !usedTrackIdx.has(i))
          if (matchIdx >= 0) {
            usedTrackIdx.add(matchIdx)
            track = room.queue[matchIdx]
          }
        }
        if (!track) {
          const fallbackIdx = Math.max(0, room.currentIndex) + domIdx
          track = room.queue[fallbackIdx] ?? room.queue[domIdx]
        }

        const existing = row.querySelector<HTMLElement>('.lj-track-avatar')
        if (!track) {
          existing?.remove()
          return
        }

        const activeTrack = track
        const participant = room.participants.find((p) => p.cid === activeTrack.addedBy.cid)
        const muted = Boolean(participant && participant.role === 'guest' && !participant.canAddTracks)

        if (existing?.getAttribute('data-lj-uid') === activeTrack.uid) {
          existing.classList.toggle('is-muted-add', muted)
          return
        }

        existing?.remove()
        const badge = renderAvatarBadge(activeTrack, muted, (anchor) =>
          openParticipantMenu({ anchor, target: activeTrack.addedBy, session: this.session }),
        )
        const durationSlot = row.querySelector<HTMLElement>(
          '[data-test="duration"], [class*="_duration_"], [class*="_actions_"], [class*="_more_"]',
        )
        if (durationSlot && durationSlot.parentElement === row) {
          row.insertBefore(badge, durationSlot)
        } else {
          row.appendChild(badge)
        }
      })
    } finally {
      this.syncing = false
    }
  }

  private clearBadges(): void {
    if (typeof document === 'undefined') return
    for (const el of document.querySelectorAll('.lj-track-avatar')) {
      el.remove()
    }
  }

  private dispose(): void {
    this.observer?.disconnect()
    this.observer = null
    this.clearBadges()
  }
}
