// 05 · Workload (page-05): Switchback's hours board for the week of Mon Oct 19, every block sized to its hours against a
// 51-hour track (40 h at Friday's edge), Anand's three moves corded to Sloane and Imani, the move record and the Slack
// question that became a task. Phones: each person's row with the moved blocks and their hours (BUILD-NOTES).
import { NB, avatar, blockLabel, dots, head, line, peg, t } from '../parts'

const SPAN = 51
type Block = [string, number, ('in' | 'gh')?, string?]
const rows: [string, string, string, Block[], string?][] = [
  ['MH', 'Margaux Healy', '36 h', [['Run of show', 8], ['Vendor contracts', 6], ['Budget review', 4], ['Speaker calls', 6], ['Catering menu', 5], ['Sponsor calls', 7]]],
  ['AM', 'Anand Mistry', '51 h → <b class="ok">40 h ✓</b>', [['Venue walkthrough', 8], ['AV order', 6], ['Venue floor plan', 6], ['Room setups', 8], ['Signage proofs', 5], ['Shuttle schedule', 7], ['4 h', 4, 'gh', 'g1'], ['3 h', 3, 'gh', 'g2'], ['4 h', 4, 'gh', 'g3']],
    'Moved: room signs 4 h and travel sheet 3 h → Sloane · booth map 4 h → Imani'],
  ['SP', 'Sloane Pryor', '29 h → 36 h', [['Registration list', 8], ['Badge printing', 6], ['Attendee emails', 7], ['Hotel block', 8], ['Room signs', 4, 'in', 'n1'], ['Travel', 3, 'in', 'n2']], '+ room signs 4 h and travel sheet 3 h from Anand'],
  ['IF', 'Imani Ford', '33 h → 37 h', [['Sponsor packets', 8], ['Swag order', 5], ['Breakout rooms', 8], ['Survey draft', 6], ['Photographer', 6], ['Booth map', 4, 'in', 'n3']], '+ booth map 4 h from Anand'],
  ['MB', 'Malik Brennan', '37 h', [['Speaker slides', 8], ['Rehearsal plan', 6], ['Livestream test', 7], ['Stage design', 8], ['Mic list', 8]]],
]
const pct = (h: number) => `${(h / SPAN * 100).toFixed(3)}%`
// Every block carries its name (page-05): --s and --h place it on the hours track; workload.css sizes the label to fit.
const block = ([label, h, kind, id]: Block, start: number, i: number): string => {
  const cls = kind ?? (i % 2 ? 'bb' : 'ba')
  const pegs = kind === 'gh' ? peg('gp', id).replace('<span', '<span data-at="b"') : kind === 'in' ? peg('ip', id).replace('<span', '<span data-at="t"') : ''
  return `<span class="blk ${cls}" style="--s:${start};--h:${h}">${pegs}<span class="lb">${blockLabel(label)}</span></span>`
}
const track = (blocks: Block[]) => { let at = 0; return blocks.map((b, i) => { const h = block(b, at, i); at += b[1]; return h }).join('') }
const board = rows.map(([ini, name, hrs, blocks, moved]) => `<li class="wl-row"><p class="who">${avatar(ini, 'lg')}<span><b>${t(name)}</b><br><span class="hrs">${hrs.includes('<') ? hrs.replace(/ → /, `${NB}→ `) : t(hrs)}</span></span></p>`
  + `<div class="wl-track" role="img" aria-label="${blocks.filter(b => b[2] !== 'gh').map(b => `${b[0]} ${b[1]} h`).join(', ')}">${track(blocks)}</div>${moved ? `<p class="wl-moved">${line(moved)}</p>` : ''}</li>`).join('')
const days = ['Mon Oct 19', 'Tue Oct 20', 'Wed Oct 21', 'Thu Oct 22', 'Fri Oct 23']

export const workloadSection = (): string => `<section class="sec" id="workload"><div class="wrap">
  ${head(['Workload', 'Events', 'Switchback', 'Week of Mon Oct 19, MT'], 'Summit prep, evened out.', '11 hours to two teammates.', t('Nine days before the Austin summit, Anand\'s week ran to 51 hours. Margaux dragged three tasks to Sloane and Imani. A floor-plan question in Slack became a task and was answered Tuesday by 10:04.'))}
  <div class="drawing card wl-board" data-cords='[["g1","n1","drop",30],["g2","n2","drop",22],["g3","n3","drop",60]]'>
    <div class="wl-head" aria-hidden="true"><span></span><div class="wl-days">${days.map((d, i) => `<span style="left:${pct(i * 8)}">${t(d)}</span>`).join('')}</div></div>
    <div class="wl-cap" aria-hidden="true"><span class="zone" style="left:${pct(40)}"></span><span class="line" style="left:${pct(40)}"><b>40 h</b></span>${[1, 2, 3, 4].map(i => `<span class="sep" style="left:${pct(i * 8)}"></span>`).join('')}</div>
    <ol class="wl-rows">${board}</ol>
    <p class="wl-foot">${t('Team 186 of 200 h ✓')}</p>
  </div>
  <div class="wl-low" data-cords='[["sl","tk","sag",26]]'>
    <div class="card wl-mv"><p><b>${t('Mon Oct 19, 9:20 am · moved by Margaux Healy ✓').replace('am · moved', `am${NB}·${NB}moved`)}</b></p>
      <p>${t('Session room signs, 14 rooms · 4 h → Sloane Pryor').replace(' · 4', `${NB}·${NB}4`)}</p><p>${t('Speaker travel sheet · 3 h → Sloane Pryor').replace(' · 3', `${NB}·${NB}3`)}</p><p>${t('Sponsor booth map · 4 h → Imani Ford').replace(' · 4', `${NB}·${NB}4`)}</p>
      <p class="g">${dots(['Anand 51 → 40 h', 'Sloane 29 → 36 h', 'Imani 33 → 37 h', 'team still 186 h'].map(t))}</p></div>
    <div class="card wl-sl"><span class="peg-e r" data-peg="sl" data-at="r"></span><p class="g">${dots(['Tue Oct 20, 9:00 am', 'Margaux Healy in #summit-austin'].map(t))}</p><p class="q">${t('“Do we have the venue floor plan?”')}</p></div>
    <div class="card wl-tk"><span class="peg-e l" data-peg="tk" data-at="l"></span><p>${dots([`<b>${t('Venue floor plan')}</b>`, t('from Slack'), t('Anand Mistry'), t('due today')])}</p><p class="done">${t('10:04 am · floor plan uploaded, thread updated ✓').replace(' · ', `${NB}·${NB}`)}</p></div>
  </div>
</div></section>`
