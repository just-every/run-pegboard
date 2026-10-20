import { Marked } from 'marked'
import { posix } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { escape } from '../../base/run-site'
import run from '../run.json'
import type { Doc } from './sources'

export type Contents = { id: string; text: string }
export type Body = { html: string; contents: Contents[]; ids: Set<string>; links: string[] }

// Keep short units and the last two words together in prose, without touching command text.
export function docsText(text: string): string {
  return escape(text).replace(/\b(\d[\d.,]*) (px|CSS pixels|GB|GiB|MB|MiB|seconds?|minutes?|hours?|days?|pages?|or later)\b/g, '$1\u00a0$2')
    .replace(/\b\d{1,2} (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?: \d{4})?\b/g, value => value.replace(/ /g, '\u00a0'))
    .replace(/(\S+) (\S+)$/, (_, previous: string, last: string) => /\d/.test(last) ? `<span class="docs-keep">${previous} ${last}</span>` : `${previous}\u00a0${last}`)
    .replace(/\b[A-Z]{2,}-(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]+\b/g, value => `<span class="docs-keep">${value}</span>`)
}

export function renderDoc(doc: Doc, docs: Doc[]): Body {
  const contents: Contents[] = [], ids = new Set<string>(), links: string[] = []
  const resolveLink = (href: string) => {
    if (/^(?:https?:|mailto:)/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href
    const [file, hash] = href.split('#')
    const target = posix.normalize(posix.join(posix.dirname(doc.file), decodeURIComponent(file)))
    const page = docs.find(candidate => candidate.file === target)
    const fragment = hash ? `#${hash}` : ''
    if (page) return `${page.path}${fragment}`
    if (existsSync(target)) return `${run.repository}/${statSync(target).isDirectory() ? 'tree' : 'blob'}/main/${target}${fragment}`
    // Copied module manuals also reference Base files the seed does not ship.
    // Resolve those against their recorded custody origin, rather than the seed.
    if (doc.origin) {
      const originTarget = posix.normalize(posix.join(posix.dirname(doc.origin.path), decodeURIComponent(file)))
      return `${doc.origin.repository}/blob/${doc.origin.revision}/${originTarget}${fragment}`
    }
    throw new Error(`${doc.file} links to missing repository file ${target}`)
  }
  const marked = new Marked({ gfm: true, renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens, this.parser.textRenderer)
      const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-')
      let id = base, suffix = 0
      while (ids.has(id)) id = `${base}-${++suffix}`
      ids.add(id)
      // The source title is represented by the article's own H1; retain its anchor.
      if (depth === 1) return `<div id="${escape(id)}"></div>`
      if (depth === 2) contents.push({ id, text })
      return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    text(token) { return 'tokens' in token && token.tokens ? this.parser.parseInline(token.tokens) : docsText(token.text) },
    code({ text, lang }) {
      const language = (lang ?? 'text').split(/\s/)[0]
      const label = ['sh', 'bash', 'shell'].includes(language) ? 'Shell' : language.toUpperCase()
      const code = text.split(/([|;&]+ [^\s]+)/g).map((part, i) => i % 2 ? `<span class="docs-keep">${escape(part)}</span>` : escape(part)).join('')
      return `<div class="docs-code"><div class="docs-code-head"><span>${escape(label)}</span><button type="button" data-copy="${escape(text)}">Copy</button></div><pre><code>${code}</code></pre></div>\n`
    },
    html({ text }) { return escape(text) },
    link({ href, title, tokens }) {
      const target = resolveLink(href)
      links.push(target)
      return `<a href="${escape(target)}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`
    },
    image({ href, text }) { return `<a href="${escape(resolveLink(href))}">${escape(text || href)}</a>` },
    table(token) {
      const header = token.header.map(cell => `<th scope="col">${this.parser.parseInline(cell.tokens)}</th>`).join('')
      const rows = token.rows.map(row => `<tr>${row.map(cell => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`).join('')
      return `<div class="docs-table"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`
    },
  } })
  return { html: marked.parse(doc.markdown, { async: false }), contents, ids, links }
}

export function validateDocLinks(docs: Doc[], bodies: Map<string, Body>): void {
  const problems: string[] = []
  for (const doc of docs) for (const href of bodies.get(doc.path)!.links) {
    if (!href.startsWith('#') && !href.startsWith('/docs')) continue
    const [path, anchor] = href.startsWith('#') ? [doc.path, href.slice(1)] : href.split('#')
    if (path === '/docs' && !anchor) continue
    const target = bodies.get(path)
    if (!target || (anchor && !target.ids.has(decodeURIComponent(anchor)))) problems.push(`${doc.file}: ${href}`)
  }
  if (problems.length) throw new Error(`Broken docs links:\n${problems.join('\n')}`)
}
