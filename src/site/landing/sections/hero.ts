// 01 · Hero (approved hero E, page-s1/page-01.png): the Friday lobby, its split-flap board of six teams' projects and the
// five cards that fix the records the page follows. Every string is HTML; the plate is 12ui's clean redraw (no text).
import { escape } from '../../../base/run-site'
import { demoHref, docsHref, siteHeader } from '../../frame'
import { plate } from '../plates'
import { line, t, title } from '../parts'

const rows: [string, string, 'landed' | 'moved', string][] = [
  ['MARKETING', 'HOLIDAY CAMPAIGN', 'landed', 'LANDED'],
  ['EVENTS', 'AUSTIN SUMMIT', 'landed', 'LANDED'],
  ['OPERATIONS', 'RENO RACKING', 'landed', 'LANDED'],
  ['AGENCY', 'CEDAR VALLEY CU', 'landed', 'LANDED'],
  ['PEOPLE', '11 NEW HIRES', 'landed', 'LANDED'],
  ['PRODUCT', 'Q1 LAUNCH', 'moved', 'MOVED MON'],
]
// One board field: its letters on lit tiles, then lit blanks to the field's width, then unlit tiles to the column's.
const field = (text: string, lit: number, cols: number, kind = ''): string => {
  const chars = [...text]
  let h = ''
  for (let i = 0; i < cols; i++) {
    const ch = chars[i]
    h += i < lit ? (ch && ch !== ' ' ? `<i class="${kind}">${escape(ch)}</i>` : `<i class="${kind}"></i>`) : '<i class="off"></i>'
  }
  return `<span class="bf">${h}</span>`
}
const label = rows.map(([team, project, , status]) => `${team.toLowerCase()}, ${project.toLowerCase()}: ${status.toLowerCase()}`).join('; ')
// Desktop and tablet: the board as drawn (team 12, project 19, status 10 tiles), set over the plate's own board.
const board = `<div class="hx-board" role="img" aria-label="Arrivals board. ${escape(label)}.">`
  + `<div class="br hd" aria-hidden="true">${field('TEAM', 12, 12)}${field('PROJECT', 19, 19)}${field('STATUS', 10, 10)}</div>`
  + rows.map(([team, project, kind, status]) => `<div class="br" aria-hidden="true">${field(team, 10, 12)}<b class="bd"></b>${field(project, 16, 19)}${field(status, 10, 10, kind)}</div>`).join('')
  + '</div>'
// Phones: the same board in two tile rows per team (team and status, then the project), 13 px letters.
const phoneBoard = `<div class="hx-board-s" role="img" aria-label="Arrivals board. ${escape(label)}.">`
  + `<div class="br hd" aria-hidden="true">${field('TEAM', 10, 10)}${field('STATUS', 9, 9)}</div><div class="br hd p" aria-hidden="true">${field('PROJECT', 16, 16)}</div>`
  + rows.map(([team, project, kind, status]) => `<div class="br" aria-hidden="true">${field(team, 10, 10)}${field(status, 9, 9, kind)}</div><div class="br p" aria-hidden="true">${field(project, 16, 16)}</div>`).join('')
  + '</div>'

// The five cards (README "Cards"; cards 2 and 3 as page-01 sets them).
const cards: [string, string[]][] = [
  ['Week of Mon Oct 26', ['6 teams · 412 tasks due', '409 done, 3 moved ✓']],
  ['Tue Oct 20, 9 am–noon', ['Marketing 8 · Sales 5 · Product 4', 'People 3 · Ops 2 · Legal 1', '= 23 requests · triaged 12:10 pm ✓']],
  ['Week of Oct 19', ['Anand Mistry 51 h of 40 h', '→ 11 h to Sloane and Imani', '→ 40 h ✓']],
  ['Proof v3', ['4 comments resolved', 'approved Tue Oct 20 ✓']],
  ['Status Fri Oct 23', ['from 128 updates', 'cites 12 tasks', 'sent to 14 ✓']],
]
const cardList = `<ul class="hx-cards">${cards.map(([head, lines]) => `<li class="hx-card"><p class="hc-t">${title(head)}</p>${lines.map(l => `<p>${line(l)}</p>`).join('')}</li>`).join('')}</ul>`

const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11.5M10.5 4.8l5.2 5.2-5.2 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
export const runButton = (cls = ''): string => `<a class="btn-run${cls ? ' ' + cls : ''}" href="/run">Run Pegboard${arrow}</a>`
const copy = `<div class="hx-copy"><h1 class="hx-h">${t('Every project, from brief to done.').replace(/ (\S+)$/, ' $1')}</h1>`
  + `<p class="hx-sub">${t('Pegboard turns briefs and requests into plans that fit everyone\'s week, gets client sign-off on proofs, and writes the weekly status from real work.')}</p>`
  + '<p class="hx-alt">100% free, open source alternative to <b>Asana</b>, <b>monday.com</b> and <b>ClickUp</b></p>'
  + `<p class="hx-actions">${runButton()}<a class="hx-link" href="${demoHref}">Try the demo</a><a class="hx-link" href="${docsHref}">Read the docs</a></p></div>`

export const heroSection = (): string => `<section class="hero" aria-label="Pegboard">`
  + `<div class="hx">${siteHeader()}${copy}`
  + `<div class="hx-scene">${plate('hero', 'A sunny office lobby on a Friday: a black split-flap board over a long pink bench, three people walking past with coffee, two potted plants and floor-to-ceiling glass at the left.', '100vw', 'hx-plate', true)}${board}</div>`
  + `${cardList}<div class="hx-bs">${phoneBoard}</div><div class="hx-walk" aria-hidden="true">${plate('hero-left', '', '42vw', 'hx-wl')}${plate('hero-right', '', '58vw', 'hx-wr')}</div></div></section>`
