import { useEffect, useState, type FC } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Profile } from '../protocol'
import type { SessionClient, SessionState } from '../session/client'
import { openTidalProfile } from '../tidal/identity'
import { Avatar } from './Avatar'
import { IconBan, IconUser } from './icons'

export interface ParticipantMenuTarget {
  anchor: HTMLElement
  target: Profile
  session: SessionClient
}

const ParticipantMenuView: FC<{
  target: Profile
  session: SessionClient
  leaving: boolean
  onClose: () => void
  onPositioned: () => void
}> = ({ target, session, leaving, onClose, onPositioned }) => {
  const [state, setState] = useState<SessionState>(() => session.snapshot())

  useEffect(() => session.subscribe(setState), [session])
  useEffect(() => {
    onPositioned()
  }, [state, onPositioned])

  const participant = state.room?.participants.find((p) => p.cid === target.cid)
  const effectiveProfile: Profile = participant
    ? {
        ...target,
        ...participant,
        tidalUserId: participant.tidalUserId ?? target.tidalUserId,
        profilePath: participant.profilePath ?? target.profilePath,
      }
    : target

  const isSelf = effectiveProfile.cid === state.cid
  const isHost = state.role === 'host'
  const isGuestMember = Boolean(participant && participant.role === 'guest')
  const hasTidalProfile = Boolean(effectiveProfile.profilePath)

  const subtitle = !participant
    ? 'Left Jam'
    : participant.role === 'host'
      ? 'Host'
      : participant.canAddTracks
        ? 'Guest'
        : 'Guest · Add off'

  return (
    <div
      className={`lj-ctx-menu${leaving ? ' is-leaving' : ''}`}
      role="menu"
      aria-label={`${effectiveProfile.name} options`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="lj-ctx-head">
        <Avatar profile={effectiveProfile} size={28} mutedAdd={isGuestMember && !participant!.canAddTracks} />
        <div className="lj-ctx-meta">
          <div className="lj-ctx-name">
            {effectiveProfile.name}
            {isSelf ? ' (you)' : ''}
          </div>
          <div className={`lj-ctx-sub${participant?.role === 'host' ? ' is-host' : ''}`}>{subtitle}</div>
        </div>
      </div>

      <div className="lj-ctx-sep" />

      <button
        type="button"
        role="menuitem"
        className="lj-ctx-item"
        disabled={!hasTidalProfile}
        title={hasTidalProfile ? 'Open TIDAL profile' : 'No public TIDAL profile'}
        onClick={() => {
          if (!effectiveProfile.profilePath) return
          openTidalProfile(effectiveProfile.profilePath)
          onClose()
        }}
      >
        <IconUser />
        <span>View profile</span>
      </button>

      {isHost && !isSelf && isGuestMember && participant && (
        <>
          <div className="lj-ctx-sep" />

          <div className="lj-ctx-toggle">
            <span className="lj-ctx-toggle-label">Can add tracks</span>
            <button
              type="button"
              role="switch"
              aria-checked={participant.canAddTracks}
              aria-label={`Allow ${effectiveProfile.name} to add tracks`}
              className={`lj-switch${participant.canAddTracks ? ' is-on' : ''}`}
              onClick={() => session.setMemberCanAdd(participant.cid, !participant.canAddTracks)}
            >
              <span className="lj-switch-knob" />
            </button>
          </div>

          <button
            type="button"
            role="menuitem"
            className="lj-ctx-item is-danger"
            onClick={() => {
              session.kick(participant.cid)
              onClose()
            }}
          >
            <IconBan />
            <span>Ban from Jam</span>
          </button>
        </>
      )}
    </div>
  )
}

class ParticipantMenuController {
  private layer: HTMLDivElement | null = null
  private root: Root | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private unsubSession: (() => void) | null = null
  private currentAnchor: HTMLElement | null = null
  private currentTarget: Profile | null = null
  private currentSession: SessionClient | null = null
  private openState = false

  open(opts: ParticipantMenuTarget): void {
    if (typeof document === 'undefined' || !document.body) return
    if (this.openState && this.currentAnchor === opts.anchor && this.currentTarget?.cid === opts.target.cid) {
      this.close()
      return
    }
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    this.unsubSession?.()
    this.currentAnchor = opts.anchor
    this.currentTarget = opts.target
    this.currentSession = opts.session
    this.unsubSession = opts.session.subscribe((s) => {
      if (!s.room) this.unmount()
    })

    if (!this.layer) {
      this.layer = document.createElement('div')
      this.layer.className = 'lj-root lj-ctx-layer'
      document.body.appendChild(this.layer)
      this.root = createRoot(this.layer)
      document.addEventListener('mousedown', this.onDocDown, true)
      document.addEventListener('keydown', this.onKeyDown, true)
      document.addEventListener('scroll', this.onDocScroll, true)
      window.addEventListener('resize', this.positionLayer)
    }

    this.openState = true
    this.render(false)
  }

  close(): void {
    if (!this.openState || !this.layer || !this.root) return
    this.openState = false
    this.render(true)
    if (this.closeTimer !== null) clearTimeout(this.closeTimer)
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      this.unmount()
    }, 130)
  }

  unmount(): void {
    this.openState = false
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    this.unsubSession?.()
    this.unsubSession = null
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousedown', this.onDocDown, true)
      document.removeEventListener('keydown', this.onKeyDown, true)
      document.removeEventListener('scroll', this.onDocScroll, true)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.positionLayer)
    }
    this.root?.unmount()
    this.root = null
    this.layer?.remove()
    this.layer = null
    this.currentAnchor = null
    this.currentTarget = null
    this.currentSession = null
  }

  private render(leaving: boolean): void {
    if (!this.root || !this.currentTarget || !this.currentSession) return
    this.root.render(
      <ParticipantMenuView
        target={this.currentTarget}
        session={this.currentSession}
        leaving={leaving}
        onClose={() => this.close()}
        onPositioned={this.positionLayer}
      />,
    )
    this.positionLayer()
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.positionLayer())
    }
  }

  private positionLayer = (): void => {
    if (!this.layer || typeof window === 'undefined') return
    const rect = this.currentAnchor?.getBoundingClientRect()
    const menu = this.layer.firstElementChild as HTMLElement | null
    const width = menu?.offsetWidth || 228
    const height = menu?.offsetHeight || 156
    const vw = window.innerWidth || 1280
    const vh = window.innerHeight || 800

    if (!rect || (rect.width === 0 && rect.height === 0)) {
      this.layer.style.top = '120px'
      this.layer.style.left = `${Math.max(12, vw - width - 24)}px`
      return
    }

    const left = Math.max(12, Math.min(vw - width - 12, Math.round(rect.right - width)))
    const fitsBelow = rect.bottom + 8 + height <= vh - 12
    const fitsAbove = rect.top - 8 - height >= 12
    const rawTop = fitsBelow ? rect.bottom + 8 : fitsAbove ? rect.top - 8 - height : vh - height - 12
    const top = Math.max(12, Math.min(vh - height - 12, Math.round(rawTop)))

    this.layer.style.left = `${left}px`
    this.layer.style.top = `${top}px`
  }

  private onDocDown = (ev: MouseEvent): void => {
    const target = ev.target as Node | null
    if (!target || !this.layer) return
    if (this.layer.contains(target)) return
    if (this.currentAnchor && this.currentAnchor.contains(target)) return
    this.close()
  }

  private onDocScroll = (ev: Event): void => {
    const target = ev.target as Node | null
    if (target && this.layer?.contains(target)) return
    this.close()
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') this.close()
  }
}

const controller = new ParticipantMenuController()

export function openParticipantMenu(opts: ParticipantMenuTarget): void {
  controller.open(opts)
}

export function closeParticipantMenu(): void {
  controller.close()
}

export function unmountParticipantMenu(): void {
  controller.unmount()
}
