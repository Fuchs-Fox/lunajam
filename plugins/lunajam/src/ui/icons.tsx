import type { FC, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export const IconJam: FC<IconProps> = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="5.5" cy="5.5" r="2.25" />
    <path d="M1.75 13c0-1.95 1.65-3.25 3.75-3.25s3.75 1.3 3.75 3.25" />
    <path d="M11 4.75a3.5 3.5 0 0 1 0 6.5" />
    <path d="M13.25 2.75a6.25 6.25 0 0 1 0 10.5" />
  </svg>
)

export const IconQr: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="2" y="2" width="4.5" height="4.5" rx="1" />
    <rect x="9.5" y="2" width="4.5" height="4.5" rx="1" />
    <rect x="2" y="9.5" width="4.5" height="4.5" rx="1" />
    <path d="M9.5 9.5h2v2h-2zM13 9.5h1M9.5 13h2M13 12.5v1.5" />
  </svg>
)

export const IconCopy: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M3 10.5H2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V3" />
  </svg>
)

export const IconCheck: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3.25 8.5l3 3 6.5-6.5" />
  </svg>
)

export const IconHeadphones: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M2.5 9.5V8a5.5 5.5 0 0 1 11 0v1.5" />
    <rect x="1.75" y="9" width="2.75" height="4.5" rx="1" />
    <rect x="11.5" y="9" width="2.75" height="4.5" rx="1" />
  </svg>
)

export const IconSpeaker: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="3.5" y="1.75" width="9" height="12.5" rx="1.5" />
    <circle cx="8" cy="5.25" r="1" />
    <circle cx="8" cy="10" r="2.25" />
  </svg>
)

export const IconClose: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export const IconUser: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M2.75 13.5c0-2.25 2.2-3.75 5.25-3.75s5.25 1.5 5.25 3.75" />
  </svg>
)

export const IconBan: FC<IconProps> = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M4.2 4.2l7.6 7.6" />
  </svg>
)
