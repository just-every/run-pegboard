// 04 · Plan from a brief (page-04, phone plan page-04-390): Wes's two-page Alder brief wired by exactly four cords into
// the draft plan (6 phases, 57 tasks, 9 owners, 24 dependencies, 4 milestones), nine capacity rows and the approval.
import { NB, avatar, dots, head, line, peg, t, title } from '../parts'

type Phase = [string, number, [string, string][], string[], number, [string, string, boolean, string?]]
// [phase, tasks, owners, two tasks shown, more, key card [title, detail, milestone, cord id]]
const phases: Phase[] = [
  ['Positioning', 8, [['WH', 'Wes Holloway']], ['Messaging house', 'Competitive grid'], 5, ['Positioning locked', 'Fri Oct 16', true]],
  ['Pricing & packaging', 11, [['RP', 'Raj Patel'], ['ER', 'Eli Ramos']], ['Retail price sheet', 'Dieline v2'], 8, ['Packaging locked', 'Fri Oct 30', true, 'k1']],
  ['Content & photography', 12, [['NT', 'Noriko Tanabe'], ['LC', 'Lucy Chen']], ['Shot list', 'Copy & legal review'], 9, ['Photo shoot', 'final colors · Noriko', false, 'k2']],
  ['Retail sell-in', 9, [['NL', 'Nora Lind']], ['Buyer list, 40 accounts', 'Sell-in deck'], 6, ['Retail sell-in', 'Tue Nov 10', true, 'k3']],
  ['Launch PR', 10, [['SK', 'Silas Kerr']], ['Press list', '30 review units'], 7, ['Launch', 'Tue Feb 16, 2027', true, 'k4']],
  ['Support readiness', 7, [['CD', 'Carmen Diaz'], ['BO', 'Ben Ortiz']], ['Help center articles', 'Support macros'], 5, ['Firmware 1.4 · Jira FW-212', 'linked, status synced', false]],
]
const people: [string, number, number?][] = [['Wes Holloway', 38], ['Raj Patel', 39], ['Eli Ramos', 38], ['Noriko Tanabe', 38], ['Lucy Chen', 36], ['Nora Lind', 39, 44], ['Silas Kerr', 34], ['Carmen Diaz', 32], ['Ben Ortiz', 37]]
const W = 48 // the bar runs to 48 h; the 40 h line is marked

// A key card: its milestone or link, then the detail. A long date may break before its year, as page-04 sets it. The Jira
// link reads "Firmware 1.4 · Jira FW-212 · linked" on phones (page-04-390), with the full detail from 760 px up.
const key = ([name, detail, ms, id]: Phase[5]): string => {
  const jira = name.startsWith('Firmware')
  const dd = `<span class="dd">${line(detail).replace(`,${NB}2027`, ', 2027')}</span>`
  const lead = jira ? dots([...name.split(' · ').map(t), `<span class="jl">${t(detail.split(',')[0])}</span>`]) : line(name)
  return `<div class="t key${ms ? ' ms' : ''}${jira ? ' jira' : ''}">${id ? peg('foot', id).replace('<span', '<span data-at="b"') : ''}<span>${lead}${dd}</span></div>`
}
const col = ([name, n, owners, tasks, more, k]: Phase): string => `<li class="col"><h3 class="n">${title(name)}</h3><p class="c">${t(`${n} tasks`)}</p>`
  + `<p class="ow">${owners.map(([i]) => avatar(i)).join('')}<span>${owners.map(([, p]) => t(p)).join(', ')}</span></p>`
  + tasks.map(x => `<p class="t">${title(x)}</p>`).join('') + `<p class="more">${t(`+ ${more} more`)}</p>${key(k)}</li>`
