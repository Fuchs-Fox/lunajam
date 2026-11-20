interface ClockSample {
  rtt: number
  offset: number
}

export class ClockSync {
  private samples: ClockSample[] = []
  private readonly maxSamples: number

  constructor(maxSamples = 8) {
    this.maxSamples = maxSamples
  }

  addSample(clientSentMs: number, serverTsMs: number, clientRecvMs = performance.now()): void {
    const rtt = Math.max(0, clientRecvMs - clientSentMs)
    const offset = serverTsMs - (clientSentMs + rtt / 2)
    this.samples.push({ rtt, offset })
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }

  offset(): number {
    if (this.samples.length === 0) return 0
    const sortedByRtt = [...this.samples].sort((a, b) => a.rtt - b.rtt)
    const halfCount = Math.max(1, Math.ceil(sortedByRtt.length / 2))
    const bestOffsets = sortedByRtt.slice(0, halfCount).map((s) => s.offset).sort((a, b) => a - b)
    const mid = Math.floor(bestOffsets.length / 2)
    if (bestOffsets.length % 2 === 1) return bestOffsets[mid] ?? 0
    return ((bestOffsets[mid - 1] ?? 0) + (bestOffsets[mid] ?? 0)) / 2
  }

  serverNow(localNow = performance.now()): number {
    return localNow + this.offset()
  }

  sampleCount(): number {
    return this.samples.length
  }

  reset(): void {
    this.samples = []
  }
}
