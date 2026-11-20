import type { ReactNode } from 'react'

type InterceptFn = (payload: unknown, type: string) => unknown

const storeState = {
  user: {
    meta: {
      id: 424242,
      profileName: 'Alex',
      username: 'alex',
      picture: 'aa-bb-cc-dd',
    },
  },
  playQueue: {
    currentIndex: 0,
    shuffleModeEnabled: false,
    uniqueIdCounter: 10,
    elements: [] as Array<{ uid: string; mediaItemId: string; priority: string; context: { type: string } }>,
    originalSource: [] as Array<{ uid: string; mediaItemId: string; priority: string; context: { type: string } }>,
  },
  playbackControls: {
    desiredPlaybackState: 'PAUSED',
    latestCurrentTime: 0,
    playbackContext: {
      actualProductId: '',
      actualDuration: 200,
    },
  },
}

const interceptMap = new Map<string, Set<InterceptFn>>()
const dispatched: Array<{ type: string; payload: unknown }> = []
const stateListeners = new Set<(s: string) => void>()
const transitionListeners = new Set<(item: unknown) => void>()
const storeSubscribers = new Set<() => void>()

export function resetLunaMock(): void {
  storeState.playQueue.currentIndex = 0
  storeState.playQueue.elements = []
  storeState.playQueue.originalSource = []
  storeState.playbackControls.desiredPlaybackState = 'PAUSED'
  storeState.playbackControls.latestCurrentTime = 0
  storeState.playbackControls.playbackContext.actualProductId = ''
  interceptMap.clear()
  dispatched.length = 0
  stateListeners.clear()
  transitionListeners.clear()
  storeSubscribers.clear()
}

export function setFakePlaybackContext(actualProductId: string, timeSec = 0): void {
  storeState.playbackControls.playbackContext.actualProductId = actualProductId
  storeState.playbackControls.latestCurrentTime = timeSec
}

export function setFakeQueue(
  elements: Array<{ uid: string; mediaItemId: string }>,
  currentIndex = 0,
): void {
  storeState.playQueue.elements = elements.map((e) => ({
    ...e,
    priority: 'priority_none',
    context: { type: 'UNKNOWN' },
  }))
  storeState.playQueue.originalSource = [...storeState.playQueue.elements]
  storeState.playQueue.currentIndex = currentIndex
}

export function getDispatched(): Array<{ type: string; payload: unknown }> {
  return dispatched
}

export const Tracer = () => ({
  errSignal: { _: undefined as unknown },
  trace: {
    log: () => {},
    warn: () => {},
    err: Object.assign(() => {}, { withContext: () => () => {} }),
  },
})

export const ReactiveStore = {
  async getPluginStorage<T extends Record<string, unknown>>(_name: string, defaults: T): Promise<T> {
    return { ...defaults }
  },
}

export class StyleTag {
  constructor(
    public readonly id: string,
    _unloads: Set<() => void>,
    public css?: string,
  ) {}
  remove(): void {}
  add(): void {}
}

