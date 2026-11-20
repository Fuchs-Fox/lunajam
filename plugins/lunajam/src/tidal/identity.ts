import { redux } from '@luna/lib'
import type { Profile } from '../protocol'

type UserMeta = {
  id?: unknown
  profileName?: unknown
  firstName?: unknown
  username?: unknown
  picture?: unknown
}

function cleanText(x: unknown): string | null {
  return typeof x === 'string' && x.trim() !== '' ? x.trim() : null
}

function stripEmail(s: string | null): string | null {
  if (!s) return null
  const local = s.includes('@') ? s.split('@')[0]?.trim() : s
  return local ? local : null
}

function cleanUserId(x: unknown): string | undefined {
  if (typeof x === 'number' && Number.isInteger(x) && x > 0) return String(x)
  if (typeof x === 'string' && /^\d{1,20}$/.test(x.trim())) return x.trim()
  return undefined
}

export function localProfile(cid = ''): Profile {
  try {
    const meta = (redux.store.getState() as { user?: { meta?: UserMeta } }).user?.meta
    if (!meta) return { cid, name: 'Listener', avatarUrl: null }
    const pic = cleanText(meta.picture)
    const tidalUserId = cleanUserId(meta.id)
    return {
      cid,
      name: cleanText(meta.profileName) ?? cleanText(meta.firstName) ?? stripEmail(cleanText(meta.username)) ?? 'Listener',
      avatarUrl: pic ? `https://resources.tidal.com/images/${pic.replace(/-/g, '/')}/210x210.jpg` : null,
      ...(tidalUserId ? { tidalUserId } : {}),
    }
  } catch {
    return { cid, name: 'Listener', avatarUrl: null }
  }
}

export function openTidalProfile(tidalUserId?: string): boolean {
  if (!tidalUserId || !/^\d{1,20}$/.test(tidalUserId)) return false
  try {
    redux.actions['userProfiles/FETCH_USER_PROFILE']?.({ userId: Number(tidalUserId) })
  } catch {
    void 0
  }
  try {
    redux.actions['router/PUSH']?.({
      pathname: `/user/${tidalUserId}`,
      search: '',
      replace: false,
    })
    return true
  } catch {
    return false
  }
}
