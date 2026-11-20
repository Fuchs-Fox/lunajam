import { useEffect, useState, type FC } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { AudioMode } from '../protocol'
import type { SessionClient, SessionState } from '../session/client'
import { storage } from '../tidal/storage'
import { JamBody } from './JamBody'
import { IconClose, IconHeadphones, IconSpeaker } from './icons'
import { openParticipantMenu } from './participantMenu'

export interface PopoverHandlers {
  session: SessionClient
  onStartJam: () => void
  onJoinJam: (input: string, mode: AudioMode) => void
  onSelectTrack: (uid: string) => void
}

const IdleBody: FC<{
  serverUrl: string
  error: string | null
  onStart: () => void
  onJoin: (input: string, mode: AudioMode) => void
  onClose: () => void
}> = ({ serverUrl, error, onStart, onJoin, onClose }) => {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<AudioMode>(storage.get().defaultGuestAudioMode)

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) onJoin(input.trim(), mode)
  }

  return (
    <div>
      <div className="lj-top-row" style={{ marginBottom: 14 }}>
        <h3 className="lj-heading">Listen together</h3>
        <button type="button" className="lj-btn lj-btn-icon" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>

      <button type="button" className="lj-btn lj-btn-primary" onClick={onStart}>
        Start a Jam
      </button>

      <hr className="lj-divider" />

      <form onSubmit={submitJoin}>
        <label className="lj-field-label" htmlFor="lj-join-input">
          Join with code or link
        </label>
        <div className="lj-input-row">
          <input
            id="lj-join-input"
            className="lj-input"
            placeholder="ABCD-EFGH"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="lj-btn" disabled={!input.trim()}>
            Join
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <span className="lj-field-label">Audio output</span>
          <div className="lj-segment" role="group" aria-label="Audio output">
            <button
              type="button"
              className={`lj-segment-btn${mode === 'remote' ? ' is-active' : ''}`}
              onClick={() => setMode('remote')}
            >
              <IconHeadphones />
              <span>This device</span>
            </button>
            <button
              type="button"
              className={`lj-segment-btn${mode === 'speaker' ? ' is-active' : ''}`}
              onClick={() => setMode('speaker')}
            >
              <IconSpeaker />
              <span>Host speaker</span>
            </button>
          </div>
        </div>
      </form>

      {error && <p className="lj-error">{error}</p>}

      <hr className="lj-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.48)' }}>
        <span>Relay</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{serverUrl.replace(/^https?:\/\//, '')}</span>
      </div>
    </div>
  )
}

const PopoverView: FC<{
  handlers: PopoverHandlers
  leaving: boolean
  onClose: () => void
}> = ({ handlers, leaving, onClose }) => {
  const [state, setState] = useState<SessionState>(() => handlers.session.snapshot())

  useEffect(() => handlers.session.subscribe(setState), [handlers.session])

  const active = Boolean(state.room) || state.status === 'connecting' || state.status === 'reconnecting'

  return (
    <div className={`lj-popover${leaving ? ' is-leaving' : ''}`} role="dialog" aria-label="LunaJam">
      {active ? (
        <JamBody
          room={state.room}
          cid={state.cid}
          status={state.status}
          role={state.role}
          audioMode={state.audioMode}
          serverUrl={state.serverUrl}
          error={state.error}
          showQueuePreview={true}
          onLeave={() => handlers.session.leaveRoom()}
          onEnd={() => handlers.session.endRoom()}
          onTogglePermissions={(patch) => handlers.session.setPermissions(patch)}
          onChangeAudioMode={(mode) => handlers.session.setAudioMode(mode)}
          onKick={(cid) => handlers.session.kick(cid)}
          onKickAll={() => handlers.session.kickAll()}
          onSelectTrack={handlers.onSelectTrack}
          onInspectParticipant={(profile, anchor) =>
            openParticipantMenu({ anchor, target: profile, session: handlers.session })
          }
          onClose={onClose}
        />
      ) : (
        <IdleBody
          serverUrl={storage.get().serverUrl}
          error={state.error}
          onStart={handlers.onStartJam}
          onJoin={handlers.onJoinJam}
          onClose={onClose}
        />
      )}
    </div>
  )
}

export class PopoverController {
  private layer: HTMLDivElement | null = null
  private root: Root | null = null
  private openState = false
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private anchor: HTMLElement | null = null

  constructor(private handlers: PopoverHandlers) {}

  isOpen(): boolean {
    return this.openState
  }

  open(anchor: HTMLElement | null): void {
    if (typeof document === 'undefined' || !document.body) return
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    this.anchor = anchor
    if (!this.layer) {
      this.layer = document.createElement('div')
      this.layer.className = 'lj-root lj-popover-layer'
      document.body.appendChild(this.layer)
      this.root = createRoot(this.layer)
      document.addEventListener('mousedown', this.onDocDown, true)
      document.addEventListener('keydown', this.onKeyDown, true)
    }
    this.positionLayer()
    this.openState = true
    this.root?.render(<PopoverView handlers={this.handlers} leaving={false} onClose={() => this.close()} />)
  }

  close(): void {
    if (!this.openState || !this.layer || !this.root) return
    this.openState = false
    this.root.render(<PopoverView handlers={this.handlers} leaving={true} onClose={() => this.close()} />)
    if (this.closeTimer !== null) clearTimeout(this.closeTimer)
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      this.unmount()
    }, 160)
  }

  toggle(anchor: HTMLElement | null): void {
    if (this.openState) this.close()
    else this.open(anchor)
  }

  unmount(): void {
    this.openState = false
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    document.removeEventListener('mousedown', this.onDocDown, true)
    document.removeEventListener('keydown', this.onKeyDown, true)
    this.root?.unmount()
    this.root = null
    this.layer?.remove()
    this.layer = null
  }

  private positionLayer(): void {
    if (!this.layer) return
    const rect = this.anchor?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      const bottom = Math.max(12, Math.round(window.innerHeight - rect.top + 10))
      const right = Math.max(12, Math.round(window.innerWidth - rect.right))
      this.layer.style.bottom = `${bottom}px`
      this.layer.style.right = `${right}px`
    } else {
      this.layer.style.bottom = '92px'
      this.layer.style.right = '20px'
    }
  }

  private onDocDown = (ev: MouseEvent): void => {
    const target = ev.target as Node | null
    if (!target || !this.layer) return
    if (this.layer.contains(target)) return
    if (this.anchor && this.anchor.contains(target)) return
    if ((target as Element).closest?.('.lj-ctx-layer')) return
    this.close()
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') this.close()
  }
}
