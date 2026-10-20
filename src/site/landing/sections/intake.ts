// 03 · Intake (page-03): Kettle & Crumb's 23 requests on Tue Oct 20, counted slip stacks in and out, the triage card for
// the catering request and the rule chip. Records: the flyer is "needed by Fri Nov 6" (BUILD-NOTES, 03 → 11), and both
// cords hang below their pegs (cords.js "sag"), as every cord on the page does.
import { NB, head, line, peg, t, title } from '../parts'

// each stack drawn with exactly its count of slips: one slip for 1
const stack = (name: string, n: number, id = ''): string => `<li class="stack" style="--n:${n}">`
  + Array.from({ length: n - 1 }, (_, i) => `<span class="slip" style="--i:${n - 1 - i}" aria-hidden="true"></span>`).join('')
  + `<div class="slip front">${peg('top', id)}<span class="k">${title(name)}</span><span class="n">${n}</span></div></li>`

const rows = [
  'Type: print + web · Project: Holiday campaign · Section: Catering',
  'Owner: Felix Yoon, design · 31 of 40 h this week',
  'Copy: Pia Sandoval',
  'Due Thu Oct 29',
  'Duplicate linked: Rashad Odom, Ops · email 9:47 am · ‘add holiday trays to the catering page’',
  'Draft attached: flyer copy, 64 words, for Pia',
]

export const intakeSection = (): string => `<section class="sec" id="intake"><div class="wrap">
  ${head(['Intake', 'Marketing', 'Kettle & Crumb', 'Tue Oct 20, 9 am – 12:10 pm CT'], 'Form, email and Slack.', 'One queue, sorted.', t('Six departments sent 23 requests before noon. The agent filled in each one, linked the duplicates and drafted a first pass. Joelle accepted the lot at 12:10.'), 'center')}
  <div class="drawing in-grid" data-cords='[["sales","tl","taut",8],["tr","hc","taut",8]]'>
    <div class="in-col in-in"><p class="caps">${line('In · 9 am – noon')}</p>
      <ul class="stacks">${stack('Marketing', 8)}${stack('Sales', 5, 'sales')}${stack('Product', 4)}${stack('People', 3)}${stack('Ops', 2)}${stack('Legal', 1)}</ul>
      <p class="in-sum">${line('Form 14 · email 5 · Slack 4 = 23')}</p></div>
    <article class="card in-tri">${peg('corner l', 'tl')}${peg('corner r', 'tr')}
      <p class="meta">${line('10:12 am · request form · Gwen Abernathy, Sales')}</p>
      <h3 class="ttl">${t('Holiday office-party catering: flyer and order page')}${NB}·${NB}${title('needed by Fri Nov 6')}</h3>
      ${rows.map(r => `<p class="row">${r.includes(' · ') ? line(r) : title(r)}</p>`).join('')}
      <p class="row g">${line('Triage due Wed Oct 21, 10:12 am · done 12:10 pm ✓')}</p></article>
    <div class="in-col in-out"><p class="caps">${line('Out · 12:10 pm')}</p>
      <ul class="stacks">${stack('Holiday campaign', 11, 'hc')}${stack('Always-on', 6)}</ul>
      <p class="card in-rule"><b>Rule:</b> ${t('holiday requests → Holiday campaign')}<br>${t('Ran 11 times today ✓')}</p>
      <ul class="stacks">${stack('Duplicates linked', 3)}${stack('One detail asked', 2)}${stack('Q1 backlog', 1)}</ul>
      <p class="in-sum">${t('17 accepted + 3 + 2 + 1 = 23')}</p></div>
  </div>
  <p class="strip in-strip">${t('12:10 pm')}${NB}·${NB}<b>${t('Joelle Marsh accepted the triage ✓')}</b>${NB}→${NB}${t('2:30 pm')}${NB}·${NB}${t('both missing details answered in the request thread ✓')}</p>
</div></section>`
