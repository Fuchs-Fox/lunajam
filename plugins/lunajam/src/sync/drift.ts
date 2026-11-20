export type DriftDecision =
  | { action: 'none' }
  | { action: 'rate'; rate: number }
  | { action: 'seek'; targetSec: number }

export interface DriftInput {
  expectedMs: number
  actualMs: number
  playing: boolean
  nowMs: number
  forceSeek?: boolean
}

export class DriftController {
  private lastSeekAt = -Infinity
  private currentRate = 1

  evaluate(input: DriftInput): DriftDecision {
    const delta = input.expectedMs - input.actualMs
    const absDelta = Math.abs(delta)

    if (!input.playing) {
      if (this.currentRate !== 1) {
        this.currentRate = 1
        return { action: 'rate', rate: 1 }
      }
      if (absDelta > 400 && (input.forceSeek || input.nowMs - this.lastSeekAt >= 2500)) {
        this.lastSeekAt = input.nowMs
        return { action: 'seek', targetSec: Math.max(0, input.expectedMs / 1000) }
      }
      return { action: 'none' }
    }

    if (absDelta > 1200 || (input.forceSeek && absDelta > 400)) {
      if (input.forceSeek || input.nowMs - this.lastSeekAt >= 2500) {
        this.currentRate = 1
        this.lastSeekAt = input.nowMs
        return { action: 'seek', targetSec: Math.max(0, input.expectedMs / 1000) }
      }
      return { action: 'none' }
    }

    if (absDelta >= 300) {
      const targetRate = delta > 0 ? 1.025 : 0.975
      if (this.currentRate !== targetRate) {
        this.currentRate = targetRate
        return { action: 'rate', rate: targetRate }
      }
      return { action: 'none' }
    }

    if (this.currentRate !== 1 && absDelta < 120) {
      this.currentRate = 1
      return { action: 'rate', rate: 1 }
    }

    return { action: 'none' }
  }

  reset(): void {
    this.lastSeekAt = -Infinity
    this.currentRate = 1
  }
}
