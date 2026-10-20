// 07 · Status (page-07): High Desert's 128 updates of the week (61 comments, 29 photos, 31 field changes, 7 approvals, as
// 128 dots in an 8 × 16 column) funnelled into Friday's status page, every line beside the numbered pegs it cites.
import { NB, dots, flap, head, rangeBreak, t } from '../parts'

const kinds: [number, string][] = [[61, '#8CC8F5'], [29, '#F86698'], [31, '#087BF7'], [7, '#141414']]
const S = 20, R = 7
let n = 0
const dotSvg = `<svg class="st-dots" viewBox="0 0 ${7 * S + 2 * R} ${15 * S + 2 * R}" width="${7 * S + 2 * R}" height="${15 * S + 2 * R}" role="img" aria-label="128 updates: 61 comments, 29 photos, 31 field changes, 7 approvals">`
  + kinds.map(([count, fill]) => Array.from({ length: count }, () => { const i = n++; return `<circle cx="${R + (i % 8) * S}" cy="${R + Math.floor(i / 8) * S}" r="${R}" fill="${fill}"/>` }).join('')).join('') + '</svg>'
const cites = (nums: number[]) => `<span class="pg" aria-hidden="true">${nums.map(k => `<i>${k}</i>`).join('')}</span>`
const ln = (nums: number[], text: string, cite: string) => `<li class="ln">${cites(nums)}<span>${t(text)}${NB}<span class="cite">[${t(cite)}]</span></span></li>`

export const statusSection = (): string => `<section class="sec" id="status"><div class="wrap">
  ${head(['Status', 'Operations', 'High Desert Fulfillment', 'Reno', 'Fri Oct 23, PT'], '128 updates in.', 'One status out, citing 12.', t('The racking crew posted from the floor all week. The agent wrote Friday\'s status from that work, every line tied to its task. Darnell changed one line and sent it.'))}
  <div class="drawing st-grid">
    <ul class="st-legend">
      <li><i style="background:#8CC8F5"></i><span><b>${t('Comments 61')}</b> <span class="g">${t('(from phones 44)')}</span></span></li>
      <li><i style="background:var(--pink)"></i><b>${t('Photos 29')}</b></li>
      <li><i style="background:var(--azure)"></i><b>${t('Field changes 31')}</b></li>
      <li><i style="background:var(--ink)"></i><b>${t('Approvals 7')}</b></li>
      <li class="tot">${t('= 128 updates')}<br>${rangeBreak(t('Mon Oct 19 – Fri Oct 23'))}</li>
    </ul>
    ${dotSvg}<span class="st-funnel" aria-hidden="true"></span>
    <div class="st-pagewrap"><div class="st-tile">${flap('ON TRACK', 'landed')}<span class="clip" aria-hidden="true"><i></i></span></div>
    <article class="card st-page">
      <h3>${dots(['Reno Building 2', 'racking', 'status Fri Oct 23'].map(t))}</h3><p class="hl">Health: on track</p>
      <p class="sec-l">Highlights</p><ul>${ln([1, 2, 3, 4], 'Aisles 1–4 up · 960 of 1,440 pallet positions'.replace(' · ', `${NB}·${NB}`), '1–4')}${ln([5], 'Engineering stamp and permit on file', '5')}${ln([6], 'Sprinkler clearance check passed Thu Oct 22', '6')}</ul>
      <p class="sec-l">Watch</p><ul>${ln([7], 'Aisle 5–6 uprights deliver Mon Oct 26', '7')}${ln([8, 9], 'Install Mon–Tue', '8, 9')}</ul>
      <p class="sec-l">Next</p><ul>${ln([10], 'Fire marshal inspection Thu Oct 29, 10:00 am', '10')}${ln([11], 'Load signs posted', '11')}${ln([12], 'First client pallets Fri Oct 30', '12')}</ul>
      <p class="ft">${dots(['Drafted 2:40 pm from 128 updates', 'edited by Darnell Pruitt', 'published 3:05 pm'].map(t))}</p>
    </article></div>
  </div>
  <p class="st-sent">${dots(['Sent to 14', 'leadership 5', 'client success 4', 'finance 2', 'safety 2', 'facilities 1', 'Slack #reno-b2 and email ✓'].map(t))}</p>
</div></section>`
