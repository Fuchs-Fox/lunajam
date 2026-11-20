import type { LunaUnload } from '@luna/core'
import { useEffect, useState, type FC } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SessionClient, SessionState } from '../session/client'
import { JamBody } from './JamBody'
import { openParticipantMenu } from './participantMenu'

export function findPlayQueueAside(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const pqHeader = document.querySelector<HTMLElement>('[data-test="playqueue-header"]')
  if (pqHeader?.parentElement) return pqHeader.parentElement
  const pqContainer = document.querySelector<HTMLElement>('[data-test="playqueue"]')
  if (pqContainer) return pqContainer
  const titleEl = document.querySelector<HTMLElement>('[data-test="playqueue-title"]')
  if (titleEl) {
    const panel =
      titleEl.closest<HTMLElement>(
        '[data-test="playqueue"], [class*="_playQueueItemsContainer_"], [class*="_container_"], aside',
      ) ?? titleEl.parentElement?.parentElement
    if (panel) return panel
  }
  const direct = document.querySelector<HTMLElement>(
    '[data-test="play-queue"], [data-lj-play-queue], aside[aria-label*="queue" i], [class*="_playQueueWrapper_"], [class*="_playQueue_"]',
  )
  if (direct) return direct
  const item = document.querySelector<HTMLElement>(
    '[data-test="playqueue-item"], [data-test="play-queue-item"], [data-lj-queue-row]',
  )
  if (!item) return null
  return item.closest<HTMLElement>(
    '[data-test="playqueue"], aside, [role="complementary"], section, [class*="_playQueueWrapper_"], [class*="_sidebar_"]',
  )
}

const QueueHeaderCard: FC<{
  session: SessionClient
  pulsing: boolean
  onSelectTrack: (uid: string) => void
}> = ({ session, pulsing, onSelectTrack }) => {
  const [state, setState] = useState<SessionState>(() => session.snapshot())

  useEffect(() => session.subscribe(setState), [session])

  return (
    <div className={`lj-queue-card${pulsing ? ' is-pulsing' : ''}`}>
      <JamBody
        room={state.room}
        cid={state.cid}
        status={state.status}
        role={state.role}
        audioMode={state.audioMode}
        serverUrl={state.serverUrl}
        error={state.error}
        showQueuePreview={false}
        onLeave={() => session.leaveRoom()}
        onEnd={() => session.endRoom()}
        onTogglePermissions={(patch) => session.setPermissions(patch)}
        onChangeAudioMode={(mode) => session.setAudioMode(mode)}
        onKick={(cid) => session.kick(cid)}
        onKickAll={() => session.kickAll()}
        onSelectTrack={onSelectTrack}
        onInspectParticipant={(profile, anchor) => openParticipantMenu({ anchor, target: profile, session })}
      />
    </div>
  )
}

export class QueueHeaderMount {
  private container: HTMLDivElement | null = null
  private root: Root | null = null
  private observer: MutationObserver | null = null
  private pulseTimer: ReturnType<typeof setTimeout> | null = null
  private pulsing = false
  private syncing = false

  constructor(
    unloads: Set<LunaUnload>,
    private session: SessionClient,
    private onSelectTrack: (uid: string) => void,
  ) {
    const unsub = this.session.subscribe(() => this.sync())
    unloads.add(unsub)

    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
      this.observer = new MutationObserver((mutations) => {
        if (this.syncing) return
        const relevant = mutations.some(
          (m) => !(m.target as Element | null)?.closest?.('.lj-queue-mount, .lj-ctx-layer'),
        )
        if (relevant) this.sync()
      })
      this.observer.observe(document.body, { childList: true, subtree: true })
    }

    unloads.add(() => this.dispose())
    this.sync()
  }

  pulse(): void {
    if (!this.container || !this.root) return
    this.pulsing = true
    this.render()
    if (this.pulseTimer !== null) clearTimeout(this.pulseTimer)
    this.pulseTimer = setTimeout(() => {
      this.pulseTimer = null
      this.pulsing = false
      this.render()
    }, 650)
  }

  sync(): void {
    if (this.syncing) return
    this.syncing = true
    try {
      const state = this.session.snapshot()
      const active = Boolean(state.room) || state.status === 'connecting' || state.status === 'reconnecting'
      const aside = active ? findPlayQueueAside() : null

      if (!active || !aside) {
        this.unmountCard()
        return
      }

      if (!this.container) {
        this.container = document.createElement('div')
        this.container.className = 'lj-root lj-queue-mount'
      }

      if (!this.container.isConnected || this.container.parentElement !== aside) {
        const directHeader = aside.querySelector<HTMLElement>(':scope > [data-test="playqueue-header"]')
        const titleParent = aside.querySelector<HTMLElement>('[data-test="playqueue-title"]')?.parentElement
        const headerEl =
          directHeader ??
          (titleParent && titleParent.parentElement === aside ? titleParent : null) ??
          aside.querySelector<HTMLElement>(
            ':scope > [data-test="play-queue-header"], :scope > header, :scope > [class*="_header_"]',
          )
        if (headerEl && headerEl.parentElement === aside) {
          headerEl.insertAdjacentElement('afterend', this.container)
        } else {
          aside.prepend(this.container)
        }
      }

      if (!this.root) {
        this.root = createRoot(this.container)
      }
      this.render()
    } finally {
      this.syncing = false
    }
  }

  private render(): void {
    this.root?.render(
      <QueueHeaderCard session={this.session} pulsing={this.pulsing} onSelectTrack={this.onSelectTrack} />,
    )
  }

  private unmountCard(): void {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }

  private dispose(): void {
    if (this.pulseTimer !== null) clearTimeout(this.pulseTimer)
    this.observer?.disconnect()
    this.observer = null
    this.unmountCard()
  }
}
