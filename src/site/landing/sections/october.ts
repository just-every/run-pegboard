// 02 · Every team's October (page-02): six lanes, each a tomato cord hanging down one weekday axis, Mon Oct 5 – Fri Oct 30
// at 28 px per weekday (Columbus Day hollow); each cord ends in its LANDED / MOVED MON tile and a "Week of Oct 26" card.
// Under 1180 px each lane becomes a card with its dated pegs as a list (BUILD-NOTES, phone plan for 02).
import { dots, eyebrow, flap, glyph, heading, line, t, title, type Team } from '../parts'

const Y0 = 150, STEP = 28 // lane-relative y of weekday 0 (Mon Oct 5); weekday 19 is Fri Oct 30
type Peg = [number | [number, number], string, string, boolean?]
const lanes: [Team, string, string[], Peg[], 'landed' | 'moved', string, string?][] = [
  ['marketing', 'Marketing', ['Kettle & Crumb', 'Kansas City, MO'], [[0, 'Plan approved', 'Mon Oct 5'], [11, '23 requests triaged', 'Tue Oct 20'], [16, 'I-35 billboard up', 'Tue Oct 27'], [18, 'Kits in 22 cafés', 'Thu Oct 29']], 'landed', '96 due · 96 done ✓'],
  ['events', 'Events', ['Switchback', 'Denver, CO'], [[11, 'Floor plan in', 'Tue Oct 20'], [14, 'Run of show final', 'Fri Oct 23'], [[17, 18], 'Summit in Austin', 'Wed Oct 28 – Thu Oct 29']], 'landed', '88 due · 88 done ✓'],
  ['operations', 'Operations', ['High Desert Fulfillment', 'Reno, NV'], [[4, 'Permit', 'Fri Oct 9'], [14, 'Aisles 1–4 up', 'Fri Oct 23'], [16, 'Aisles 5–6 up', 'Tue Oct 27'], [18, 'Inspection passed', 'Thu Oct 29']], 'landed', '74 due · 74 done ✓'],
  ['agency', 'Agency', ['Oxbow Creative → Cedar Valley CU', 'Des Moines, IA'], [[4, 'Proof v1', 'Fri Oct 9'], [11, 'v3 approved', 'Tue Oct 20'], [17, 'Lobby sign installed', 'Wed Oct 28']], 'landed', '62 due · 62 done ✓'],
  ['people', 'People', ['Bellwood Insurance', 'Charlotte, NC'], [[6, 'Class planned', 'Tue Oct 13'], [10, '11 laptops ordered', 'Mon Oct 19'], [15, '11 buddies', 'Mon Oct 26'], [17, '33 of 33', 'Wed Oct 28']], 'landed', '41 due · 41 done ✓'],
  ['product', 'Product', ['Wildwood Audio', 'Portland, OR'], [[0, 'Plan approved', 'Mon Oct 5'], [9, 'Positioning locked', 'Fri Oct 16'], [17, 'Samples in', 'Wed Oct 28'], [19, '3 tasks to Mon Nov 2', 'Fri Oct 30', true]], 'moved', '51 due · 48 done', '3 moved'],
]
const y = (i: number) => Y0 + i * STEP
const at = (p: Peg) => Array.isArray(p[0]) ? (p[0][0] + p[0][1]) / 2 : p[0]

// The cord through a lane's pegs (x = 26 px in the lane), each span bowing 7 px like a hanging string, then a black drop to the tile.
function cord(pegs: Peg[]): string {
  const ys: [number, boolean][] = []
  for (const p of pegs) if (Array.isArray(p[0])) { ys.push([y(p[0][0]), false], [y(p[0][1]), false]) } else ys.push([y(p[0]), !!p[3]])
  let d = `M26 ${ys[0][0]}`
  for (let j = 1; j < ys.length; j++) { const a = ys[j - 1][0], b = ys[j][0]; d += ` C33 ${a + (b - a) * .35} 33 ${a + (b - a) * .65} 26 ${b}` }
  const last = ys[ys.length - 1][0], tile = y(19) + 34
  return `<svg class="oc-cord" viewBox="0 0 52 ${tile}" width="52" height="${tile}" aria-hidden="true"><path d="${d}" fill="none" stroke="#F94436" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M26 ${last}V${tile}" stroke="#141414" stroke-width="1.6"/>${ys.map(([py, mv]) => mv ? `<circle cx="26" cy="${py}" r="5.5" fill="#fff" stroke="#F94436" stroke-width="2"/>` : `<circle cx="26" cy="${py}" r="6" fill="#141414"/>`).join('')}</svg>`
}
const axis = [[0, 'Mon Oct 5'], [5, 'Mon Oct 12'], [10, 'Mon Oct 19'], [15, 'Mon Oct 26'], [19, 'Fri Oct 30']] as const
const axisSvg = `<svg class="oc-axis-line" viewBox="0 0 12 ${y(19) + 8}" width="12" height="${y(19) + 8}" aria-hidden="true"><path d="M6 ${y(0)}V${y(19)}" stroke="#C7D0DA" stroke-width="2"/>`
  + Array.from({ length: 20 }, (_, i) => i === 5 ? `<circle cx="6" cy="${y(i)}" r="4.5" fill="#fff" stroke="#8A929B" stroke-width="2"/>` : [0, 10, 15, 19].includes(i) ? `<circle cx="6" cy="${y(i)}" r="5" fill="#141414"/>` : `<path d="M2 ${y(i)}h8" stroke="#AAB4BF" stroke-width="1.6"/>`).join('') + '</svg>'

export const octoberSection = (): string => `<section class="sec" id="october"><div class="wrap">
  <header class="sec-head">${eyebrow(['October 2026', 'Six teams, six businesses', 'Mon Oct 5 – Fri Oct 30'])}${heading('Every team’s October.', '409 done, 3 moved to Monday.')}</header>
  <div class="oc-top"><p class="lede">${t('A holiday campaign, a customer summit, warehouse racking, a client\'s new sign, a hiring class and a product launch: six businesses, six Pegboards.')}</p>
  <div class="card oc-sum"><p class="b">${title('Week of Mon Oct 26')}</p><p>${line('6 teams · 412 tasks due')}</p><p>${dots([t('409 done ✓'), `<span class="mv b">${t('3 moved to Mon Nov 2')}</span>`])}</p></div></div>
  <div class="drawing oc-board">
    <div class="oc-axis" aria-hidden="true">${axis.map(([i, d]) => `<span style="top:${y(i) - 9}px">${t(d)}${i === 5 ? '<small>Columbus Day</small>' : ''}</span>`).join('')}${axisSvg}</div>
    <ol class="oc-lanes">${lanes.map(([g, team, biz, pegs, kind, count, moved], k) => `<li class="oc-lane${k % 2 ? '' : ' alt'}">
      <div class="oc-lh">${glyph(g, 50)}<h3>${t(team)}</h3><p>${biz.map(t).join('<br>')}</p></div>
      ${cord(pegs)}<ul class="oc-pegs">${pegs.map(p => `<li class="${p[3] ? 'moved' : ''}" style="--y:${y(at(p))}px"><span class="oc-l">${title(p[1])}</span><span class="oc-d">${t(p[2])}</span></li>`).join('')}</ul>
      <div class="oc-end">${flap(kind === 'landed' ? 'LANDED' : 'MOVED MON', kind, 'sm')}<div class="card oc-cnt"><p class="oc-wk">${t('Week of Oct 26')}</p><p>${t(count)}</p>${moved ? `<p class="mv">${t(moved)}</p>` : ''}</div></div>
    </li>`).join('')}</ol>
  </div></div></section>`
