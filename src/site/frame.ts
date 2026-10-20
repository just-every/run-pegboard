// The homepage's document, header and set-type footer. /run, /contract and the not-found page keep Base's own frame
// (src/base/run-site.ts) with the same mark at /brand/mark.svg.
import { escape } from '../base/run-site'
import { iconHead } from '../base/icon-head'
import run from './run.json'

// The repository's README is the docs until the run site carries /docs (run.json "docs": false).
export const docsHref = `${run.repository}#readme`
export const demoHref = 'https://demo.run-pegboard.com/'
const links = `<a href="${docsHref}">Docs</a><a href="/contract">Contract</a><a href="${escape(run.repository)}">Source</a>`
const mark = (width: number) => `<img class="mark" src="/brand/mark.svg" alt="" width="${width}" height="${width}">`

export const siteHeader = (): string => `<header class="site-header"><a class="site-brand" href="/">${mark(56)}<span>Pegboard</span></a><nav aria-label="Site">${links}</nav></header>`
export const siteFooter = (): string => `<footer class="site-footer"><p class="foot-brand"><a class="site-brand" href="/">${mark(48)}<span>Pegboard</span></a><span class="foot-tag">Free, open source work management</span></p><nav aria-label="Footer">${links}</nav></footer>`

export function siteDocument(title: string, description: string, head: string, content: string, script = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}">`
    + `${iconHead}${head}</head><body><a class="skip" href="#main">Skip to content</a>${content}${siteFooter()}${script}</body></html>`
}
