import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fontHead } from '../base/font-head'
import { iconHead } from '../base/icon-head'
import { pageStyle } from '../base/page-style'
import branding from '../branding.json'
import { AppBar } from './bar'
import { AppHome, homeTabs, settingsPath } from './home'
import type { Viewer } from './viewer'

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const digest = async (text: string) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))))
// Base's page style carries the one dropdown rule (select-style.ts) every app document keeps.
const style = digest(pageStyle)

/** A signed-in app document rendered once on the server: the theme and the look, Base's page style by its hash, and
 *  public/look/cords.js to draw the wall's cord. */
export async function appDocument(title: string, body: ReactElement): Promise<Response> {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + `<title>${escape(title)}</title>${iconHead}<link rel="stylesheet" href="/rer-theme.css">${fontHead}<style>${pageStyle}</style></head>`
    + `<body class="app">${renderToStaticMarkup(body)}<script src="/look/cords.js" defer></script></body></html>`
  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow',
    'content-security-policy': `default-src 'none'; script-src 'self'; style-src 'self' 'sha256-${await style}'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  } })
}

/** /app: the signed-in person's home. */
export const homeDocument = (viewer: Viewer) => appDocument(`Home · ${branding.name}`, <AppHome viewer={viewer} />)

/** Base's sign-in settings document (its markup, styles and headers kept) under the app's own bar: the views with
 *  Settings current, and the person (frames.css places the card under it). */
export async function settingsDocument(response: Response, viewer: Viewer): Promise<Response> {
  const bar = renderToStaticMarkup(<AppBar viewer={viewer} tabs={homeTabs(viewer, settingsPath)} />)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response((await response.text()).replace('<body>', `<body class="barred">${bar}`), { status: response.status, statusText: response.statusText, headers })
}
