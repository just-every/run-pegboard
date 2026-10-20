// 08 · Onboarding (page-08): Bellwood's new-hire template set every date from the Mon Nov 2 start; the agent's Teams
// chases named the four missing buddies; eleven badges hang from rails screwed to the wall (three rails as drawn, and
// two badges a rail on phones).
import { NB, dots, eyebrow, heading, t } from '../parts'

const names = ['Jasmine Reed', 'Luis Medina', 'Aaron Fox', 'Keisha Monroe', 'Cody Brannigan', 'Elena Marchetti', 'Caleb Hunt', 'Leni Strand', 'Idris Bello', 'Grace Tully', 'Nick Duarte']
const chased = new Set(['Aaron Fox', 'Elena Marchetti', 'Idris Bello', 'Nick Duarte'])
const badge = (nm: string) => `<li class="bdg"><span class="hang" aria-hidden="true"></span><span class="slot" aria-hidden="true"></span><p class="nm">${t(nm)}</p>`
  + `<p class="ds" role="img" aria-label="laptop, badge and buddy done"><i></i><i></i><i></i></p>${chased.has(nm) ? '<span class="bub" role="img" aria-label="chased by the agent"></span>' : ''}</li>`
const rail = (group: string[], cls = '') => `<div class="rail${cls ? ' ' + cls : ''}"><span class="rl" aria-hidden="true"></span><ul class="bdgs">${group.map(badge).join('')}</ul></div>`
const quote = (s: string) => `<span class="nw">${t(s)}</span>`
// a time and what happened at it wrap as one phrase, so no line ends on a bare time
const at = (time: string, what: string) => `<b>${t(time)}</b>${NB}${what}`

export const onboardingSection = (): string => `<section class="sec pale" id="onboarding"><div class="wrap"><div class="ob-top">
  <header class="sec-head ob-head">${eyebrow(['Onboarding', 'People', 'Bellwood Insurance', 'Tue Oct 13 – Wed Oct 28, ET'])}${heading('Eleven hires, 33 tasks.', 'Nobody chased by hand.')}</header>
  <article class="card ob-tpl"><p class="tpl-h"><b>${t('Template · New hire class').replace(' · ', `${NB}·${NB}`)}</b><br>${t('applied Tue Oct 13, 9:30 am by Danielle Price')}</p>
    <ol class="trl"><li><b>${t('Laptop ordered')}</b><span>${t('start − 10 working days')}</span><span>${t('= Mon Oct 19')}</span></li><li><b>${t('Buddy named')}</b><span>${t('start − 5')}</span><span>${t('= Mon Oct 26')}</span></li>
      <li><b>${t('Badge printed')}</b><span>${t('start − 3')}</span><span>${t('= Wed Oct 28')}</span></li><li class="s"><b>Start</b><span>${t('Mon Nov 2')}</span></li></ol>
    <p class="who">${dots(['IT: Kevin Liu', 'Facilities: Terrell Hayes', 'managers: 4'].map(t))}</p></article></div>
  <div class="ob-mid"><div class="ob-low"><p class="lede">${t('The new-hire template set every date from the Mon Nov 2 start. When four buddies were still unnamed, the agent asked their managers in Teams, or Danielle when one was out, and the replies closed the tasks.')}</p>
    <ol class="chase">
      <li class="card"><p>${dots([`<b>${t('Mon Oct 26, 9:00 am')}</b>`, t('7 of 11 buddies named'), t('agent asked Monica Hale, Derek Shaw and Walt Hennessy in Teams')])}</p></li>
      <li class="card"><p>${dots([at('9:01 am', t('Phil Garza out until Wed (Outlook calendar)')), t('agent asked Danielle'), at('9:40 am', t('Shanice Moore for Nick Duarte ✓'))])}</p></li>
      <li class="card"><p>${dots([at('9:24 am', `Monica: ${quote('‘Tamsin Wu for Aaron.’ ✓')}`), at('10:02 am', `Derek: ${quote('‘Victor Lam for Elena.’ ✓')}`), at('11:18 am', `Walt: ${quote('‘Alana Reyes for Idris.’ ✓')}`)])}</p></li>
      <li class="card"><p><b>${t('11 of 11 buddies by 11:18 am ✓')}</b></p></li>
    </ol></div>
  <div class="ob-wall"><div class="wall-l">${rail(names.slice(0, 4))}${rail(names.slice(4, 8))}${rail(names.slice(8), 'three')}</div>
    <div class="wall-s">${[0, 2, 4, 6, 8, 10].map(i => rail(names.slice(i, i + 2))).join('')}</div>
    <p class="ob-key"><span><i></i>laptop</span><span><i></i>badge</span><span><i></i>buddy</span><span>${t('left to right on every badge')}</span></p></div></div>
  <p class="pill ob-pill">${dots(['Laptops 11 of 11', 'badges 11 of 11', 'buddies 11 of 11', '33 of 33 Wed Oct 28, 4:30 pm ✓'].map(t))}</p>
</div></section>`
