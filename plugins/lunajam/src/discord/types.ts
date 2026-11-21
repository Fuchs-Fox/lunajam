export interface RpcButton {
  label: string
  url: string
}

export interface WireActivity {
  name?: string
  type?: number
  status_display_type?: number
  details?: string
  details_url?: string
  state?: string
  state_url?: string
  timestamps?: {
    start?: number
    end?: number
  }
  assets?: {
    large_image?: string
    large_text?: string
    large_url?: string
    small_image?: string
    small_text?: string
  }
  party?: {
    id: string
    size: [number, number]
  }
  buttons?: RpcButton[]
  instance?: boolean
}

export interface RpcStatus {
  connected: boolean
  transport: string | null
}

export interface RpcTestOpts {
  socketCandidates?: string[]
  wsPorts?: number[]
}
