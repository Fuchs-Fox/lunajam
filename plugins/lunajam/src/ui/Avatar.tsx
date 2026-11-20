import type { FC, MouseEvent } from 'react'
import type { Profile } from '../protocol'

const PALETTE = ['#2b6cb0', '#0d9488', '#b45309', '#475569', '#0f766e', '#9a3412']

export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}

export function initialsFor(name: string): string {
  const clean = name.trim()
  return clean ? clean.charAt(0).toUpperCase() : '?'
}

export const Avatar: FC<{
  profile: Profile
  size?: number
  mutedAdd?: boolean
  onClick?: (ev: MouseEvent<HTMLElement>) => void
}> = ({ profile, size = 24, mutedAdd = false, onClick }) => {
  const fontSize = Math.max(9, Math.round(size * 0.44))
  const circle = (
    <span
      className={`lj-avatar${mutedAdd ? ' is-muted-add' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize,
        backgroundColor: avatarColor(profile.name),
      }}
      title={onClick ? undefined : profile.name}
    >
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : initialsFor(profile.name)}
    </span>
  )

  if (!onClick) return circle

  return (
    <button
      type="button"
      className="lj-avatar-btn"
      aria-label={`${profile.name} options`}
      title={`${profile.name} options`}
      onClick={(ev) => {
        ev.stopPropagation()
        onClick(ev)
      }}
    >
      {circle}
    </button>
  )
}

export const AvatarStack: FC<{ profiles: Profile[]; onClick?: () => void; expanded?: boolean }> = ({
  profiles,
  onClick,
  expanded = false,
}) => {
  const visible = profiles.slice(0, 3)
  const extra = Math.max(0, profiles.length - visible.length)
  return (
    <button
      type="button"
      className="lj-avatar-stack"
      aria-expanded={expanded}
      aria-label={`${profiles.length} listening`}
      onClick={onClick}
    >
      {visible.map((p) => (
        <Avatar key={p.cid || p.name} profile={p} size={22} />
      ))}
      {extra > 0 && <span className="lj-avatar-extra">+{extra}</span>}
    </button>
  )
}
