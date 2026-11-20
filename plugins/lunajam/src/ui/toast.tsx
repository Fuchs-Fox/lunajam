import { createRoot, type Root } from 'react-dom/client'

let hostEl: HTMLDivElement | null = null
let reactRoot: Root | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let removeTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(text: string, tone: 'info' | 'warn' = 'info'): void {
  if (typeof document === 'undefined' || !document.body) return
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (removeTimer !== null) {
    clearTimeout(removeTimer)
    removeTimer = null
  }
  if (!hostEl) {
    hostEl = document.createElement('div')
    hostEl.className = 'lj-root'
    document.body.appendChild(hostEl)
    reactRoot = createRoot(hostEl)
  }

  const renderToast = (leaving: boolean) => {
    reactRoot?.render(
      <div className={`lj-toast${tone === 'warn' ? ' is-warn' : ''}${leaving ? ' is-leaving' : ''}`} role="status">
        <span className={`lj-dot${tone === 'warn' ? ' is-warn' : ''}`} aria-hidden="true" />
        <span>{text}</span>
      </div>,
    )
  }

  renderToast(false)
  hideTimer = setTimeout(() => {
    hideTimer = null
    renderToast(true)
    removeTimer = setTimeout(() => {
      removeTimer = null
      reactRoot?.render(null)
    }, 150)
  }, 2400)
}

export function unmountToast(): void {
  if (hideTimer !== null) clearTimeout(hideTimer)
  if (removeTimer !== null) clearTimeout(removeTimer)
  hideTimer = null
  removeTimer = null
  reactRoot?.unmount()
  reactRoot = null
  hostEl?.remove()
  hostEl = null
}
