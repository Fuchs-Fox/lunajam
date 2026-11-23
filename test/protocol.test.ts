import { describe, expect, it } from 'vitest'
import {
  decodeClient,
  decodeServer,
  encode,
  formatCode,
  isRoomCode,
  isStandbyToken,
  normalizeCode,
  parseJoinTarget,
} from '../plugins/lunajam/src/protocol'

describe('protocol v2', () => {
  it('normalizes and formats Crockford room codes', () => {
    expect(normalizeCode('k7m4-poil')).toBe('K7M4P011')
    expect(formatCode('k7m4poil')).toBe('K7M4-P011')
    expect(isRoomCode('K7M4-P9Q2')).toBe(true)
    expect(isRoomCode('SHORT')).toBe(false)
    expect(isStandbyToken('s_abc123XYZ0')).toBe(true)
    expect(isStandbyToken('s_12')).toBe(false)
  })

  it('parses room codes, standby tokens, https invite links, and tidaluna deep links', () => {
    expect(parseJoinTarget('k7m4-p9q2')).toEqual({ token: 'K7M4P9Q2' })
    expect(parseJoinTarget('s_abc1234567')).toEqual({ token: 's_abc1234567' })
    expect(parseJoinTarget('https://lunajam.sn0w13.de/join/K7M4P9Q2')).toEqual({
      token: 'K7M4P9Q2',
      serverUrl: 'https://lunajam.sn0w13.de',
    })
    expect(parseJoinTarget('https://lunajam.sn0w13.de/join/s_abc1234567')).toEqual({
      token: 's_abc1234567',
      serverUrl: 'https://lunajam.sn0w13.de',
    })
    expect(
      parseJoinTarget('tidaluna://lunajam/join?code=K7M4P9Q2&server=https%3A%2F%2Flunajam.sn0w13.de'),
    ).toEqual({
      token: 'K7M4P9Q2',
      serverUrl: 'https://lunajam.sn0w13.de',
    })
    expect(parseJoinTarget('https://evil.example/join/K7M4P9Q2?server=javascript:alert(1)')).toEqual({
      token: 'K7M4P9Q2',
      serverUrl: undefined,
    })
    expect(parseJoinTarget('https://lunajam.sn0w13.de/join/K7M4P9Q2?server=https://evil.example')).toEqual({
      token: 'K7M4P9Q2',
      serverUrl: undefined,
    })
    expect(parseJoinTarget('invalid')).toBeNull()
  })

  it('roundtrips client and server envelopes and rejects invalid payloads', () => {
    const clientAdd = encode({
      v: 2,
      t: 'queue.add',
      insert: 'next',
      tracks: [{ trackId: '12345', title: 'Midnight City', artist: 'M83', durationSec: 243 }],
    })
    expect(decodeClient(clientAdd)).toEqual({
      v: 2,
      t: 'queue.add',
      insert: 'next',
      tracks: [{ trackId: '12345', title: 'Midnight City', artist: 'M83', durationSec: 243 }],
    })

    const standbyUpdate = encode({
      v: 2,
      t: 'standby.update',
      currentIndex: 1,
      playback: { trackId: '99', queueUid: null, posMs: 5000, playing: true },
    })
    expect(decodeClient(standbyUpdate)).toEqual({
      v: 2,
      t: 'standby.update',
      currentIndex: 1,
      playback: { trackId: '99', queueUid: null, posMs: 5000, playing: true },
    })

    const serverPromoted = encode({
      v: 2,
      t: 'standby.promoted',
      hostToken: 'tok-123',
      state: {
        code: 'K7M4P9Q2',
        hostCid: 'c1',
        allowGuestControl: true,
        allowGuestAdd: true,
        participants: [
          { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242', role: 'host', audioMode: 'remote', canAddTracks: true },
        ],
        queue: [
          {
            uid: 'u1',
            trackId: '100',
            title: 'Genesis',
            artist: 'Justice',
            addedBy: { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
          },
        ],
        currentIndex: 0,
        playback: { trackId: '100', queueUid: 'u1', posMs: 1200, serverTs: 4000, playing: true },
      },
    })
    expect(decodeServer(serverPromoted)?.t).toBe('standby.promoted')

    const memberPerm = encode({ v: 2, t: 'room.memberPermission', targetCid: 'c2', canAddTracks: false })
    expect(decodeClient(memberPerm)).toEqual({ v: 2, t: 'room.memberPermission', targetCid: 'c2', canAddTracks: false })

    const joinWithIds = encode({
      v: 2,
      t: 'room.join',
      code: 'K7M4P9Q2',
      profile: { cid: '', name: 'Mia', avatarUrl: null, tidalUserId: '987654', profilePath: '/@mia' },
      audioMode: 'remote',
      peerId: 'p_mia_12345678',
    })
    expect(decodeClient(joinWithIds)).toEqual({
      v: 2,
      t: 'room.join',
      code: 'K7M4P9Q2',
      profile: { cid: '', name: 'Mia', avatarUrl: null, tidalUserId: '987654', profilePath: '/@mia' },
      audioMode: 'remote',
      peerId: 'p_mia_12345678',
    })

    const profileUpdate = encode({
      v: 2,
      t: 'profile.update',
      profile: { cid: 'c2', name: 'Mia', avatarUrl: 'https://resources.tidal.com/images/mia.jpg', profilePath: '/artist/987654' },
    })
    expect(decodeClient(profileUpdate)).toEqual({
      v: 2,
      t: 'profile.update',
      profile: { cid: 'c2', name: 'Mia', avatarUrl: 'https://resources.tidal.com/images/mia.jpg', profilePath: '/artist/987654' },
    })

    expect(decodeServer(encode({ v: 2, t: 'room.ended', reason: 'banned' }))).toEqual({
      v: 2,
      t: 'room.ended',
      reason: 'banned',
    })

    expect(decodeClient('{"v":1,"t":"ping","clientTs":1}')).toBeNull()
    expect(decodeClient('{not json')).toBeNull()
    expect(decodeClient(JSON.stringify({ v: 2, t: 'queue.add', insert: 'next', tracks: [] }))).toBeNull()
    expect(decodeServer(JSON.stringify({ v: 2, t: 'room.ended', reason: 'unknown' }))).toBeNull()
  })

  it('strips unsafe control/bidi characters and enforces strict HTTPS domain allowlists on coverUrl and avatarUrl', () => {
    const sanitized = decodeClient(
      JSON.stringify({
        v: 2,
        t: 'room.join',
        code: 'K7M4P9Q2',
        profile: {
          cid: '',
          name: 'Al\u202ee\u0007x',
          avatarUrl: 'https://www.gravatar.com/avatar/00000000000000000000000000000000',
        },
        audioMode: 'remote',
      }),
    )
    expect(sanitized).toEqual({
      v: 2,
      t: 'room.join',
      code: 'K7M4P9Q2',
      profile: {
        cid: '',
        name: 'Alex',
        avatarUrl: 'https://www.gravatar.com/avatar/00000000000000000000000000000000',
      },
      audioMode: 'remote',
    })

    const evilProfile = decodeClient(
      JSON.stringify({
        v: 2,
        t: 'profile.update',
        profile: { cid: 'c1', name: 'Bob', avatarUrl: 'http://192.168.1.10/track.png' },
      }),
    )
    expect(evilProfile?.t === 'profile.update' && evilProfile.profile.avatarUrl).toBeNull()

    const discordAvatar = decodeClient(
      JSON.stringify({
        v: 2,
        t: 'profile.update',
        profile: { cid: 'c1', name: 'Bob', avatarUrl: 'https://cdn.discordapp.com/avatars/1/2.png' },
      }),
    )
    expect(discordAvatar?.t === 'profile.update' && discordAvatar.profile.avatarUrl).toBe(
      'https://cdn.discordapp.com/avatars/1/2.png',
    )

    const coverCheck = decodeClient(
      JSON.stringify({
        v: 2,
        t: 'queue.add',
        insert: 'last',
        tracks: [
          { trackId: '1', title: 'S\u2066ong', artist: 'Art', coverUrl: 'https://evil.example/c.jpg' },
          { trackId: '2', title: 'Ok', artist: 'Art', coverUrl: 'https://resources.tidal.com/images/ok/320x320.jpg' },
        ],
      }),
    )
    if (coverCheck?.t !== 'queue.add') throw new Error('expected queue.add')
    expect(coverCheck.tracks[0]!.title).toBe('Song')
    expect(coverCheck.tracks[0]!.coverUrl).toBeUndefined()
    expect(coverCheck.tracks[1]!.coverUrl).toBe('https://resources.tidal.com/images/ok/320x320.jpg')
  })

  it('preserves multi-platform cover domains while stripping untrusted cover origins', () => {
    const msg = decodeClient(
      JSON.stringify({
        v: 2,
        t: 'queue.add',
        insert: 'last',
        tracks: [
          {
            trackId: '1',
            title: 'Track 1',
            artist: 'Artist 1',
            coverUrl: 'https://i.scdn.co/image/ab67616d0000b273',
          },
          {
            trackId: '2',
            title: 'Track 2',
            artist: 'Artist 2',
            coverUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
          },
          {
            trackId: '3',
            title: 'Track 3',
            artist: 'Artist 3',
            coverUrl: 'https://evil.example/cover.jpg',
          },
        ],
      }),
    )
    if (msg?.t !== 'queue.add') throw new Error('expected queue.add')
    expect(msg.tracks[0]!.coverUrl).toBe('https://i.scdn.co/image/ab67616d0000b273')
    expect(msg.tracks[1]!.coverUrl).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
    expect(msg.tracks[2]!.coverUrl).toBeUndefined()
  })
})
