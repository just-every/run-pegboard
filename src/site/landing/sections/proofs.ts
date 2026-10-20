// 06 · Proofing (page-06): v2 and v3 of Cedar Valley Credit Union's lobby sign side by side, four pins on the same spots
// (pink on v2, green and resolved on v3), the version rail, the guests' comments and approvals, files to the sign shop.
import { NB, dots, head, t } from '../parts'

// the leaf mark: v2 at 90 % and an off-green, v3 full size in PMS 3435 (STRUCTURE.md records)
const leaf = (scale: number, c1: string, c2: string) => `<svg class="leaf" viewBox="0 0 170 170" style="--s:${scale}" aria-hidden="true"><path d="M78 150C30 140 6 100 14 46c44 6 72 44 64 104z" fill="${c2}"/><path d="M90 152c-6-60 20-114 72-132 8 64-22 120-72 132z" fill="${c1}"/></svg>`
// pins 1 (logo size) and 4 (green) sit on the leaf, 3 after the hours, 2 after the insurance line, on both versions
const pin = (n: number, done: boolean, cls = '') => `<span class="pin ${done ? 'r' : 'p'}${cls ? ' ' + cls : ''}" aria-hidden="true">${done ? '✓' : n}</span>`
const cursor = (name: string) => `<span class="pf-cur" aria-hidden="true"><svg viewBox="0 0 20 24"><path d="M2 2l16 12-8 1-4 7z" fill="#087BF7"/></svg><span class="pl"><b>${name}</b>${NB}·${NB}Cedar Valley CU</span></span>`
const proof = (v: string, scale: number, c1: string, c2: string, sat: string, ins: string, done: boolean, who: string) => `<figure class="card proof ${done ? 'v3' : 'v2'}">
  <span class="vtag">${v}</span>${cursor(who)}
  <div class="sign" role="img" aria-label="${v} of the lobby sign: Cedar Valley Credit Union, Mon–Fri 9–5, ${sat}, ${ins}">
    <div class="lf">${leaf(scale, c1, c2)}${pin(1, done, 'p1')}${pin(4, done, 'p4')}</div>
    <div class="tx" aria-hidden="true"><p class="nm">Cedar Valley<br>Credit Union</p><p class="hrs"><span>${t(`Mon–Fri 9–5 · ${sat}`).replace(' · ', `${NB}·${NB}`)}</span>${pin(3, done)}</p><p class="insl"><span class="ins">${ins}</span>${pin(2, done)}</p></div>
  </div></figure>`
const comments: [string, string, string][] = [
  ['Dan Kowalski', 'Fri Oct 16, 10:20 am', 'Logo 10% larger.'],
  ['Lisa Tran', 'Fri Oct 16, 2:05 pm', 'Use the exact wording: Federally insured by NCUA.'],
  ['Dan Kowalski', 'Fri Oct 16, 2:30 pm', 'Saturday is 9 to noon now.'],
  ['Dan Kowalski', 'Fri Oct 16, 2:34 pm', 'Match our green, PMS 3435.'],
]

export const proofsSection = (): string => `<section class="sec pale" id="proofs"><div class="wrap">
  ${head(['Proofing', 'Agency', 'Oxbow Creative → Cedar Valley Credit Union', 'Fri Oct 9 – Tue Oct 20, CT'], 'Three rounds of proofs.', 'Client sign-off on v3.', t('Cedar Valley\'s marketing VP and compliance lead joined free, as guests. They pinned comments right on the lobby sign, and both approved v3 by Tuesday afternoon.'), 'center')}
  <div class="drawing pf-grid">
    ${proof('v2', .9, '#7FC96A', '#B7E09A', 'Sat 9–1', 'Insured by NCUA', false, 'Dan')}
    <ol class="pf-rail" aria-label="Versions"><li><b>v1</b><span>${t('Fri Oct 9')}</span></li><li><b>v2</b><span>${t('Thu Oct 15')}</span></li><li class="now"><b>v3</b><span>${t('Mon Oct 19')}</span></li></ol>
    ${proof('v3', 1, '#154734', '#3C7A5A', 'Sat 9–noon', 'Federally insured by NCUA', true, 'Lisa')}
    <ol class="pf-cms">${comments.map(([who, when, what], i) => `<li class="card cm"><span class="pin p" aria-label="Pin ${i + 1}">${i + 1}</span><p>${dots([`<b>${t(who)}</b>`, t(when), t(what)])}</p></li>`).join('')}</ol>
    <ul class="pf-ok">
      <li class="card rc"><p>${dots(['<b>v3</b>', t('Ivy Nakamura'), t('sent by Claire Whitman Mon Oct 19, 3:30 pm')])}</p><p>${t('4 of 4 comments resolved ✓')}</p></li>
      <li class="card rc"><p>${dots([`<b>${t('Lisa Tran, compliance')}</b>`, t('Tue Oct 20, 11:40 am ✓')])}</p></li>
      <li class="card rc"><p>${dots([`<b>${t('Dan Kowalski, marketing VP')}</b>`, t('from his phone'), t('Tue Oct 20, 4:12 pm ✓')])}</p></li>
    </ul>
  </div>
  <p class="strip pf-strip"><b>${t('Wed Oct 21')}${NB}·${NB}${t('files to Hawkeye Sign Co.')}${NB}→ ${t('Wed Oct 28')}${NB}·${NB}${t('installed in the Cedar Rapids main branch ✓')}</b></p>
  <p class="pf-ts">${dots(['Oxbow timesheets', 'week of Oct 19', '9 of 9', '342.5 h', 'approved by Claire Fri Oct 23', 'sent to Gauge ✓'].map(t))}</p>
</div></section>`
