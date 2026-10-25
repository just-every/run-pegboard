// The run site `rer build --site` writes: the approved homepage (src/site/landing.ts), /run, /contract when the seed
// has a CONTRACT.md, the not-found page and the public files they use. Every Run page string and command is in
// run.json; nothing here reads installation data.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { landingHtml } from './landing'
import { docsSitePages } from './docs/pages'
import run from './run.json'

export function sitePages({ contract }: Partial<SiteContext> = {}): SiteBuild {
  const data: RunData = run
  return {
    pages: [
      { path: '/', html: landingHtml() },
      { path: '/run', html: runPageHtml(identity, data, contract) },
      ...docsSitePages(),
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, data, contract) }] : []),
      { path: '/404', html: siteNotFoundHtml(identity, data, contract) },
    ],
    assets: [
      'rer-theme.css', 'fonts', 'brand',
      'look/tokens.css', 'look/parts.css', 'look/cords.js',
      'look/lobby.css', 'look/controls.css', 'look/frames.css',
      'landing', 'favicon.ico', 'docs.css', 'docs.js',
    ],
  }
}
