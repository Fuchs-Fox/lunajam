import { DEFAULT_SERVER_URL, sanitizeBaseUrl, type AudioMode } from '../protocol'

export interface LunaJamSettings {
  serverUrl: string
  defaultAllowGuestControl: boolean
  defaultAllowGuestAdd: boolean
  defaultGuestAudioMode: AudioMode
  discordRpcEnabled: boolean
  discordListenTogether: boolean
  discordShowPaused: boolean
  discordClientId: string
  peerId: string
}

export const DEFAULT_DISCORD_CLIENT_ID = '1130698654987067493'

export function generatePeerId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = new Uint8Array(24)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i]! % chars.length]
  return out
}

export const defaultSettings: LunaJamSettings = {
  serverUrl: DEFAULT_SERVER_URL,
  defaultAllowGuestControl: true,
  defaultAllowGuestAdd: true,
  defaultGuestAudioMode: 'remote',
  discordRpcEnabled: true,
  discordListenTogether: true,
  discordShowPaused: true,
  discordClientId: DEFAULT_DISCORD_CLIENT_ID,
  peerId: generatePeerId(),
}

export function normalizeServerUrl(raw: string): string {
  return sanitizeBaseUrl(raw) ?? DEFAULT_SERVER_URL
}

export function wsUrlFromServer(serverUrl: string): string {
  const clean = normalizeServerUrl(serverUrl)
  return clean.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
}

export function validateDiscordClientId(raw: string): string {
  const trimmed = raw.trim()
  return /^\d{17,22}$/.test(trimmed) ? trimmed : DEFAULT_DISCORD_CLIENT_ID
}
