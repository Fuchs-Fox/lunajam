import { ReactiveStore } from '@luna/core'
import { defaultSettings, normalizeServerUrl, validateDiscordClientId, type LunaJamSettings } from '../session/settings'

const PEER_RE = /^[A-Za-z0-9_-]{8,64}$/

function cleanSettings(raw: Record<string, unknown>, base: LunaJamSettings): LunaJamSettings {
  const rawPeer = typeof raw.peerId === 'string' ? raw.peerId.trim() : ''
  return {
    serverUrl: typeof raw.serverUrl === 'string' ? normalizeServerUrl(raw.serverUrl) : base.serverUrl,
    defaultAllowGuestControl:
      typeof raw.defaultAllowGuestControl === 'boolean' ? raw.defaultAllowGuestControl : base.defaultAllowGuestControl,
    defaultAllowGuestAdd:
      typeof raw.defaultAllowGuestAdd === 'boolean' ? raw.defaultAllowGuestAdd : base.defaultAllowGuestAdd,
    defaultGuestAudioMode:
      raw.defaultGuestAudioMode === 'remote' || raw.defaultGuestAudioMode === 'speaker'
        ? raw.defaultGuestAudioMode
        : base.defaultGuestAudioMode,
    discordRpcEnabled: typeof raw.discordRpcEnabled === 'boolean' ? raw.discordRpcEnabled : base.discordRpcEnabled,
    discordListenTogether:
      typeof raw.discordListenTogether === 'boolean' ? raw.discordListenTogether : base.discordListenTogether,
    discordShowPaused: typeof raw.discordShowPaused === 'boolean' ? raw.discordShowPaused : base.discordShowPaused,
    discordClientId:
      typeof raw.discordClientId === 'string' ? validateDiscordClientId(raw.discordClientId) : base.discordClientId,
    peerId: PEER_RE.test(rawPeer) ? rawPeer : base.peerId,
  }
}

let current: LunaJamSettings = { ...defaultSettings }
let overlay: Partial<LunaJamSettings> = {}
let persist: ((patch: Partial<LunaJamSettings>) => void) | null = null
const listeners = new Set<(s: LunaJamSettings) => void>()

ReactiveStore.getPluginStorage<LunaJamSettings>('lunajam', defaultSettings)
  .then((store) => {
    persist = (patch) => Object.assign(store, patch)
    const rawStore = store as unknown as Record<string, unknown>
    const merged = cleanSettings(
      overlay as Record<string, unknown>,
      cleanSettings(rawStore, defaultSettings),
    )
    if (typeof rawStore.peerId !== 'string' || !PEER_RE.test(rawStore.peerId)) {
      persist({ peerId: merged.peerId })
    }
    if (Object.keys(overlay).length > 0) persist(overlay)
    current = merged
    for (const cb of listeners) cb(current)
  })
  .catch(() => {})

export const storage = {
  get(): LunaJamSettings {
    return current
  },
  set(patch: Partial<LunaJamSettings>): void {
    const next = cleanSettings({ ...current, ...patch } as Record<string, unknown>, current)
    current = next
    overlay = { ...overlay, ...patch }
    persist?.(patch)
    for (const cb of listeners) cb(current)
  },
  onChange(cb: (s: LunaJamSettings) => void): void {
    listeners.add(cb)
  },
  off(cb: (s: LunaJamSettings) => void): void {
    listeners.delete(cb)
  },
}
