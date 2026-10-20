// 12 · Switching (page-12): Oxbow's Cedar Valley board on Mon Oct 5, the day after 18 projects came over from Asana, with
// six dependency cords between card pegs and three callouts; the Asana mapping in the widest card, the monday.com and
// ClickUp moves beside it, and "Also from…" with the one-line start on a row of its own (BUILD-NOTES, 12 foot row).
import run from '../../run.json'
import { dots, head, t } from '../parts'

type Card = [string, string, boolean?]
const cols: [string, string, Card[]][] = [
  ['Discovery', '', [['c1', 'Branch audit', true], ['c2', 'Brand guide v2', true], ['c9', 'Branch photos', true]]],
  ['Design', '', [['c3', 'Window graphics concepts'], ['c4', 'Lobby sign v1']]],
  ['Client review', 'Dan Kowalski · Lisa Tran · guests', []],
  ['Production', '', [['c5', 'Window graphics print'], ['c6', 'Sign fabrication'], ['c10', 'Window graphics v2']]],
  ['Install', '', [['c7', '5 branch windows'], ['c8', 'Main-branch lobby sign'], ['c11', 'Install crew booked']]],
]
const deps = [['c1', 'c3'], ['c2', 'c4'], ['c3', 'c5'], ['c4', 'c6'], ['c5', 'c7'], ['c6', 'c8']]
const cord = deps.map(([a, b]) => [`${a}r`, `${b}l`, 'sag', 26])
const tc = ([id, name, done]: Card, i: number) => `<li class="tc" style="--row:${i}"><span class="peg pl" data-peg="${id}l"></span><span class="peg pr" data-peg="${id}r"></span>${t(name + (done ? ' ✓' : ''))}</li>`
// data-clear: the cords that cross this callout dip below it (cords.js)
const callout = (text: string, cls: string, clear = false) => `<p class="co ${cls}"${clear ? ' data-clear' : ''}>${dots(text.split(' · ').map(t))}</p>`

export const switchingSection = (): string => `<section class="sec" id="switching"><div class="wrap">
  ${head(['Switching', 'Agency', 'Oxbow Creative', 'from Asana', 'Sun Oct 4, CT'], '18 live client projects.', 'Every dependency intact.', `${t('Claire moved 18 client projects out of Asana on a Sunday, with their guests, comments and history.')}<br>${t('On Monday the Cedar Valley board looked the way the team left it.')}`)}
  <div class="drawing card sw-board"><p class="bt">${dots([`<b>${t('Cedar Valley CU')}</b>`, `<b>${t('branch refresh')}</b>`, `<span class="g">${t('board on Mon Oct 5')}</span>`])}</p>
    <ol class="sw-cols" data-cords='${JSON.stringify(cord)}'>${cols.map(([name, guests, cards], k) => `<li class="col k${k}"><h3 class="ch">${t(name)}</h3>${guests ? `<p class="gs">${dots(guests.split(' · ').map(t))}</p>` : ''}
      <ul class="tcs">${cards.map(tc).join('')}</ul>
      ${k === 1 ? callout('Branch field · 6 branches ✓ · Billable checkbox ✓', 'card-co') : ''}${k === 2 ? `${callout('Guests kept · 214 comments and full history ✓', 'guests-co', true)}${callout('12 dependencies in this project · 386 across 18 ✓', 'cord-co')}` : ''}</li>`).join('')}</ol></div>
  <div class="sw-row">
    <p class="card">${dots([`<b>${t('From Asana')}</b>`, t('Sun Oct 4'), t('18 projects'), t('2,416 tasks'), t('386 dependencies'), t('3 fields mapped by Claire Whitman, 10:40 am: Hours → estimate, Billable → checkbox, Phase → status')])}</p>
    <p class="card">${dots([`<b>${t('Kettle & Crumb from monday.com')}</b>`, t('Sat Sep 26'), t('11 boards became projects'), t('1,904 items')])}</p>
    <p class="card">${dots([`<b>${t('High Desert from ClickUp')}</b>`, t('Sat Sep 19'), t('4 spaces'), t('3,120 tasks'), t('212 dependencies')])}</p>
  </div>
  <div class="card sw-term"><p class="b">${t('Also from Trello, Wrike, Smartsheet and CSV.')}</p><pre class="term"><code>${run.clone}</code>
<span class="ready">✓ Pegboard is ready</span></pre></div>
</div></section>`