const highlights = ['Packaging locked by Fri Oct 30', 'Photograph the final colors, not prototypes', 'Retail sell-in by Tue Nov 10', 'Launch Tue Feb 16, 2027']
const hl = (i: number) => `<span class="hl">${t(highlights[i])}${peg('hp', `h${i + 1}`).replace('<span', '<span data-at="r"')}</span>`
const cap = ([n, h, was]: [string, number, number?]) => `<li class="r"><span class="nm">${t(n)}</span><span class="pk">${t(`peak ${h} h`)}${was ? `${NB}<span class="mv">·${NB}${t(`was ${was}`)}</span>` : ''}</span>`
  + `<span class="bar" aria-hidden="true"><i style="width:${(h / W * 100).toFixed(2)}%"></i>${was ? `<s style="left:${(h / W * 100).toFixed(2)}%;width:${((was - h) / W * 100).toFixed(2)}%"></s>` : ''}<b style="left:${(40 / W * 100).toFixed(2)}%"></b></span><span class="ok" aria-label="fits">✓</span></li>`

export const briefSection = (): string => `<section class="sec pale" id="brief"><div class="wrap">
  ${head(['Plan from a brief', 'Product', 'Wildwood Audio', 'Mon Oct 5, 9:02–10:15 am PT'], 'A two-page brief.', '57 tasks that fit.', t('Wes pasted the launch brief for the Alder speaker. The agent drafted phases, owners, dependencies and dates against nine people\'s real weeks. Nothing was created until Wes approved it.'))}
  <div class="drawing bf-top" data-cords='[["h1","k1","under",0],["h2","k2","under",1],["h3","k3","under",2],["h4","k4","under",3]]'>
    <div class="bf-pages" data-ref="brief">
      <div class="page back" aria-hidden="true"></div>
      <article class="page front"><h3>${t('Alder speaker · launch brief')}</h3><p class="pn">${line('page 1 of 2 · pasted 9:02 am')}</p>
        <p>${t('Alder ships in four colors: sage, clay, slate and sand.')}</p>${hl(0)}<p>${t('so the printer keeps its Thu Nov 5 press slot.')}</p>
        ${hl(1)}<p>${t('Buyers at 40 retail accounts see the deck first.')}</p>${hl(2)}${hl(3)}<p>${t('Firmware 1.4 must ship before launch.')}</p></article>
    </div>
    <div class="card bf-plan" data-ref="plan"><p class="ph">${dots(['<b>Draft plan</b>', ...'Alder launch · 9:08 am · 6 phases · 57 tasks · 9 owners · 24 dependencies · 4 milestones'.split(' · ').map(t)])}</p>
      <ol class="cols">${phases.map(col).join('')}</ol></div>
  </div>
  <div class="card bf-ms"><p class="ct">Milestones</p><ul>${[['Positioning locked', 'Fri Oct 16'], ['Packaging locked', 'Fri Oct 30'], ['Retail sell-in', 'Tue Nov 10'], ['Launch', 'Tue Feb 16, 2027']].map(([n, d]) => `<li>${t(n)}${NB}<span class="g">·${NB}${t(d)}</span></li>`).join('')}</ul></div>
  <div class="card bf-cap"><p class="ct">${dots([`<b>${t('Checked against 9 workloads and calendars')}</b>`, ...'weeks of Oct 5 – Nov 9 · every peak under 40 h · fits capacity ✓'.split(' · ').map(t)])}</p>
    <p class="ct-s"><b>${t('Capacity · 9 workloads and calendars').replace(' · ', `${NB}·${NB}`)}</b><span class="g">${line('weeks of Oct 5 – Nov 9 · every peak under 40 h')}</span></p>
    <p class="g mv1">${t('1 task moved to fit: retail price sheet (5 h), Nora Lind → Raj Patel, week of Oct 19')}</p>
    <ul class="rows">${people.map(cap).join('')}</ul></div>
  <p class="bf-strip"><span class="ok">✓</span>${dots([`<b>${t('10:15 am')}</b>`, `<b>${t('Wes Holloway approved')}</b>`, t('57 tasks created'), t('9 owners told')])}</p>
</div></section>`
