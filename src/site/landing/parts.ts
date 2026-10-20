// The page's shared furniture: type glue, "·" phrase lines, the section head, split-flap tiles, ticks, pegs and glyphs.
import { escape } from '../../base/run-site'

export const NB = ' '
const WJ = '⁠' // word joiner: a range's en dash never starts or ends a line
const NBH = '‑' // non-breaking hyphen
// Every person on the page: a name never splits across lines (BUILD-NOTES, line breaks).
const people = ['Joelle Marsh', 'Gwen Abernathy', 'Felix Yoon', 'Pia Sandoval', 'Rashad Odom', 'Wes Holloway', 'Raj Patel', 'Eli Ramos',
  'Noriko Tanabe', 'Lucy Chen', 'Nora Lind', 'Silas Kerr', 'Carmen Diaz', 'Ben Ortiz', 'Margaux Healy', 'Anand Mistry', 'Sloane Pryor',
  'Imani Ford', 'Malik Brennan', 'Dan Kowalski', 'Lisa Tran', 'Ivy Nakamura', 'Claire Whitman', 'Darnell Pruitt', 'Danielle Price',
  'Monica Hale', 'Derek Shaw', 'Walt Hennessy', 'Phil Garza', 'Shanice Moore', 'Nick Duarte', 'Tamsin Wu', 'Aaron Fox', 'Victor Lam',
  'Elena Marchetti', 'Alana Reyes', 'Idris Bello', 'Jasmine Reed', 'Luis Medina', 'Keisha Monroe', 'Cody Brannigan', 'Caleb Hunt',
  'Leni Strand', 'Grace Tully', 'Kevin Liu', 'Terrell Hayes', 'Kettle &amp; Crumb', 'Cedar Valley', 'High Desert', 'Hawkeye Sign Co.']
