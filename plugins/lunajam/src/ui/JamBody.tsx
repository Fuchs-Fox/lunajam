import QRCode from 'qrcode'
import { useEffect, useState, type FC } from 'react'
import { formatCode, type AudioMode, type Profile, type RoomSnapshot } from '../protocol'
import { normalizeServerUrl } from '../session/settings'
import { Avatar, AvatarStack } from './Avatar'
import { IconBan, IconCheck, IconCopy, IconHeadphones, IconQr, IconSpeaker } from './icons'

export interface JamBodyProps {
  room: RoomSnapshot | null
  cid: string | null
  status: string
  role: 'host' | 'guest' | null
  audioMode: AudioMode
  serverUrl: string
  error: string | null
  showQueuePreview?: boolean
  onLeave: () => void
  onEnd: () => void
  onTogglePermissions: (patch: { allowGuestControl?: boolean; allowGuestAdd?: boolean }) => void
  onChangeAudioMode: (mode: AudioMode) => void
  onKick: (cid: string) => void
  onKickAll: () => void
  onSelectTrack?: (uid: string) => void
  onInspectParticipant?: (profile: Profile, anchor: HTMLElement) => void
  onClose?: () => void
}

export const JamBody: FC<JamBodyProps> = ({
  room,
  cid,
  status,
  role,
  audioMode,
  serverUrl,
  error,
  showQueuePreview = false,
  onLeave,
  onEnd,
  onTogglePermissions,
  onChangeAudioMode,
  onKick,
  onKickAll,
  onSelectTrack,
  onInspectParticipant,
}) => {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrSvg, setQrSvg] = useState('')

  const origin = normalizeServerUrl(serverUrl)
  const joinUrl = room ? `${origin}/join/${room.code}` : ''

  useEffect(() => {
    if (!inviteOpen || !joinUrl) {
      setQrSvg('')
      return
    }
    let active = true
    QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 120, color: { dark: '#0a0a0c', light: '#ffffff' } })
      .then((svg) => {
        if (active) setQrSvg(svg)
      })
      .catch(() => {
        if (active) setQrSvg('')
      })
    return () => {
      active = false
    }
  }, [inviteOpen, joinUrl])

  if (!room) {
    return (
      <div className="lj-top-row">
        <div className="lj-title-group">
          <span className={`lj-dot${status === 'reconnecting' ? ' is-warn' : ''}`} aria-hidden="true" />
          <h3 className="lj-heading">{status === 'reconnecting' ? 'Reconnecting to Jam...' : 'Connecting to Jam...'}</h3>
        </div>
        <button type="button" className="lj-btn lj-btn-sm" onClick={onLeave}>
          Cancel
        </button>
      </div>
    )
  }

  const isHost = role === 'host'
  const hostProfile = room.participants.find((p) => p.role === 'host') ?? room.participants[0]
  const guests = room.participants.filter((p) => p.role === 'guest')
  const me = cid ? room.participants.find((p) => p.cid === cid) : undefined

  const copyInvite = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(joinUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }).catch(() => {})
    }
  }

  return (
    <div>
      <div className="lj-top-row">
        <div className="lj-title-group">
          <span className={`lj-dot${status === 'reconnecting' ? ' is-warn' : ''}`} aria-hidden="true" />
          <h3 className="lj-heading">Jam · {room.participants.length}</h3>
          <AvatarStack
            profiles={room.participants}
            expanded={rosterOpen}
            onClick={() => setRosterOpen((v) => !v)}
          />
        </div>

        <div className="lj-btn-group">
          <button
            type="button"
            className="lj-btn lj-btn-sm"
            aria-expanded={inviteOpen}
            onClick={() => setInviteOpen((v) => !v)}
          >
            <IconQr />
            <span>Invite</span>
          </button>
          {isHost ? (
            <button type="button" className="lj-btn lj-btn-sm lj-btn-danger" onClick={onEnd}>
              End
            </button>
          ) : (
            <button type="button" className="lj-btn lj-btn-sm" onClick={onLeave}>
              Leave
            </button>
          )}
        </div>
      </div>

      {inviteOpen && (
        <div className="lj-invite-panel">
          <div className="lj-qr-frame" dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined} />
          <div className="lj-invite-meta">
            <p className="lj-room-code">{formatCode(room.code)}</p>
            <p className="lj-room-url" title={joinUrl}>
              {joinUrl}
            </p>
            <button type="button" className="lj-btn lj-btn-sm" onClick={copyInvite}>
              {copied ? <IconCheck /> : <IconCopy />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>
      )}

      {rosterOpen && (
        <div className="lj-roster">
          <div className="lj-roster-head">
            <span>Listeners ({room.participants.length})</span>
            {isHost && guests.length > 0 && (
              <button type="button" className="lj-btn lj-btn-sm lj-btn-danger" onClick={onKickAll}>
                Ban all
              </button>
            )}
          </div>
          {room.participants.map((p, idx) => (
            <div key={p.cid || `${p.name}-${idx}`} className="lj-roster-row" style={{ ['--lj-i' as string]: idx }}>
              <Avatar
                profile={p}
                size={26}
                mutedAdd={p.role === 'guest' && !p.canAddTracks}
                onClick={onInspectParticipant ? (ev) => onInspectParticipant(p, ev.currentTarget) : undefined}
              />
              <div className="lj-roster-info">
                <div className="lj-roster-name">
                  {p.name}
                  {p.cid === cid ? ' (you)' : ''}
                </div>
                <div className={`lj-roster-role${p.role === 'host' ? ' is-host' : ''}`}>
                  {p.role === 'host'
                    ? 'Host'
                    : `${p.audioMode === 'speaker' ? 'Host speaker' : 'This device'}${!p.canAddTracks ? ' · Add off' : ''}`}
                </div>
              </div>
              {isHost && p.role === 'guest' && (
                <button
                  type="button"
                  className="lj-btn lj-btn-icon"
                  aria-label={`Ban ${p.name}`}
                  title="Ban until Jam is recreated"
                  onClick={() => onKick(p.cid)}
                >
                  <IconBan />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isHost ? (
        <div className="lj-switch-group">
          <div className="lj-switch-row">
            <span className="lj-switch-label">Let others add tracks</span>
            <button
              type="button"
              role="switch"
              aria-checked={room.allowGuestAdd}
              className={`lj-switch${room.allowGuestAdd ? ' is-on' : ''}`}
              onClick={() => onTogglePermissions({ allowGuestAdd: !room.allowGuestAdd })}
            >
              <span className="lj-switch-knob" />
            </button>
          </div>
          <div className="lj-switch-row">
            <span className="lj-switch-label">Let others change what's playing</span>
            <button
              type="button"
              role="switch"
              aria-checked={room.allowGuestControl}
              className={`lj-switch${room.allowGuestControl ? ' is-on' : ''}`}
              onClick={() => onTogglePermissions({ allowGuestControl: !room.allowGuestControl })}
            >
              <span className="lj-switch-knob" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="lj-segment" role="group" aria-label="Audio output">
            <button
              type="button"
              className={`lj-segment-btn${audioMode === 'remote' ? ' is-active' : ''}`}
              onClick={() => onChangeAudioMode('remote')}
            >
              <IconHeadphones />
              <span>This device</span>
            </button>
            <button
              type="button"
              className={`lj-segment-btn${audioMode === 'speaker' ? ' is-active' : ''}`}
              onClick={() => onChangeAudioMode('speaker')}
            >
              <IconSpeaker />
              <span>Host speaker</span>
            </button>
          </div>
          {audioMode === 'speaker' && (
            <div className="lj-speaker-banner">
              Playing on {hostProfile?.name ?? 'Host'}'s speaker
            </div>
          )}
          {me && !me.canAddTracks && (
            <div className="lj-muted-banner">Host turned off track additions for you</div>
          )}
        </div>
      )}

      {showQueuePreview && room.queue.length > 0 && (
        <div className="lj-mini-queue">
          {room.queue.slice(Math.max(0, room.currentIndex), Math.max(0, room.currentIndex) + 12).map((item) => {
            const isCurrent = room.currentIndex >= 0 && room.queue[room.currentIndex]?.uid === item.uid
            const canSelect = isHost || room.allowGuestControl
            const adderMember = room.participants.find((p) => p.cid === item.addedBy.cid)
            return (
              <div
                key={item.uid}
                className={`lj-mini-row${isCurrent ? ' is-current' : ''}`}
                onClick={() => {
                  if (canSelect && onSelectTrack) onSelectTrack(item.uid)
                }}
              >
                <div className="lj-mini-meta">
                  <div className="lj-mini-title">{item.title || `Track ${item.trackId}`}</div>
                  <div className="lj-mini-artist">{item.artist || 'TIDAL'}</div>
                </div>
                <Avatar
                  profile={item.addedBy}
                  size={20}
                  mutedAdd={Boolean(adderMember && adderMember.role === 'guest' && !adderMember.canAddTracks)}
                  onClick={onInspectParticipant ? (ev) => onInspectParticipant(item.addedBy, ev.currentTarget) : undefined}
                />
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="lj-error">{error}</p>}
    </div>
  )
}