export const redux = {
  store: {
    getState: () => storeState,
    subscribe(cb: () => void) {
      storeSubscribers.add(cb)
      return () => storeSubscribers.delete(cb)
    },
  },
  actions: new Proxy<Record<string, (payload?: unknown) => void>>(
    {},
    {
      get(_target, prop: string) {
        return (payload?: unknown) => {
          const handlers = interceptMap.get(prop)
          if (handlers) {
            for (const fn of handlers) {
              if (fn(payload, prop) === true) return
            }
          }
          dispatched.push({ type: prop, payload })
          if (prop === 'playQueue/RESET' && payload && typeof payload === 'object') {
            const p = payload as typeof storeState.playQueue
            if (Array.isArray(p.elements)) storeState.playQueue.elements = p.elements
            if (typeof p.currentIndex === 'number') storeState.playQueue.currentIndex = p.currentIndex
          } else if (prop === 'playQueue/MOVE_TO' && typeof payload === 'number') {
            storeState.playQueue.currentIndex = payload
            const el = storeState.playQueue.elements[payload]
            if (el) storeState.playbackControls.playbackContext.actualProductId = String(el.mediaItemId)
          } else if (prop === 'playQueue/SET_CURRENT_INDEX' && typeof payload === 'number') {
            storeState.playQueue.currentIndex = payload
          } else if (prop === 'playbackControls/PLAY') {
            storeState.playbackControls.desiredPlaybackState = 'PLAYING'
          } else if (prop === 'playbackControls/PAUSE') {
            storeState.playbackControls.desiredPlaybackState = 'PAUSED'
          } else if (prop === 'playbackControls/SEEK' && typeof payload === 'number') {
            storeState.playbackControls.latestCurrentTime = payload
          }
          for (const cb of storeSubscribers) cb()
        }
      },
    },
  ),
  intercept(types: string | string[], unloads: Set<() => void>, cb: InterceptFn) {
    const arr = Array.isArray(types) ? types : [types]
    for (const t of arr) {
      let set = interceptMap.get(t)
      if (!set) {
        set = new Set()
        interceptMap.set(t, set)
      }
      set.add(cb)
    }
    const off = () => {
      for (const t of arr) interceptMap.get(t)?.delete(cb)
    }
    unloads.add(off)
    return off
  },
}

export const PlayState = {
  get playQueue() {
    return storeState.playQueue
  },
  get playbackControls() {
    return storeState.playbackControls
  },
  get playbackContext() {
    return storeState.playbackControls.playbackContext
  },
  get currentTime() {
    return storeState.playbackControls.latestCurrentTime
  },
  get playTime() {
    return storeState.playbackControls.latestCurrentTime
  },
  get playing() {
    return storeState.playbackControls.desiredPlaybackState === 'PLAYING'
  },
  play() {
    redux.actions['playbackControls/PLAY']()
  },
  pause() {
    redux.actions['playbackControls/PAUSE']()
  },
  next() {
    redux.actions['playQueue/MOVE_NEXT']()
  },
  previous() {
    redux.actions['playQueue/MOVE_PREVIOUS']()
  },
  moveTo(i: number) {
    redux.actions['playQueue/MOVE_TO'](i)
  },
  seek(s: number) {
    redux.actions['playbackControls/SEEK'](s)
  },
  updatePlayQueue(pq: Partial<typeof storeState.playQueue>) {
    redux.actions['playQueue/RESET']({ ...storeState.playQueue, ...pq })
  },
  onState(_unloads: Set<() => void>, cb: (s: string) => void) {
    stateListeners.add(cb)
    return () => stateListeners.delete(cb)
  },
}

export const MediaItem = {
  async fromId(id: string) {
    return {
      id,
      duration: 210,
      tidalItem: { title: `Track ${id}`, artists: [{ name: 'Artist' }], album: { title: 'Album' }, duration: 210 },
      async title() {
        return `Track ${id}`
      },
      async artists() {
        return [Promise.resolve({ name: 'Artist' })]
      },
      async album() {
        return {
          async title() {
            return 'Album'
          },
        }
      },
      async coverUrl() {
        return `https://resources.tidal.com/images/${id}/320x320.jpg`
      },
    }
  },
  async fromPlaybackContext() {
    return undefined
  },
  onMediaTransition(_unloads: Set<() => void>, cb: (item: unknown) => void) {
    transitionListeners.add(cb)
    return () => transitionListeners.delete(cb)
  },
}

export const ContextMenu = {
  addButton() {
    return {
      text: '',
      onClick() {},
      async show() {},
      hide() {},
    }
  },
  onMediaItem() {},
}

export const ipcRenderer = {
  onOpenUrl() {},
}

export const LunaSettings = ({ children }: { children?: ReactNode }) => children ?? null
export const LunaSwitchSetting = () => null
export const LunaSelectSetting = () => null
export const LunaSelectItem = () => null
export const LunaTextSetting = () => null
