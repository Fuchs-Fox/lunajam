export interface RpcButton {
  label: string
  url: string
}

export interface WireActivity {
  type?: number
  status_display_type?: number
  details?: string
  state?: string
  timestamps?: {
    start?: number
    end?: number
  }
  assets?: {
    large_image?: string
    large_text?: string
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
