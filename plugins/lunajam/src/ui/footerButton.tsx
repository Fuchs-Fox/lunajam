import type { LunaUnload } from '@luna/core'
import { redux } from '@luna/lib'
import { useEffect, useState, type FC } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SessionClient, SessionState } from '../session/client'
import { IconJam } from './icons'
import type { PopoverController } from './popover'
import { findPlayQueueAside, type QueueHeaderMount } from './queueHeader'

function findUtilityContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const footer = document.querySelector<HTMLElement>('[data-test="footer-player"]')
  if (!footer) return null
  const explicit =
    footer.querySelector<HTMLElement>('[data-lj-footer-utility]') ??
    footer.querySelector<HTMLElement>('[class*="utilityButtons"]') ??
    footer.querySelector<HTMLElement>('[class*="utilityContainer"]') ??
    footer.querySelector<HTMLElement>('[class*="rightControls"]')
  if (explicit) return explicit
  const lyricsBtn = footer.querySelector<HTMLElement>('[data-test="toggle-lyrics"]')
  if (lyricsBtn?.parentElement) return lyricsBtn.parentElement
  const queueBtn = footer.querySelector<HTMLElement>('[data-test*="queue"], [aria-label*="queue" i], [title*="queue" i]')
  if (queueBtn?.parentElement) return queueBtn.parentElement
  return footer.lastElementChild as HTMLElement | null
}

const FooterJamButton: FC<{
  session: SessionClient
  onTrigger: (buttonEl: HTMLButtonElement) => void
}> = ({ session, onTrigger }) => {
  const [state, setState] = useState<SessionState>(() => session.snapshot())

  useEffect(() => session.subscribe(setState), [session])

  const live = Boolean(state.room) || state.status === 'connecting' || state.status === 'reconnecting'
  const count = state.room?.participants.length ?? 0

  return (
    <button
      type="button"
      className={`lj-footer-btn${live ? ' is-live' : ''}`}
      data-test="lunajam-footer-btn"
      aria-label={live ? `Jam active with ${count} listening` : 'Start or join a Jam'}
      onClick={(ev) => onTrigger(ev.currentTarget)}
    >
      {live && <span className="lj-dot" aria-hidden="true" />}
      <IconJam />
      {live && <span>{count > 0 ? count : '…'}</span>}
    </button>
  )
}

export class FooterButtonMount {
  private host: HTMLSpanElement | null = null
  private root: Root | null = null
  private observer: MutationObserver | null = null
  private syncing = false

  constructor(
    unloads: Set<LunaUnload>,
    private session: SessionClient,
    private popover: PopoverController,
    private queueHeader: QueueHeaderMount,
  ) {
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
      this.observer = new MutationObserver((mutations) => {
        if (this.syncing) return
        const relevant = mutations.some((m) => !(m.target as Element | null)?.closest?.('.lj-footer-host'))
        if (relevant) this.sync()
      })
      this.observer.observe(document.body, { childList: true, subtree: true })
    }

    unloads.add(() => this.dispose())
    this.sync()
  }

  sync(): void {
    if (this.syncing || typeof document === 'undefined') return
    if (this.host?.isConnected && this.root) return
    this.syncing = true
    try {
      const container = findUtilityContainer()
      if (!container) return
      if (!this.host) {
        this.host = document.createElement('span')
        this.host.className = 'lj-root lj-footer-host'
        this.host.style.display = 'inline-flex'
        this.host.style.alignItems = 'center'
      }
      if (!this.host.isConnected || this.host.parentElement !== container) {
        const queueToggle = container.querySelector<HTMLElement>(
          '[data-test*="queue"], [aria-label*="queue" i], [title*="queue" i]',
        )
        if (queueToggle && queueToggle.parentElement === container) {
          container.insertBefore(this.host, queueToggle)
        } else {
          container.prepend(this.host)
        }
      }
      if (!this.root) {
        this.root = createRoot(this.host)
        this.root.render(
          <FooterJamButton
            session={this.session}
            onTrigger={(btn) => this.handleTrigger(btn)}
          />,
        )
      }
    } finally {
      this.syncing = false
    }
  }

  private handleTrigger(btn: HTMLButtonElement): void {
    if (this.popover.isOpen()) {
      this.popover.close()
      return
    }
    const state = this.session.snapshot()
    const active = Boolean(state.room) || state.status === 'connecting' || state.status === 'reconnecting'
    if (!active) {
      this.popover.open(btn)
      return
    }
    if (findPlayQueueAside()) {
      this.queueHeader.pulse()
      this.popover.open(btn)
      return
    }
    try {
      redux.actions['view/TOGGLE_PLAY_QUEUE_VISIBILITY']()
    } catch {
      this.popover.open(btn)
      return
    }
    setTimeout(() => {
      this.queueHeader.sync()
      if (findPlayQueueAside()) {
        this.queueHeader.pulse()
      } else {
        this.popover.open(btn)
      }
    }, 160)
  }

  private dispose(): void {
    this.observer?.disconnect()
    this.observer = null
    this.root?.unmount()
    this.root = null
    this.host?.remove()
    this.host = null
  }
}
