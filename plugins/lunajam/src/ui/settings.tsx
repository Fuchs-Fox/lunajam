import { LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting } from '@luna/ui'
import { useEffect, useState, type FC } from 'react'
import type { AudioMode } from '../protocol'
import { defaultSettings, normalizeServerUrl, validateDiscordClientId, type LunaJamSettings } from '../session/settings'
import { storage } from '../tidal/storage'

export const LunaJamSettingsView: FC = () => {
  const [cfg, setCfg] = useState<LunaJamSettings>(() => storage.get())
  const [serverDraft, setServerDraft] = useState<string>(() => storage.get().serverUrl)
  const [clientDraft, setClientDraft] = useState<string>(() => storage.get().discordClientId)

  useEffect(() => {
    const onChange = (next: LunaJamSettings) => {
      setCfg(next)
      setServerDraft(next.serverUrl)
      setClientDraft(next.discordClientId)
    }
    storage.onChange(onChange)
    return () => storage.off(onChange)
  }, [])

  return (
    <LunaSettings>
      <LunaSwitchSetting
        title="Discord Rich Presence"
        desc="Show TIDAL playback and Jam session status on Discord, Vesktop, and Equibop"
        checked={cfg.discordRpcEnabled}
        onChange={(_: unknown, checked: boolean) => storage.set({ discordRpcEnabled: checked })}
      />
      <LunaSwitchSetting
        title="Listen Together button in Discord"
        desc="Attach a live join link to Discord activity even before starting a Jam"
        checked={cfg.discordListenTogether}
        disabled={!cfg.discordRpcEnabled}
        onChange={(_: unknown, checked: boolean) => storage.set({ discordListenTogether: checked })}
      />
      <LunaSwitchSetting
        title="Show paused tracks in Discord"
        desc="Keep Rich Presence visible while playback is paused"
        checked={cfg.discordShowPaused}
        disabled={!cfg.discordRpcEnabled}
        onChange={(_: unknown, checked: boolean) => storage.set({ discordShowPaused: checked })}
      />
      <LunaSwitchSetting
        title="Allow guests to add tracks by default"
        desc="Guests can add music to the Jam queue when you host"
        checked={cfg.defaultAllowGuestAdd}
        onChange={(_: unknown, checked: boolean) => storage.set({ defaultAllowGuestAdd: checked })}
      />
      <LunaSwitchSetting
        title="Allow guests to control playback by default"
        desc="Guests can skip, pause, seek, and reorder tracks when you host a Jam"
        checked={cfg.defaultAllowGuestControl}
        onChange={(_: unknown, checked: boolean) => storage.set({ defaultAllowGuestControl: checked })}
      />
      <LunaSelectSetting<AudioMode>
        title="Default join audio mode"
        desc="Choose whether joining a Jam plays audio locally or only on the host speaker"
        value={cfg.defaultGuestAudioMode}
        onChange={(ev: { target: { value: unknown } }) => storage.set({ defaultGuestAudioMode: ev.target.value as AudioMode })}
      >
        <LunaSelectItem value="remote">This device</LunaSelectItem>
        <LunaSelectItem value="speaker">Host speaker</LunaSelectItem>
      </LunaSelectSetting>
      <LunaTextSetting
        title="Relay server URL"
        desc={`Default: ${defaultSettings.serverUrl}`}
        value={serverDraft}
        onChange={(ev: { target: { value: string } }) => setServerDraft(ev.target.value)}
        onBlur={() => {
          const clean = normalizeServerUrl(serverDraft)
          setServerDraft(clean)
          storage.set({ serverUrl: clean })
        }}
      />
      <LunaTextSetting
        title="Discord Application ID"
        desc={`Default: ${defaultSettings.discordClientId}`}
        value={clientDraft}
        onChange={(ev: { target: { value: string } }) => setClientDraft(ev.target.value)}
        onBlur={() => {
          const clean = validateDiscordClientId(clientDraft)
          setClientDraft(clean)
          storage.set({ discordClientId: clean })
        }}
      />
    </LunaSettings>
  )
}