const nameRe = new RegExp(people.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')

// Keep a name, a date, a date range, a time, a figure with its unit or noun and a check with its words on one line.
export const RANGE = `${NB}–${WJ}${NB}` // a glued date range's dash; rangeBreak() lets one narrow line break after it
export const rangeBreak = (html: string): string => html.replace(RANGE, `${NB}–${WJ} `)
export function glue(html: string): string {
  return html
    .replace(nameRe, name => name.replace(/ /g, NB))
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Sep|Oct|Nov|Dec|Feb) (\d+)(, 2027)?/g, (_m, d, m, n, y) => `${d}${NB}${m}${NB}${n}${y ? `,${NB}2027` : ''}`)
    .replace(/\b(Sep|Oct|Nov|Feb) (\d+)/g, `$1${NB}$2`)
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d+:\d\d)/g, `$1${NB}$2`)
    .replace(/(\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[ \u00a0](?:Sep|Oct|Nov|Dec)[ \u00a0]\d+), (\d+:\d\d)/g, `$1,${NB}$2`)
    .replace(/\((was|from) (?=(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[ \u00a0])/g, `($1${NB}`)
    .replace(/(\d) (am|pm|h|of)\b/g, `$1${NB}$2`)
    .replace(/\b(of|to|v|in|by) (\d)/g, `$1${NB}$2`)
    .replace(/(\d[\d,.]*%?) (?=[\p{L}#])/gu, `$1${NB}`)
    .replace(/(\p{L}) (\d[\d,.]*)\b(?![\d:])/gu, `$1${NB}$2`)
    .replace(/(\d) ([=+×]) (\d)/g, `$1${NB}$2${NB}$3`)
    .replace(/ · /g, `${NB}·${NB}`)
    .replace(/ (=) /g, `${NB}$1 `)
    .replace(/(\d|am|pm) – (?=(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Sep|Oct|Nov|Dec|Feb|\d))/g, `$1${RANGE}`)
    .replace(/ (–) /g, `${NB}$1${WJ} `)
    .replace(/ (→) /g, `${NB}$1 `)
    .replace(/([\p{L}\d])–([\p{L}\d])/gu, `$1${WJ}–${WJ}$2`)
    .replace(/([\p{L}\d])-([\p{L}\d])/gu, `$1${NBH}$2`)
    .replace(/ ✓/g, `${NB}<span class="ok">✓</span>`)
}
export const t = (text: string): string => glue(escape(text))

// A line of phrases joined by "·": the separator never starts or ends a wrapped line. Phrases wrap whole with the
// separator in the line's clipped margin; a phrase longer than the line starts its own line and wraps inside itself.
export const dots = (phrases: string[], cls = ''): string => `<span class="dl${cls ? ' ' + cls : ''}">${phrases.map(p => `<span>${p}</span>`).join('')}</span>`
// t() with its " · " separators set as such a line.
export const line = (text: string, cls = ''): string => text.includes(' · ') ? dots(text.split(' · ').map(t), cls) : (cls ? `<span class="${cls}">${t(text)}</span>` : t(text))

// A title never ends on one word alone: its last two words stay together when they are short.
export const lastPair = (html: string): string => html.replace(/ ([^ ]+) ([^ ]+)$/, (m, a: string, b: string) => !b.includes(NB) && a.length + b.length < 22 ? ` ${a}${NB}${b}` : m)
// A heading comma keeps its own advance at the display tracking (the plates' `h1 .cm`).
const commas = (html: string) => html.replace(/,/g, '<span class="comma">,</span>')
export const title = (text: string): string => lastPair(t(text))

// A heading line keeps its last two words together only when it has four or more, so a three-word line breaks where the
// words do on phones ("Every team's / October.") instead of stranding its first word.
const headLine = (text: string): string => text.split(' ').length >= 4 ? lastPair(t(text)) : t(text)
// A block label on an hours track: three or more words keep their last two together when the label takes two lines.
export const blockLabel = (text: string): string => text.split(' ').length >= 3 ? lastPair(t(text)) : t(text)
export const eyebrow = (parts: string[]): string => `<p class="eyebrow">${dots(parts.map(t))}</p>`
export const heading = (first: string, second: string, tag = 'h2', firstHtml?: string): string =>
  `<${tag} class="display"><span>${firstHtml ?? commas(headLine(first))}</span> <span>${commas(headLine(second))}</span></${tag}>`
export const head = (eyebrowParts: string[], first: string, second: string, body: string, cls = '', firstHtml?: string): string =>
  `<header class="sec-head${cls ? ' ' + cls : ''}">${eyebrow(eyebrowParts)}${heading(first, second, 'h2', firstHtml)}<p class="lede">${body}</p></header>`

// Split-flap tiles: one tile per letter, a hairline across the middle, as on the hero's board.
export const flap = (text: string, kind: 'landed' | 'moved' | 'track' = 'landed', cls = ''): string =>
  `<span class="flap ${kind}${cls ? ' ' + cls : ''}" role="img" aria-label="${escape(text)}">${[...text].map(ch => ch === ' ' ? '<i class="sp"></i>' : `<i aria-hidden="true">${escape(ch)}</i>`).join('')}</span>`

export const peg = (cls = '', id = ''): string => `<span class="peg${cls ? ' ' + cls : ''}"${id ? ` data-peg="${id}"` : ''} aria-hidden="true"></span>`
export const avatar = (initials: string, cls = ''): string => `<span class="av${cls ? ' ' + cls : ''}" aria-hidden="true">${initials}</span>`

// The six teams' glyphs (team-glyphs.png, cut once): WebP and AVIF at 2x and 3x of a 52 px glyph.
export type Team = 'marketing' | 'events' | 'operations' | 'agency' | 'people' | 'product'
const glyphWidth: Record<Team, number> = { marketing: 118, events: 133, operations: 100, agency: 78, people: 66, product: 118 }
const glyphAlt: Record<Team, string> = { marketing: 'Pink billboard', events: 'Blue stage with a microphone', operations: 'Wire rack with blue crates', agency: 'Clipboard card', people: 'Lanyard badge', product: 'Pink speaker' }
export const glyph = (team: Team, height = 52, cls = 'glyph'): string => {
  const w = Math.round(glyphWidth[team] * height / 104)
  const set = (ext: string) => `/landing/glyphs/${team}-104.${ext} 2x, /landing/glyphs/${team}-156.${ext} 3x`
  return `<picture class="${cls}"><source type="image/avif" srcset="${set('avif')}"><img src="/landing/glyphs/${team}-104.webp" srcset="${set('webp')}" width="${w}" height="${height}" alt="${glyphAlt[team]}" loading="lazy" decoding="async"></picture>`
}
