import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { decodeServer, encode, type ClientMsg, type ServerMsg } from '../plugins/lunajam/src/protocol'
import { SessionClient } from '../plugins/lunajam/src/session/client'
import { Hub, normalizeIpKey } from '../server/src/hub'
import { startServer } from '../server/src/main'

interface TestClient {
  ws: WebSocket
  queue: ServerMsg[]
  send(msg: ClientMsg): void
  next(predicate?: (m: ServerMsg) => boolean, timeoutMs?: number): Promise<ServerMsg>
  close(): Promise<void>
}

async function connectClient(port: number, headers?: Record<string, string>): Promise<TestClient> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`, headers ? { headers } : undefined)
  const queue: ServerMsg[] = []
  const waiters: Array<{ pred: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void; reject: (e: Error) => void }> = []

  ws.on('message', (data) => {
    const raw = typeof data === 'string' ? data : data.toString('utf8')
    const msg = decodeServer(raw)
    if (!msg) return
    const idx = waiters.findIndex((w) => w.pred(msg))
    if (idx >= 0) {
      const [w] = waiters.splice(idx, 1)
      w!.resolve(msg)
    } else {
      queue.push(msg)
    }
  })

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })

  return {
    ws,
    queue,
    send(msg) {
      ws.send(encode(msg))
    },
    next(predicate = () => true, timeoutMs = 3000) {
      const hit = queue.findIndex(predicate)
      if (hit >= 0) {
        return Promise.resolve(queue.splice(hit, 1)[0]!)
      }
      return new Promise<ServerMsg>((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = waiters.indexOf(entry)
          if (i >= 0) waiters.splice(i, 1)
          reject(new Error('Timed out waiting for server message'))
        }, timeoutMs)
        const entry = {
          pred: predicate,
          resolve: (m: ServerMsg) => {
            clearTimeout(timer)
            resolve(m)
          },
          reject: (e: Error) => {
            clearTimeout(timer)
            reject(e)
          },
        }
        waiters.push(entry)
      })
    },
    async close() {
      if (ws.readyState === WebSocket.CLOSED) return
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve())
        ws.close()
      })
    },
  }
}

describe('relay server v2', () => {
  const closers: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (closers.length > 0) {
      const fn = closers.pop()!
      await fn().catch(() => {})
    }
  })

  async function boot(hostGraceMs = 300) {
    const srv = await startServer({
      port: 0,
      host: '127.0.0.1',
      publicUrl: 'https://lunajam.sn0w13.de',
      maxParticipants: 32,
      hostGraceMs,
      roomTtlMs: 60000,
      rateLimitPerSec: 120,
      maxConnections: 64,
      idleTimeoutMs: 60000,
      maxRooms: 32,
      roomsPerConn: 10,
      maxConnsPerIp: 32,
    })
    closers.push(() => srv.close())
    return srv
  }

  it('stamps verified guest addedBy, enforces permissions, supports speaker mode, and reconnects host', async () => {
    const srv = await boot(1000)
    const host = await connectClient(srv.port)
    const guest1 = await connectClient(srv.port)
    const guest2 = await connectClient(srv.port)
    closers.push(() => host.close(), () => guest1.close(), () => guest2.close())

    const wHost = await host.next((m) => m.t === 'welcome')
    const wG1 = await guest1.next((m) => m.t === 'welcome')
    expect(wHost.t === 'welcome' && wG1.t === 'welcome').toBe(true)

    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Alex', avatarUrl: 'https://resources.tidal.com/images/alex.jpg' },
      allowGuestControl: false,
      queue: [
        {
          uid: 'h1',
          trackId: '101',
          title: 'Midnight City',
          artist: 'M83',
          addedBy: { cid: '', name: 'Spoofed', avatarUrl: null },
        },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'h1', posMs: 1000, playing: true },
    })

    const created = await host.next((m) => m.t === 'room.joined')
    if (created.t !== 'room.joined') throw new Error('expected room.joined')
    const code = created.state.code
    const hostToken = created.hostToken!
    expect(created.state.queue[0]!.addedBy.name).toBe('Alex')

    guest1.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: 'spoof-cid', name: 'Mia', avatarUrl: 'https://resources.tidal.com/images/mia.jpg' },
      audioMode: 'remote',
    })
    const g1Joined = await guest1.next((m) => m.t === 'room.joined')
    expect(g1Joined.t === 'room.joined' && g1Joined.role === 'guest').toBe(true)

    guest2.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'Liam', avatarUrl: null },
      audioMode: 'speaker',
    })
    const g2Joined = await guest2.next((m) => m.t === 'room.joined')
    if (g2Joined.t !== 'room.joined') throw new Error('expected guest2 joined')
    expect(g2Joined.state.participants.find((p) => p.name === 'Liam')?.audioMode).toBe('speaker')

    guest1.send({ v: 2, t: 'playback.control', action: { kind: 'next' } })
    const forbidden = await guest1.next((m) => m.t === 'error')
    expect(forbidden.t === 'error' && forbidden.code).toBe('forbidden')

    guest1.send({
      v: 2,
      t: 'queue.add',
      insert: 'last',
      tracks: [{ trackId: '202', title: 'Genesis', artist: 'Justice' }],
    })
    const stateAfterAdd = await host.next((m) => m.t === 'room.state' && m.state.queue.length === 2)
    if (stateAfterAdd.t !== 'room.state') throw new Error('expected room.state')
    const addedTrack = stateAfterAdd.state.queue[1]!
    expect(addedTrack.addedBy.name).toBe('Mia')
    expect(addedTrack.addedBy.cid).not.toBe('spoof-cid')

    guest1.send({ v: 2, t: 'queue.remove', uid: 'h1' })
    const forbidRemoveHost = await guest1.next((m) => m.t === 'error')
    expect(forbidRemoveHost.t === 'error' && forbidRemoveHost.code).toBe('forbidden')

    guest1.send({ v: 2, t: 'queue.remove', uid: addedTrack.uid })
    const stateAfterOwnRemove = await host.next((m) => m.t === 'room.state' && m.state.queue.length === 1)
    expect(stateAfterOwnRemove.t).toBe('room.state')

    host.send({ v: 2, t: 'room.permissions', allowGuestControl: true })
    await guest1.next((m) => m.t === 'room.state' && m.state.allowGuestControl === true)

    guest1.send({ v: 2, t: 'playback.control', action: { kind: 'pause' } })
    const cmd = await host.next((m) => m.t === 'playback.command')
    expect(cmd.t === 'playback.command' && cmd.action.kind).toBe('pause')
    expect(cmd.t === 'playback.command' && cmd.from.name).toBe('Mia')

    guest1.send({ v: 2, t: 'room.mode', audioMode: 'speaker' })
    const modeState = await host.next(
      (m) => m.t === 'room.state' && m.state.participants.some((p) => p.name === 'Mia' && p.audioMode === 'speaker'),
    )
    expect(modeState.t).toBe('room.state')

    host.send({ v: 2, t: 'room.kick', targetCid: g2Joined.state.participants.find((p) => p.name === 'Liam')!.cid })
    const kicked = await guest2.next((m) => m.t === 'room.ended')
    expect(kicked.t === 'room.ended' && kicked.reason).toBe('banned')

    await host.close()
    const hostReconnected = await connectClient(srv.port)
    closers.push(() => hostReconnected.close())
    await hostReconnected.next((m) => m.t === 'welcome')
    hostReconnected.send({
      v: 2,
      t: 'room.create',
      code,
      hostToken,
      profile: { cid: '', name: 'Alex', avatarUrl: null },
      allowGuestControl: true,
      queue: [],
      currentIndex: 0,
      playback: null,
    })
    const rejoined = await hostReconnected.next((m) => m.t === 'room.joined')
    expect(rejoined.t === 'room.joined' && rejoined.state.code).toBe(code)
    expect(rejoined.t === 'room.joined' && rejoined.state.participants.length).toBe(2)
  })

  it('promotes solo standby session via /api/resolve and /join and escapes HTML', async () => {
    const srv = await boot()
    const solo = await connectClient(srv.port)
    closers.push(() => solo.close())
    await solo.next((m) => m.t === 'welcome')

    solo.send({
      v: 2,
      t: 'standby.open',
      profile: { cid: '', name: '<script>alert(1)</script>', avatarUrl: null },
      queue: [{ trackId: '777', title: 'Nightcall', artist: 'Kavinsky' }],
      currentIndex: 0,
      playback: { trackId: '777', queueUid: null, posMs: 12000, playing: true },
      allowGuestControl: true,
    })

    const ready = await solo.next((m) => m.t === 'standby.ready')
    if (ready.t !== 'standby.ready') throw new Error('expected standby.ready')
    expect(ready.standbyId.startsWith('s_')).toBe(true)

    const resolveRes = await fetch(`http://127.0.0.1:${srv.port}/api/resolve/${ready.standbyId}`)
    expect(resolveRes.status).toBe(200)
    const summary = (await resolveRes.json()) as { code: string; track: { title: string } | null }
    expect(summary.code.length).toBe(8)
    expect(summary.track?.title).toBe('Nightcall')

    const promoted = await solo.next((m) => m.t === 'standby.promoted')
    if (promoted.t !== 'standby.promoted') throw new Error('expected standby.promoted')
    expect(promoted.state.code).toBe(summary.code)
    expect(promoted.hostToken.length).toBeGreaterThan(8)

    const joinRes = await fetch(`http://127.0.0.1:${srv.port}/join/${ready.standbyId}`)
    expect(joinRes.status).toBe(200)
    const html = await joinRes.text()
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('tidaluna://lunajam/join?code=')
    expect(html).toContain('127.0.0.1:')
  })

  it('enforces global and per-member track add permissions and room-bans kicked peers until new Jam', async () => {
    const srv = await boot()
    const host = await connectClient(srv.port)
    const mia = await connectClient(srv.port)
    const liam = await connectClient(srv.port)
    closers.push(() => host.close(), () => mia.close(), () => liam.close())

    await Promise.all([
      host.next((m) => m.t === 'welcome'),
      mia.next((m) => m.t === 'welcome'),
      liam.next((m) => m.t === 'welcome'),
    ])

    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
      allowGuestControl: false,
      allowGuestAdd: false,
      queue: [
        { uid: 'h1', trackId: '101', title: 'Midnight City', artist: 'M83', addedBy: { cid: '', name: 'Alex', avatarUrl: null } },
        { uid: 'h2', trackId: '505', title: '505', artist: 'Arctic Monkeys', addedBy: { cid: '', name: 'Alex', avatarUrl: null } },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'h1', posMs: 1000, playing: true },
    })
    const created = await host.next((m) => m.t === 'room.joined')
    if (created.t !== 'room.joined') throw new Error('expected created')
    const code = created.state.code

    mia.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'Mia', avatarUrl: null, tidalUserId: '987654' },
      audioMode: 'remote',
      peerId: 'p_mia_12345678',
    })
    const miaJoined = await mia.next((m) => m.t === 'room.joined')
    if (miaJoined.t !== 'room.joined') throw new Error('expected mia joined')
    const miaCid = miaJoined.state.participants.find((p) => p.name === 'Mia')!.cid
    expect(miaJoined.state.allowGuestAdd).toBe(false)
    expect(miaJoined.state.participants.find((p) => p.cid === miaCid)?.canAddTracks).toBe(false)

    mia.send({
      v: 2,
      t: 'queue.add',
      insert: 'next',
      tracks: [{ trackId: '303', title: 'Kids', artist: 'MGMT' }],
    })
    const addDenied = await mia.next((m) => m.t === 'error')
    expect(addDenied.t === 'error' && addDenied.code).toBe('add_forbidden')

    host.send({ v: 2, t: 'room.memberPermission', targetCid: miaCid, canAddTracks: true })
    const grantedState = await mia.next(
      (m) => m.t === 'room.state' && Boolean(m.state.participants.find((p) => p.cid === miaCid)?.canAddTracks),
    )
    expect(grantedState.t).toBe('room.state')

    mia.send({
      v: 2,
      t: 'queue.add',
      insert: 'next',
      tracks: [{ trackId: '303', title: 'Kids', artist: 'MGMT' }],
    })
    const afterAdd = await host.next((m) => m.t === 'room.state' && m.state.queue.length === 3)
    if (afterAdd.t !== 'room.state') throw new Error('expected queue state')
    expect(afterAdd.state.queue[1]!.addedBy.tidalUserId).toBe('987654')

    liam.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'Liam', avatarUrl: null },
      audioMode: 'remote',
      peerId: 'p_liam_87654321',
    })
    await liam.next((m) => m.t === 'room.joined')
    liam.send({
      v: 2,
      t: 'queue.add',
      insert: 'last',
      tracks: [{ trackId: '404', title: 'Veridis Quo', artist: 'Daft Punk' }],
    })
    const liamDenied = await liam.next((m) => m.t === 'error')
    expect(liamDenied.t === 'error' && liamDenied.code).toBe('add_forbidden')

    host.send({
      v: 2,
      t: 'playback.sync',
      playback: { trackId: '303', queueUid: afterAdd.state.queue[1]!.uid, posMs: 4000, playing: true },
      currentIndex: 1,
    })
    await liam.next((m) => m.t === 'playback.tick' && m.currentIndex === 1)

    host.send({ v: 2, t: 'room.kick', targetCid: miaCid })
    const miaEnded = await mia.next((m) => m.t === 'room.ended')
    expect(miaEnded.t === 'room.ended' && miaEnded.reason).toBe('banned')

    const afterBanState = await host.next(
      (m) => m.t === 'room.state' && !m.state.participants.some((p) => p.cid === miaCid),
    )
    if (afterBanState.t !== 'room.state') throw new Error('expected room.state after ban')
    expect(afterBanState.state.queue.length).toBe(2)
    expect(afterBanState.state.queue.every((t) => t.addedBy.cid !== miaCid)).toBe(true)
    expect(afterBanState.state.currentIndex).toBe(1)
    expect(afterBanState.state.playback?.trackId).toBe('505')

    const retrySamePeer = await connectClient(srv.port)
    const retrySameTidal = await connectClient(srv.port)
    closers.push(() => retrySamePeer.close(), () => retrySameTidal.close())
    await Promise.all([retrySamePeer.next((m) => m.t === 'welcome'), retrySameTidal.next((m) => m.t === 'welcome')])

    retrySamePeer.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'AltName', avatarUrl: null },
      audioMode: 'remote',
      peerId: 'p_mia_12345678',
    })
    const peerBlocked = await retrySamePeer.next((m) => m.t === 'error')
    expect(peerBlocked.t === 'error' && peerBlocked.code).toBe('room_banned')

    retrySameTidal.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'AltName', avatarUrl: null, tidalUserId: '987654' },
      audioMode: 'remote',
      peerId: 'p_other_device_99',
    })
    const tidalBlocked = await retrySameTidal.next((m) => m.t === 'error')
    expect(tidalBlocked.t === 'error' && tidalBlocked.code).toBe('room_banned')

    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
      allowGuestControl: true,
      allowGuestAdd: true,
      queue: [],
      currentIndex: -1,
      playback: null,
    })
    const newRoom = await host.next((m) => m.t === 'room.joined')
    if (newRoom.t !== 'room.joined') throw new Error('expected new room')
    expect(newRoom.state.code).not.toBe(code)

    retrySamePeer.send({
      v: 2,
      t: 'room.join',
      code: newRoom.state.code,
      profile: { cid: '', name: 'Mia', avatarUrl: null, tidalUserId: '987654' },
      audioMode: 'remote',
      peerId: 'p_mia_12345678',
    })
    const miaRejoinedNew = await retrySamePeer.next((m) => m.t === 'room.joined')
    expect(miaRejoinedNew.t).toBe('room.joined')
  })

  it('accepts large 150-track room payloads over 55 KB without 1009 disconnect', async () => {
    const srv = await boot()
    const host = await connectClient(srv.port)
    closers.push(() => host.close())
    await host.next((m) => m.t === 'welcome')

    const queue = Array.from({ length: 150 }, (_, i) => ({
      uid: `seed-${i}`,
      trackId: String(100000 + i),
      title: `Track Title With Detailed Metadata ${i}`,
      artist: `Artist Name Number ${i}`,
      album: `Album Release Collection ${i}`,
      coverUrl: `https://resources.tidal.com/images/5e52c0d2/63fe/43eb/9ab4/0786df7dbef${i % 10}/320x320.jpg`,
      durationSec: 180 + i,
      addedBy: { cid: '', name: 'HostUser', avatarUrl: null, tidalUserId: '100200300' },
    }))
    const payloadBytes = Buffer.byteLength(
      JSON.stringify({
        v: 2,
        t: 'room.create',
        profile: { cid: '', name: 'HostUser', avatarUrl: null, tidalUserId: '100200300' },
        allowGuestControl: true,
        allowGuestAdd: true,
        queue,
        currentIndex: 0,
        playback: { trackId: '100000', queueUid: 'seed-0', posMs: 0, playing: true },
      }),
    )
    expect(payloadBytes).toBeGreaterThan(50000)

    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'HostUser', avatarUrl: null, tidalUserId: '100200300' },
      allowGuestControl: true,
      allowGuestAdd: true,
      queue,
      currentIndex: 0,
      playback: { trackId: '100000', queueUid: 'seed-0', posMs: 0, playing: true },
    })
    const joined = await host.next((m) => m.t === 'room.joined')
    expect(joined.t === 'room.joined' && joined.state.queue.length).toBe(150)
  })

  it('updates participant avatar and profilePath via profile.update across participants and queue items', async () => {
    const srv = await boot()
    const host = await connectClient(srv.port)
    const guest = await connectClient(srv.port)
    closers.push(() => host.close(), () => guest.close())

    await Promise.all([host.next((m) => m.t === 'welcome'), guest.next((m) => m.t === 'welcome')])

    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
      allowGuestControl: true,
      allowGuestAdd: true,
      queue: [{ uid: 'h1', trackId: '101', title: 'Track', artist: 'Artist', addedBy: { cid: '', name: 'Alex', avatarUrl: null } }],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'h1', posMs: 0, playing: true },
    })
    const created = await host.next((m) => m.t === 'room.joined')
    if (created.t !== 'room.joined') throw new Error('expected created')

    guest.send({
      v: 2,
      t: 'room.join',
      code: created.state.code,
      profile: { cid: '', name: 'Mia', avatarUrl: null, tidalUserId: '987654' },
      audioMode: 'remote',
    })
    await guest.next((m) => m.t === 'room.joined')

    host.send({
      v: 2,
      t: 'profile.update',
      profile: {
        cid: '',
        name: 'Alex',
        avatarUrl: 'https://resources.tidal.com/images/alex-v2.jpg',
        tidalUserId: '424242',
        profilePath: '/@alex',
      },
    })

    const updated = await guest.next(
      (m) =>
        m.t === 'room.state' &&
        m.state.participants.some((p) => p.name === 'Alex' && p.profilePath === '/@alex'),
    )
    if (updated.t !== 'room.state') throw new Error('expected updated state')
    const alex = updated.state.participants.find((p) => p.name === 'Alex')
    expect(alex?.avatarUrl).toBe('https://resources.tidal.com/images/alex-v2.jpg')
    expect(updated.state.queue[0]!.addedBy.profilePath).toBe('/@alex')
    expect(updated.state.queue[0]!.addedBy.avatarUrl).toBe('https://resources.tidal.com/images/alex-v2.jpg')
  })

  it('survives malformed percent-encoding, keeps standby unpromoted for link previews, and trusts rightmost X-Forwarded-For IP', async () => {
    const srv = await boot()

    const badJoin = await fetch(`http://127.0.0.1:${srv.port}/join/%E0%A4%A`)
    expect(badJoin.status).toBe(400)
    expect(badJoin.headers.get('x-content-type-options')).toBe('nosniff')
    expect(badJoin.headers.get('x-frame-options')).toBe('DENY')

    const badResolve = await fetch(`http://127.0.0.1:${srv.port}/api/resolve/%ZZ`)
    expect(badResolve.status).toBe(400)

    const solo = await connectClient(srv.port, { 'X-Forwarded-For': '198.51.100.1' })
    closers.push(() => solo.close())
    await solo.next((m) => m.t === 'welcome')
    solo.send({
      v: 2,
      t: 'standby.open',
      profile: { cid: '', name: 'Host', avatarUrl: null },
      queue: [{ trackId: '777', title: 'Nightcall', artist: 'Kavinsky' }],
      currentIndex: 0,
      playback: { trackId: '777', queueUid: null, posMs: 1000, playing: true },
      allowGuestControl: true,
    })
    const ready = await solo.next((m) => m.t === 'standby.ready')
    if (ready.t !== 'standby.ready') throw new Error('expected standby.ready')

    const botPreview = await fetch(`http://127.0.0.1:${srv.port}/join/${ready.standbyId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
    })
    expect(botPreview.status).toBe(200)
    expect(await botPreview.text()).toContain('Nightcall')

    const headPreview = await fetch(`http://127.0.0.1:${srv.port}/join/${ready.standbyId}`, { method: 'HEAD' })
    expect(headPreview.status).toBe(200)
    expect(solo.queue.some((m) => m.t === 'standby.promoted')).toBe(false)

    const humanJoin = await fetch(`http://127.0.0.1:${srv.port}/join/${ready.standbyId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    expect(humanJoin.status).toBe(200)
    const promoted = await solo.next((m) => m.t === 'standby.promoted')
    if (promoted.t !== 'standby.promoted') throw new Error('expected standby.promoted')

    const bannedGuest = await connectClient(srv.port, { 'X-Forwarded-For': '1.2.3.4, 203.0.113.55' })
    closers.push(() => bannedGuest.close())
    await bannedGuest.next((m) => m.t === 'welcome')
    bannedGuest.send({
      v: 2,
      t: 'room.join',
      code: promoted.state.code,
      profile: { cid: '', name: 'Bad', avatarUrl: null },
      audioMode: 'remote',
    })
    const gJoined = await bannedGuest.next((m) => m.t === 'room.joined')
    if (gJoined.t !== 'room.joined') throw new Error('expected guest joined')
    const badCid = gJoined.state.participants.find((p) => p.name === 'Bad')!.cid

    solo.send({ v: 2, t: 'room.kick', targetCid: badCid })
    const ended = await bannedGuest.next((m) => m.t === 'room.ended')
    expect(ended.t === 'room.ended' && ended.reason).toBe('banned')

    const spoofPrefixRetry = await connectClient(srv.port, { 'X-Forwarded-For': '8.8.8.8, 203.0.113.55' })
    closers.push(() => spoofPrefixRetry.close())
    await spoofPrefixRetry.next((m) => m.t === 'welcome')
    spoofPrefixRetry.send({
      v: 2,
      t: 'room.join',
      code: promoted.state.code,
      profile: { cid: '', name: 'Bad2', avatarUrl: null },
      audioMode: 'remote',
    })
    const blocked = await spoofPrefixRetry.next((m) => m.t === 'error')
    expect(blocked.t === 'error' && blocked.code).toBe('room_banned')

    const legitimateGuest = await connectClient(srv.port, { 'X-Forwarded-For': '203.0.113.55, 198.51.100.22' })
    closers.push(() => legitimateGuest.close())
    await legitimateGuest.next((m) => m.t === 'welcome')
    legitimateGuest.send({
      v: 2,
      t: 'room.join',
      code: promoted.state.code,
      profile: { cid: '', name: 'Good', avatarUrl: null },
      audioMode: 'remote',
    })
    const okJoined = await legitimateGuest.next((m) => m.t === 'room.joined')
    expect(okJoined.t).toBe('room.joined')
  })

  it('serves /join/:code with per-request nonce CSP, escapes script payloads in publicUrl, and rejects untrusted server links', async () => {
    const srv = await startServer({
      port: 0,
      host: '127.0.0.1',
      publicUrl: 'https://lunajam.sn0w13.de/foo</script><script>alert(1)</script>',
      maxParticipants: 32,
      hostGraceMs: 300,
      roomTtlMs: 60000,
      rateLimitPerSec: 120,
      maxConnections: 64,
      idleTimeoutMs: 60000,
      maxRooms: 32,
      roomsPerConn: 10,
      maxConnsPerIp: 32,
    })
    closers.push(() => srv.close())

    const host = await connectClient(srv.port)
    closers.push(() => host.close())
    await host.next((m) => m.t === 'welcome')
    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Host', avatarUrl: null },
      allowGuestControl: false,
      queue: [
        {
          uid: 'h1',
          trackId: '101',
          title: 'Night Drive',
          artist: 'Subzero',
          addedBy: { cid: '', name: 'Host', avatarUrl: null },
        },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'h1', posMs: 0, playing: false },
    })
    const created = await host.next((m) => m.t === 'room.joined')
    if (created.t !== 'room.joined') throw new Error('expected room.joined')

    const res1 = await fetch(`http://127.0.0.1:${srv.port}/join/${created.state.code}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    expect(res1.status).toBe(200)
    const csp1 = res1.headers.get('content-security-policy') ?? ''
    const scriptSrc1 = csp1
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('script-src')) ?? ''
    expect(scriptSrc1).not.toContain("'unsafe-inline'")
    const nonceMatch1 = /script-src 'nonce-([^']+)'/.exec(csp1)
    expect(nonceMatch1).not.toBeNull()
    const nonce1 = nonceMatch1![1]!
    const html1 = await res1.text()
    expect(html1).toContain(`<script nonce="${nonce1}">`)
    expect(html1).toContain('\\u003c/script\\u003e')
    expect(html1).not.toContain('</script><script>alert(1)</script>')

    const res2 = await fetch(`http://127.0.0.1:${srv.port}/join/${created.state.code}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const csp2 = res2.headers.get('content-security-policy') ?? ''
    const nonceMatch2 = /script-src 'nonce-([^']+)'/.exec(csp2)
    expect(nonceMatch2).not.toBeNull()
    expect(nonceMatch2![1]).not.toBe(nonce1)

    const client = new SessionClient(
      () => {
        throw new Error('should not connect WebSocket for untrusted server')
      },
      async () => {
        throw new Error('should not fetch untrusted server')
      },
    )
    const joined = await client.joinRoom({
      input: 'https://evil.example/join/K7M4P9Q2',
      serverUrl: 'https://lunajam.sn0w13.de',
      profile: { cid: '', name: 'Guest', avatarUrl: null },
      audioMode: 'remote',
    })
    expect(joined).toBe(false)
    expect(client.snapshot().error).toContain('untrusted')
  })

  it('ignores X-Real-IP, honors trustProxy=false, groups IPv6 /64 for bans and limits, and caps httpRate entries', async () => {
    expect(normalizeIpKey('2001:db8:abcd:0001::5')).toBe(normalizeIpKey('2001:db8:abcd:1::9999'))
    expect(normalizeIpKey('::1')).toBe('::1')
    expect(normalizeIpKey('203.0.113.5')).toBe('203.0.113.5')

    const srv = await startServer({
      port: 0,
      host: '127.0.0.1',
      publicUrl: 'https://lunajam.sn0w13.de',
      maxParticipants: 32,
      hostGraceMs: 300,
      roomTtlMs: 60000,
      rateLimitPerSec: 120,
      maxConnections: 64,
      idleTimeoutMs: 60000,
      maxRooms: 32,
      roomsPerConn: 10,
      maxConnsPerIp: 2,
      trustProxy: true,
    })
    closers.push(() => srv.close())

    const host = await connectClient(srv.port, { 'X-Forwarded-For': '198.51.100.1' })
    closers.push(() => host.close())
    await host.next((m) => m.t === 'welcome')
    host.send({
      v: 2,
      t: 'room.create',
      profile: { cid: '', name: 'Host', avatarUrl: null },
      allowGuestControl: false,
      queue: [
        {
          uid: 'h1',
          trackId: '101',
          title: 'Night Drive',
          artist: 'Subzero',
          addedBy: { cid: '', name: 'Host', avatarUrl: null },
        },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'h1', posMs: 0, playing: false },
    })
    const created = await host.next((m) => m.t === 'room.joined')
    if (created.t !== 'room.joined') throw new Error('expected room.joined')
    const code = created.state.code

    const v6Bad = await connectClient(srv.port, {
      'X-Forwarded-For': '2001:db8:1111:2222::1',
      'X-Real-IP': '198.51.100.10',
    })
    closers.push(() => v6Bad.close())
    await v6Bad.next((m) => m.t === 'welcome')
    v6Bad.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'BadV6', avatarUrl: null },
      audioMode: 'remote',
    })
    const badJoined = await v6Bad.next((m) => m.t === 'room.joined')
    if (badJoined.t !== 'room.joined') throw new Error('expected badV6 joined')
    const badCid = badJoined.state.participants.find((p) => p.name === 'BadV6')!.cid

    host.send({ v: 2, t: 'room.kick', targetCid: badCid })
    const kicked = await v6Bad.next((m) => m.t === 'room.ended')
    expect(kicked.t === 'room.ended' && kicked.reason).toBe('banned')

    const v6Same64SpoofRealIp = await connectClient(srv.port, {
      'X-Forwarded-For': '2001:db8:1111:2222::beef',
      'X-Real-IP': '198.51.100.99',
    })
    closers.push(() => v6Same64SpoofRealIp.close())
    await v6Same64SpoofRealIp.next((m) => m.t === 'welcome')
    v6Same64SpoofRealIp.send({
      v: 2,
      t: 'room.join',
      code,
      profile: { cid: '', name: 'StillBanned', avatarUrl: null },
      audioMode: 'remote',
    })
    const banErr = await v6Same64SpoofRealIp.next((m) => m.t === 'error')
    expect(banErr.t === 'error' && banErr.code).toBe('room_banned')

    const v6Limit1 = await connectClient(srv.port, { 'X-Forwarded-For': '2001:db8:aaaa:bbbb::1' })
    const v6Limit2 = await connectClient(srv.port, { 'X-Forwarded-For': '2001:db8:aaaa:bbbb::2' })
    closers.push(() => v6Limit1.close(), () => v6Limit2.close())
    await expect(
      connectClient(srv.port, { 'X-Forwarded-For': '2001:db8:aaaa:bbbb::3' }),
    ).rejects.toThrow()

    const noProxySrv = await startServer({
      port: 0,
      host: '127.0.0.1',
      publicUrl: 'https://lunajam.sn0w13.de',
      maxParticipants: 32,
      hostGraceMs: 300,
      roomTtlMs: 60000,
      rateLimitPerSec: 120,
      maxConnections: 64,
      idleTimeoutMs: 60000,
      maxRooms: 32,
      roomsPerConn: 10,
      maxConnsPerIp: 2,
      trustProxy: false,
    })
    closers.push(() => noProxySrv.close())

    const np1 = await connectClient(noProxySrv.port, { 'X-Forwarded-For': '198.51.100.1' })
    const np2 = await connectClient(noProxySrv.port, { 'X-Forwarded-For': '198.51.100.2' })
    closers.push(() => np1.close(), () => np2.close())
    await expect(
      connectClient(noProxySrv.port, { 'X-Forwarded-For': '198.51.100.3' }),
    ).rejects.toThrow()

    const hub = new Hub({
      port: 0,
      host: '127.0.0.1',
      publicUrl: 'https://lunajam.sn0w13.de',
      maxParticipants: 32,
      hostGraceMs: 300,
      roomTtlMs: 60000,
      rateLimitPerSec: 120,
      maxConnections: 64,
      idleTimeoutMs: 60000,
      maxRooms: 32,
      roomsPerConn: 10,
      maxConnsPerIp: 32,
      trustProxy: true,
    })
    const hubPort = await hub.listen()
    closers.push(() => hub.close())

    for (let start = 0; start < 4500; start += 100) {
      await Promise.all(
        Array.from({ length: 100 }, (_, offset) => {
          const i = start + offset
          const ip = `198.18.${Math.floor(i / 256)}.${i % 256}`
          return fetch(`http://127.0.0.1:${hubPort}/api/resolve/NOPE`, {
            headers: { 'X-Forwarded-For': ip },
          })
        }),
      )
    }
    expect(hub.getHttpRateSize()).toBeGreaterThan(0)
    expect(hub.getHttpRateSize()).toBeLessThanOrEqual(4096)
  })
})
