import { TidalApi, redux } from '@luna/lib'
import type { Profile } from '../protocol'

type UserMeta = {
  id?: unknown
  artistId?: unknown
  profileName?: unknown
  firstName?: unknown
  username?: unknown
  picture?: unknown
  countryCode?: unknown
}

type OpenApiArtworkFile = {
  href?: unknown
  meta?: {
    width?: unknown
    height?: unknown
  }
}

type OpenApiArtistResponse = {
  data?: {
    id?: unknown
    attributes?: {
      name?: unknown
      handle?: unknown
    }
  }
  included?: Array<{
    type?: unknown
    attributes?: {
      files?: OpenApiArtworkFile[]
    }
  }>
}

const PROFILE_PATH_RE = /^\/(?:@[A-Za-z0-9._-]{1,64}|artist\/\d{1,20})$/
const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/

const hydrated: {
  userId?: string
  artistId?: string
  fetchedArtistId?: string
  fetchAttempts: number
  avatarUrl?: string | null
  profilePath?: string
  name?: string
} = { fetchAttempts: 0 }

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

function validHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (t.length === 0 || t.length > 512) return null
  return /^https?:\/\//i.test(t) ? t : null
}

function metaPictureUrl(pic: string | null): string | null {
  if (!pic) return null
  const direct = validHttpUrl(pic)
  if (direct) return direct
  return `https://resources.tidal.com/images/${pic.replace(/-/g, '/')}/210x210.jpg`
}

function readDomProfileAvatar(): string | null {
  try {
    if (typeof document === 'undefined') return null
    const els = document.querySelectorAll('[class*="_profilePicture_"], [data-test="profile-image"]')
    for (const el of els) {
      const img = el.tagName === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img')
      const imgUrl = validHttpUrl(img?.currentSrc || img?.getAttribute('src'))
      if (imgUrl) return imgUrl
      const htmlEl = el as HTMLElement
      const bg = htmlEl.style?.backgroundImage || (typeof window !== 'undefined' ? window.getComputedStyle(el).backgroundImage : '')
      const match = /url\(["']?(https?:\/\/[^"')]+)["']?\)/i.exec(bg)
      const bgUrl = validHttpUrl(match?.[1])
      if (bgUrl) return bgUrl
    }
    return null
  } catch {
    return null
  }
}

function pickProfileArtUrl(resp: OpenApiArtistResponse): string | null {
  const files: Array<{ href: string; width: number }> = []
  for (const inc of resp.included ?? []) {
    if (inc?.type !== 'artworks') continue
    for (const f of inc.attributes?.files ?? []) {
      const href = validHttpUrl(cleanText(f?.href))
      if (!href) continue
      const width = typeof f?.meta?.width === 'number' && Number.isFinite(f.meta.width) ? f.meta.width : 0
      files.push({ href, width })
    }
  }
  if (files.length === 0) return null
  const ideal = files.filter((f) => f.width >= 160 && f.width <= 640).sort((a, b) => a.width - b.width)
  if (ideal[0]) return ideal[0].href
  const larger = files.filter((f) => f.width >= 160).sort((a, b) => a.width - b.width)
  if (larger[0]) return larger[0].href
  return files[0]!.href
}

function syncHydratedUser(userId: string | undefined): void {
  if (hydrated.userId !== userId) {
    hydrated.userId = userId
    hydrated.artistId = undefined
    hydrated.fetchedArtistId = undefined
    hydrated.fetchAttempts = 0
    hydrated.avatarUrl = undefined
    hydrated.profilePath = undefined
    hydrated.name = undefined
  }
}

export function localProfile(cid = ''): Profile {
  try {
    const state = redux.store.getState() as { user?: { meta?: UserMeta } }
    const meta = state.user?.meta
    if (!meta) return { cid, name: 'Listener', avatarUrl: null }
    const tidalUserId = cleanUserId(meta.id)
    syncHydratedUser(tidalUserId)
    const artistId = cleanUserId(meta.artistId)
    if (artistId) hydrated.artistId = artistId
    const avatarUrl = readDomProfileAvatar() ?? hydrated.avatarUrl ?? metaPictureUrl(cleanText(meta.picture))
    const name = cleanText(meta.profileName) ?? hydrated.name ?? cleanText(meta.firstName) ?? stripEmail(cleanText(meta.username)) ?? 'Listener'
    const profilePath = hydrated.profilePath
    return {
      cid,
      name,
      avatarUrl,
      ...(tidalUserId ? { tidalUserId } : {}),
      ...(profilePath ? { profilePath } : {}),
    }
  } catch {
    return { cid, name: 'Listener', avatarUrl: null }
  }
}

export async function hydrateLocalIdentity(): Promise<Profile> {
  try {
    const state = redux.store.getState() as { user?: { meta?: UserMeta }; session?: { countryCode?: unknown } }
    const meta = state.user?.meta
    const userId = cleanUserId(meta?.id)
    syncHydratedUser(userId)
    const domAvatar = readDomProfileAvatar()
    const artistId = cleanUserId(meta?.artistId)
    if (artistId) hydrated.artistId = artistId

    if (artistId && hydrated.fetchedArtistId !== artistId && hydrated.fetchAttempts < 2) {
      hydrated.fetchAttempts += 1
      const countryCode = cleanText(state.session?.countryCode) ?? cleanText(meta?.countryCode) ?? 'US'
      const url = `https://openapi.tidal.com/v2/artists/${artistId}?countryCode=${encodeURIComponent(countryCode)}&include=profileArt`
      const fetcher = (TidalApi as { fetch?: <T>(u: string) => Promise<T | undefined> } | undefined)?.fetch
      const resp = fetcher ? await fetcher.call(TidalApi, url).catch(() => undefined) : undefined
      if (resp && typeof resp === 'object' && (resp as OpenApiArtistResponse).data) {
        hydrated.fetchedArtistId = artistId
        const artistResp = resp as OpenApiArtistResponse
        const handle = cleanText(artistResp.data?.attributes?.handle)?.replace(/^@+/, '')
        hydrated.profilePath = handle && HANDLE_RE.test(handle) ? `/@${handle}` : `/artist/${artistId}`
        const apiName = cleanText(artistResp.data?.attributes?.name)
        if (!cleanText(meta?.profileName) && apiName) {
          hydrated.name = apiName
        }
        const artUrl = pickProfileArtUrl(artistResp)
        if (artUrl) hydrated.avatarUrl = artUrl
      } else {
        hydrated.profilePath = undefined
      }
    }

    if (domAvatar && !hydrated.avatarUrl) {
      hydrated.avatarUrl = domAvatar
    }
  } catch {
    void 0
  }
  return localProfile()
}

export function openTidalProfile(profilePath?: string): boolean {
  if (!profilePath || !PROFILE_PATH_RE.test(profilePath)) return false
  if (profilePath.startsWith('/artist/')) {
    const artistId = Number(profilePath.slice('/artist/'.length))
    if (Number.isInteger(artistId) && artistId > 0) {
      try {
        redux.actions['content/LOAD_ARTIST']?.({ artistId })
      } catch {
        void 0
      }
    }
  }
  try {
    redux.actions['router/PUSH']?.({
      pathname: profilePath,
      search: '',
      replace: false,
    })
    return true
  } catch {
    return false
  }
}