import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoomSnapshot } from '../plugins/lunajam/src/protocol'
import { SessionClient } from '../plugins/lunajam/src/session/client'
import { TidalQueueSync } from '../plugins/lunajam/src/tidal/queueSync'
import { FooterButtonMount } from '../plugins/lunajam/src/ui/footerButton'
import { unmountParticipantMenu } from '../plugins/lunajam/src/ui/participantMenu'
import { PopoverController } from '../plugins/lunajam/src/ui/popover'
import { QueueAvatarDecorator } from '../plugins/lunajam/src/ui/queueAvatars'
import { QueueHeaderMount } from '../plugins/lunajam/src/ui/queueHeader'
import { resetLunaMock, setFakeQueue, getDispatched } from './helpers/lunaMock'

function flushReact(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30))
}

describe('Native TIDAL UI integration', () => {
  let dom: JSDOM
  const globalsBackup = new Map<string, unknown>()
  const globalKeys = [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'MutationObserver',
    'MouseEvent',
    'KeyboardEvent',
  ]

  beforeEach(() => {
    resetLunaMock()
    dom = new JSDOM(
      `<!doctype html><html><body>
        <aside data-test="play-queue">
          <header data-test="play-queue-header"><h2>Play Queue</h2></header>
          <div data-test="play-queue-item" id="row-0"><span class="title">Midnight City</span><span data-test="duration">4:03</span></div>
          <div data-test="play-queue-item" id="row-1"><span class="title">Genesis</span><span data-test="duration">3:54</span></div>
        </aside>
        <footer data-test="footer-player">
          <div class="left">Track</div>
          <div class="utilityContainer">
            <button data-test="toggle-lyrics" type="button">Lyrics</button>
            <button data-test="toggle-queue" type="button">Queue</button>
          </div>
        </footer>
      </body></html>`,
      { url: 'http://localhost/' },
    )
    for (const k of globalKeys) {
      globalsBackup.set(k, (globalThis as Record<string, unknown>)[k])
      ;(globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k]
    }
  })

  afterEach(() => {
    for (const k of globalKeys) {
      const prev = globalsBackup.get(k)
      if (prev === undefined) delete (globalThis as Record<string, unknown>)[k]
      else (globalThis as Record<string, unknown>)[k] = prev
    }
    dom.window.close()
  })

  it('mounts footer button, opens Start/Join popover, injects PlayQueue header and row avatars, and unloads cleanly', async () => {
    const unloads = new Set<() => void>()
    const session = new SessionClient()
    const queueSync = new TidalQueueSync(unloads, {
      isActive: () => Boolean(session.snapshot().room),
      getRole: () => session.snapshot().role,
      canGuestEdit: () => Boolean(session.snapshot().room?.allowGuestControl),
      canGuestAdd: () => {
        const s = session.snapshot()
        if (s.role === 'host') return true
        const me = s.cid ? s.room?.participants.find((p) => p.cid === s.cid) : undefined
        return me ? me.canAddTracks : Boolean(s.room?.allowGuestAdd)
      },
      getLocalProfile: () => ({ cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242' }),
      getRoom: () => session.snapshot().room,
      onGuestAdd: () => {},
      onGuestMove: () => {},
      onGuestRemove: () => {},
      onHostReplaceQueue: () => {},
      onStartJamWithTracks: () => {},
      onRestricted: () => {},
      onAddRestricted: () => {},
    })

    const headerMount = new QueueHeaderMount(unloads, session, () => {})
    const avatarDecorator = new QueueAvatarDecorator(unloads, session, queueSync)
    const popover = new PopoverController({
      session,
      onStartJam: () => {},
      onJoinJam: () => {},
      onSelectTrack: () => {},
    })
    new FooterButtonMount(unloads, session, popover, headerMount)

    await flushReact()

    const footerBtn = document.querySelector<HTMLButtonElement>('[data-test="lunajam-footer-btn"]')
    expect(footerBtn).not.toBeNull()
    expect(footerBtn!.classList.contains('is-live')).toBe(false)

    footerBtn!.click()
    await flushReact()
    expect(document.body.textContent).toContain('Start a Jam')
    expect(document.body.textContent).toContain('Host speaker')

    popover.unmount()

    const row0 = document.getElementById('row-0')!
    const row1 = document.getElementById('row-1')!
    const rootFiber0 = { tag: 3, stateNode: null as unknown, memoizedProps: {}, return: null as unknown }
    const fiber0 = { memoizedProps: { uid: 'nat-0', mediaItemId: '101', index: 0 }, return: rootFiber0 }
    const fiber1 = { memoizedProps: { uid: 'nat-1', mediaItemId: '202', index: 1 }, return: rootFiber0 }
    rootFiber0.stateNode = { current: rootFiber0 }
    ;(row0 as unknown as Record<string, unknown>).__reactFiber$test = fiber0
    ;(row1 as unknown as Record<string, unknown>).__reactFiber$test = fiber1

    setFakeQueue(
      [
        { uid: 'nat-0', mediaItemId: '101' },
        { uid: 'nat-1', mediaItemId: '202' },
      ],
      0,
    )

    const room: RoomSnapshot = {
      code: 'K7M4P9Q2',
      hostCid: 'c1',
      allowGuestControl: true,
      allowGuestAdd: true,
      participants: [
        { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242', role: 'host', audioMode: 'remote', canAddTracks: true },
        { cid: 'c2', name: 'Mia', avatarUrl: 'https://resources.tidal.com/images/mia.jpg', tidalUserId: '987654', role: 'guest', audioMode: 'speaker', canAddTracks: true },
      ],
      queue: [
        {
          uid: 'u1',
          trackId: '101',
          title: 'Midnight City',
          artist: 'M83',
          addedBy: { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
        },
        {
          uid: 'u2',
          trackId: '202',
          title: 'Genesis',
          artist: 'Justice',
          addedBy: { cid: 'c2', name: 'Mia', avatarUrl: 'https://resources.tidal.com/images/mia.jpg', tidalUserId: '987654' },
        },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'u1', posMs: 5000, serverTs: 1000, playing: true },
    }

    ;(session as unknown as { updateState: (p: unknown) => void }).updateState({
      status: 'connected',
      role: 'guest',
      cid: 'c2',
      room,
      audioMode: 'speaker',
    })
    queueSync.applyRoomToNative(room)
    headerMount.sync()
    avatarDecorator.refresh()
    await flushReact()

    expect(footerBtn!.classList.contains('is-live')).toBe(true)
    expect(footerBtn!.textContent).toContain('2')

    const queueHeader = document.querySelector('.lj-queue-mount')
    expect(queueHeader).not.toBeNull()
    expect(queueHeader!.textContent).toContain('Jam · 2')
    expect(queueHeader!.textContent).toContain("Playing on Alex's speaker")

    const badge0 = row0.querySelector('.lj-track-avatar')
    const badge1 = row1.querySelector('.lj-track-avatar')
    expect(badge0?.getAttribute('data-tooltip')).toBe('Added by Alex')
    expect(badge1?.getAttribute('data-tooltip')).toBe('Added by Mia')
    expect(badge1?.querySelector('img')?.getAttribute('src')).toBe('https://resources.tidal.com/images/mia.jpg')

    for (const unload of unloads) unload()
    unmountParticipantMenu()
    session.dispose()
    await flushReact()

    expect(document.querySelector('[data-test="lunajam-footer-btn"]')).toBeNull()
    expect(document.querySelector('.lj-queue-mount')).toBeNull()
    expect(document.querySelectorAll('.lj-track-avatar').length).toBe(0)
  })

  it('opens avatar mini context menu, toggles member add permissions, navigates to TIDAL profile, and unmounts cleanly', async () => {
    const unloads = new Set<() => void>()
    const session = new SessionClient()
    const queueSync = new TidalQueueSync(unloads, {
      isActive: () => Boolean(session.snapshot().room),
      getRole: () => session.snapshot().role,
      canGuestEdit: () => Boolean(session.snapshot().room?.allowGuestControl),
      canGuestAdd: () => true,
      getLocalProfile: () => ({ cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242' }),
      getRoom: () => session.snapshot().room,
      onGuestAdd: () => {},
      onGuestMove: () => {},
      onGuestRemove: () => {},
      onHostReplaceQueue: () => {},
      onStartJamWithTracks: () => {},
      onRestricted: () => {},
      onAddRestricted: () => {},
    })

    document.body.innerHTML = `
      <div class="_playQueueWrapper_cbf5aaa">
        <div class="_container_b3e8f28">
          <div class="_header_f4bacf5"><span data-test="playqueue-title">Play Queue</span></div>
          <div data-test="playqueue-item" data-test-media-item-id="101" id="row-0"><div class="_actions_3b2b8f9"></div></div>
          <div data-test="playqueue-item" data-test-media-item-id="202" id="row-1"><div class="_actions_3b2b8f9"></div></div>
        </div>
      </div>
      <footer data-test="footer-player">
        <div class="_utilityContainer_4b1f859">
          <div class="_utilityButtons_4d7aaf9">
            <button data-test="toggle-lyrics" type="button">Lyrics</button>
            <button aria-label="Toggle play queue" type="button">Queue</button>
          </div>
        </div>
      </footer>
    `

    const headerMount = new QueueHeaderMount(unloads, session, () => {})
    const avatarDecorator = new QueueAvatarDecorator(unloads, session, queueSync)
    const popover = new PopoverController({
      session,
      onStartJam: () => {},
      onJoinJam: () => {},
      onSelectTrack: () => {},
    })
    new FooterButtonMount(unloads, session, popover, headerMount)
    unloads.add(() => popover.unmount())
    unloads.add(() => unmountParticipantMenu())

    const row1 = document.getElementById('row-1')!
    setFakeQueue(
      [
        { uid: 'nat-0', mediaItemId: '101' },
        { uid: 'nat-1', mediaItemId: '202' },
      ],
      0,
    )

    const room: RoomSnapshot = {
      code: 'K7M4P9Q2',
      hostCid: 'c1',
      allowGuestControl: false,
      allowGuestAdd: true,
      participants: [
        { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242', role: 'host', audioMode: 'remote', canAddTracks: true },
        { cid: 'c2', name: 'Mia', avatarUrl: null, tidalUserId: '987654', role: 'guest', audioMode: 'remote', canAddTracks: true },
      ],
      queue: [
        {
          uid: 'u1',
          trackId: '101',
          title: 'Midnight City',
          artist: 'M83',
          addedBy: { cid: 'c1', name: 'Alex', avatarUrl: null, tidalUserId: '424242' },
        },
        {
          uid: 'u2',
          trackId: '202',
          title: 'Genesis',
          artist: 'Justice',
          addedBy: { cid: 'c2', name: 'Mia', avatarUrl: null, tidalUserId: '987654' },
        },
      ],
      currentIndex: 0,
      playback: { trackId: '101', queueUid: 'u1', posMs: 1000, serverTs: 1000, playing: true },
    }

    ;(session as unknown as { updateState: (p: unknown) => void }).updateState({
      status: 'connected',
      role: 'host',
      cid: 'c1',
      room,
      audioMode: 'remote',
    })
    queueSync.applyRoomToNative(room)
    headerMount.sync()
    avatarDecorator.refresh()
    await flushReact()

    expect(document.querySelector('._utilityButtons_4d7aaf9 [data-test="lunajam-footer-btn"]')).not.toBeNull()
    expect(document.querySelector('._container_b3e8f28 > .lj-queue-mount')).not.toBeNull()

    const badge1 = row1.querySelector<HTMLButtonElement>('.lj-track-avatar')
    expect(badge1).not.toBeNull()
    badge1!.click()
    await flushReact()

    const menu = document.querySelector<HTMLElement>('.lj-ctx-menu')
    expect(menu).not.toBeNull()
    expect(menu!.textContent).toContain('Mia')
    expect(menu!.textContent).toContain('View profile')
    expect(menu!.textContent).toContain('Can add tracks')
    expect(menu!.textContent).toContain('Ban from Jam')

    const memberSwitch = menu!.querySelector<HTMLButtonElement>('[role="switch"]')
    expect(memberSwitch?.getAttribute('aria-checked')).toBe('true')
    memberSwitch!.click()
    await flushReact()

    expect(memberSwitch?.getAttribute('aria-checked')).toBe('false')
    expect(menu!.textContent).toContain('Add off')
    expect(badge1!.classList.contains('is-muted-add')).toBe(true)

    const profileBtn = [...menu!.querySelectorAll<HTMLButtonElement>('.lj-ctx-item')].find((b) =>
      b.textContent?.includes('View profile'),
    )
    expect(profileBtn).toBeDefined()
    profileBtn!.click()
    await flushReact()

    expect(getDispatched()).toContainEqual({
      type: 'userProfiles/FETCH_USER_PROFILE',
      payload: { userId: 987654 },
    })
    expect(getDispatched()).toContainEqual({
      type: 'router/PUSH',
      payload: { pathname: '/user/987654', search: '', replace: false },
    })

    for (const unload of unloads) unload()
    session.dispose()
    await flushReact()

    expect(document.querySelector('.lj-ctx-layer')).toBeNull()
  })
})
