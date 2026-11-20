import { describe, expect, it } from 'vitest'
import { ClockSync } from '../plugins/lunajam/src/sync/clock'
import { DriftController } from '../plugins/lunajam/src/sync/drift'

describe('ClockSync', () => {
  it('picks median offset among lowest-RTT half of samples', () => {
    const clock = new ClockSync(6)
    clock.addSample(100, 1110, 120)
    clock.addSample(200, 1210, 220)
    clock.addSample(300, 1500, 700)
    clock.addSample(400, 1600, 900)
    expect(clock.offset()).toBe(1000)
    expect(clock.serverNow(500)).toBe(1500)
  })
})

describe('DriftController', () => {
  it('enforces 3-zone hysteresis and seek cooldown', () => {
    const drift = new DriftController()

    expect(drift.evaluate({ expectedMs: 10200, actualMs: 10000, playing: true, nowMs: 1000 })).toEqual({
      action: 'none',
    })

    expect(drift.evaluate({ expectedMs: 10450, actualMs: 10000, playing: true, nowMs: 1200 })).toEqual({
      action: 'rate',
      rate: 1.025,
    })

    expect(drift.evaluate({ expectedMs: 10500, actualMs: 10000, playing: true, nowMs: 1400 })).toEqual({
      action: 'none',
    })

    expect(drift.evaluate({ expectedMs: 10080, actualMs: 10000, playing: true, nowMs: 1600 })).toEqual({
      action: 'rate',
      rate: 1,
    })

    expect(drift.evaluate({ expectedMs: 12500, actualMs: 10000, playing: true, nowMs: 2000 })).toEqual({
      action: 'seek',
      targetSec: 12.5,
    })

    expect(drift.evaluate({ expectedMs: 13000, actualMs: 10000, playing: true, nowMs: 3000 })).toEqual({
      action: 'none',
    })

    expect(drift.evaluate({ expectedMs: 13000, actualMs: 10000, playing: true, nowMs: 4600 })).toEqual({
      action: 'seek',
      targetSec: 13,
    })

    expect(
      drift.evaluate({ expectedMs: 5500, actualMs: 5000, playing: true, nowMs: 4700, forceSeek: true }),
    ).toEqual({
      action: 'seek',
      targetSec: 5.5,
    })
  })
})
