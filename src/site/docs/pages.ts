import { escape } from '../../base/run-site'
import { siteDocument, siteHeader } from '../frame'
import run from '../run.json'
import { groups, readDocs, type Doc } from './sources'
import { docsText, renderDoc, validateDocLinks, type Body } from './render'

const head = '<link rel="preload" href="/fonts/inter/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/landing/base.css"><link rel="stylesheet" href="/docs.css">'
const script = '<script src="/docs.js" defer></script>'
const label = docsText
const source = (doc: Doc) => `${run.repository}/blob/main/${doc.file}`

function navigation(docs: Doc[], current?: Doc): string {
  return `<a class="docs-nav-home" href="/docs"${current ? '' : ' aria-current="page"'}>Documentation</a>${groups.map(group => {
    const links = docs.filter(doc => doc.group === group).map(doc => `<a href="${doc.path}"${doc === current ? ' aria-current="page"' : ''}>${label(doc.title)}</a>`).join('')
    return group === 'Technical reference' ? `<details${current?.group === group ? ' open' : ''}><summary>${escape(group)}</summary>${links}</details>` : `<div class="docs-nav-group"><p>${escape(group)}</p>${links}</div>`
  }).join('')}`
}

function frame(title: string, description: string, content: string): string {
  return siteDocument(title, description, head, `<div class="docs-header">${siteHeader()}</div>${content}`, script)
}

function index(docs: Doc[]): string {
  return frame('Docs · Pegboard', 'Run Pegboard, understand its foundation and follow the product contract.', `<main id="main" class="docs-index">
    <section class="docs-intro"><p class="eyebrow">Pegboard documentation</p><h1>${label('The working manual.')}</h1><p>${label('Start your own installation, keep it running and follow what’s being built.')}</p><a class="btn-run" href="/docs/getting-started">Get started <span aria-hidden="true">↗</span></a></section>
    <div class="docs-index-body"><aside class="docs-note"><span class="peg" aria-hidden="true"></span><h2>${label('From the source.')}</h2><p>${label('These pages come directly from Pegboard’s repository Markdown. Commands, setup details and feature status stay with the code.')}</p><a href="/contract">See the contract and clause status ↗</a></aside><div class="docs-groups">${groups.map((group, i) => `<section><div class="docs-group-heading"><span aria-hidden="true">0${i + 1}</span><h2>${label(group)}</h2></div><div class="docs-grid">${docs.filter(doc => doc.group === group).map(doc => `<a class="docs-card" href="${doc.path}"><h3>${label(doc.title)}</h3><p>${label(doc.summary)}</p><span class="docs-card-go">Read the guide <span aria-hidden="true">↗</span></span></a>`).join('')}</div></section>`).join('')}</div></div></main>`)
}

function article(doc: Doc, body: Body, docs: Doc[]): string {
  const nav = navigation(docs, doc), position = docs.indexOf(doc)
  const neighbours = [docs[position - 1], docs[position + 1]].map((page, i) => page ? `<a href="${page.path}"><span>${i ? 'Next' : 'Previous'}</span><strong>${label(page.title)}</strong></a>` : '<span></span>').join('')
  return frame(`${doc.title} · Pegboard docs`, doc.summary, `<main id="main" class="docs-layout">
    <aside class="docs-sidebar"><nav aria-label="Documentation">${nav}</nav></aside>
    <div class="docs-reading"><details class="docs-mobile-nav"><summary>All docs <span aria-hidden="true">+</span></summary><nav aria-label="Documentation menu">${nav}</nav></details>
    <article><header class="docs-title"><a href="/docs">Documentation</a><h1>${label(doc.title)}</h1><p>${label(doc.summary)}</p><a class="docs-source" href="${source(doc)}">Read the Markdown source ↗</a></header>
    ${body.contents.length ? `<details class="docs-mobile-contents"><summary>On this page</summary><nav aria-label="Page contents">${body.contents.map(item => `<a href="#${escape(item.id)}">${label(item.text)}</a>`).join('')}</nav></details>` : ''}
    <div class="docs-prose">${body.html}</div><nav class="docs-neighbours" aria-label="More documentation">${neighbours}</nav></article></div>
    <aside class="docs-contents">${body.contents.length ? `<nav aria-label="On this page"><p>On this page</p>${body.contents.map(item => `<a href="#${escape(item.id)}">${label(item.text)}</a>`).join('')}</nav>` : ''}<a class="docs-source" href="${source(doc)}">Edit this page on GitHub ↗</a></aside>
  </main>`)
}

export function docsSitePages(): { path: string; html: string }[] {
  const docs = readDocs(process.cwd())
  const bodies = new Map(docs.map(doc => [doc.path, renderDoc(doc, docs)]))
  validateDocLinks(docs, bodies)
  return [{ path: '/docs', html: index(docs) }, ...docs.map(doc => ({ path: doc.path, html: article(doc, bodies.get(doc.path)!, docs) }))]
}
