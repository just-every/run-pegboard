// 11 · Next week (page-11): six week cards for Mon Nov 2 on two bracketed rails, each weekday two named blocks sized to
// hours against that day's capacity, the day totals summing to each card's planned hours, 1,699 of 1,832 h in all.
import { NB, blockLabel, dots, glyph, head, t, type Team } from '../parts'

type Day = [[string, number], [string, number]]
const teams: [Team, string, string, string, number, number, number, number[], Day[], string, string][] = [
  ['marketing', 'Marketing', 'Kettle & Crumb', 'Holiday menu live Mon · catering flyer to print Tue', 7, 262, 280, [56, 56, 56, 56, 56],
    [[['Holiday menu live', 22], ['Café menu boards', 30]], [['Catering flyer', 20], ['Social posts', 34]], [['Menu boards, 22 cafés', 26], ['Holiday email', 26]], [['Holiday email', 20], ['Café kits, wave 2', 32]], [['Week-2 social', 20], ['Results review', 32]]], '',
    'Felix Yoon · Tue 9–noon · catering flyer print files · on Google Calendar'],
  ['events', 'Events', 'Switchback', 'Summit survey out Mon · venue and vendor wrap', 5, 168, 200, [40, 40, 40, 40, 40],
    [[['Summit survey', 14], ['Thank-you notes', 22]], [['Vendor invoices', 16], ['Reminders', 18]], [['Venue wrap-up', 16], ['Speaker follow-ups', 16]], [['Session videos', 16], ['Sponsor reports', 18]], [['Summit recap', 14], ['2027 venue scouting', 18]]], '', ''],
  ['operations', 'Operations', 'High Desert Fulfillment', 'Peak picking starts Mon in Building 2', 12, 452, 480, [96, 96, 96, 96, 96],
    [[['Peak picking, Building 2', 60], ['Receiving', 32]], [['Peak picking', 60], ['Returns', 30]], [['Peak picking', 60], ['Receiving', 30]], [['Peak picking', 56], ['Client audits', 34]], [['Cycle count', 36], ['Peak picking', 54]]], '', ''],
  ['agency', 'Agency', 'Oxbow Creative', 'Cedar Valley branch window graphics, 5 branches', 9, 338, 360, [72, 72, 72, 72, 72],
    [[['Window graphics', 28], ['Retainer clients', 40]], [['Window proofs v1', 28], ['Retainer clients', 40]], [['Client review', 24], ['Retainer clients', 44]], [['Print files', 26], ['Retainer clients', 42]], [['Install plan', 24], ['Retainer clients', 42]]], '', ''],
  ['people', 'People', 'Bellwood Insurance', '11 hires\' first week · orientation Mon–Tue', 4, 148, 160, [32, 32, 32, 32, 32],
    [[['Orientation', 16], ['Payroll setup', 14]], [['Orientation', 16], ['Benefits forms', 14]], [['IT check-ins', 12], ['Recruiting', 18]], [['Buddy lunches', 12], ['Recruiting', 18]], [['Week-1 check-ins', 14], ['Recruiting', 14]]], '', ''],
  ['product', 'Product', 'Wildwood Audio', 'Packaging locked Mon · printer files Wed', 9, 331, 352, [72, 72, 72, 72, 64],
    [[['Packaging locked', 26], ['Sell-in deck', 42]], [['Printer prep', 22], ['Sell-in deck', 44]], [['Printer files', 24], ['Press list', 44]], [['Press slot', 20], ['Help center', 46]], [['Review units', 22], ['Sell-in deck', 41]]], 'Noriko Tanabe off Fri Nov 6 (Google Calendar)',
    'Eli Ramos · Mon 8–noon · packaging artwork final · on Outlook'],
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const cal = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><rect x="2" y="4" width="16" height="14" rx="2" fill="none" stroke="#087BF7" stroke-width="2"/><path d="M2 8h16M6 2v4M14 2v4" stroke="#087BF7" stroke-width="2"/></svg>'
// Every block carries its name (page-11); nextweek.css sets the card widths so each name fits its block.
const card = ([g, team, biz, main, ppl, plan, cap, dcap, days, note, chip]: typeof teams[number]) => {
  const full = Math.max(...dcap)
  const tracks = days.map((blocks, d) => {
    let x = 0, tot = 0
    const bl = blocks.map(([lab, h], j) => { const s = `<span class="bk${j ? ' s' : ''}" style="left:${(x / full * 100).toFixed(3)}%;width:calc(${(h / full * 100).toFixed(3)}% - 2px)"><span class="lb">${blockLabel(lab)}</span></span>`; x += h; tot += h; return s }).join('')
    const off = full - dcap[d]
    return `<li class="tr"><span class="dn">${DAYS[d]}</span><span class="lane" role="img" aria-label="${DAYS[d]}: ${blocks.map(([l, h]) => `${l} ${h} h`).join(', ')}">${bl}${off ? `<span class="off" style="width:${(off / full * 100).toFixed(3)}%"></span>` : ''}</span><span class="h">${t(`${tot} h`)}</span></li>`
  }).join('')
  return `<li class="card wk"><span class="hook l" aria-hidden="true"></span><span class="hook r" aria-hidden="true"></span>
    <div class="hd">${glyph(g, 46)}<div><h3>${t(team)}</h3><p>${t(biz)}</p></div></div><p class="mw">${dots(main.split(' · ').map(t))}</p><ol class="trs">${tracks}</ol>
    <div class="ft"><p>${t(`${ppl} people`)}${NB}·${NB}<b>${t(`${plan} of ${cap} h ✓`)}</b></p>${note ? `<p class="nt">${t(note)}</p>` : ''}<span class="hb" aria-hidden="true"><i style="width:${(plan / cap * 100).toFixed(2)}%"></i></span></div>
    ${chip ? `<p class="chip">${cal}<span>${dots(chip.split(' · ').map(t))}</span></p>` : ''}</li>`
}
const rail = (group: typeof teams) => `<div class="wk-rail"><span class="rl" aria-hidden="true"></span><ol class="wks">${group.map(card).join('')}</ol></div>`

export const nextweekSection = (): string => `<section class="sec pale" id="nextweek"><div class="wrap">
  ${head(['Next week', 'Six teams', 'Week of Mon Nov 2', 'Planned Fri Oct 30'], 'Next week, planned Friday.', 'All six weeks fit.', t('Time off comes in from calendars, task work is blocked into free hours, and every lead ended Friday with Monday\'s week already fitting.'), 'center')}
  <div class="drawing">${rail(teams.slice(0, 3))}${rail(teams.slice(3))}</div>
  <p class="pill nw-pill">${dots(['Week of Mon Nov 2', '6 teams', '<b>1,699 h planned of 1,832 h</b>', 'nobody over capacity ✓'].map(p => p.startsWith('<') ? `<b>${t('1,699 h planned of 1,832 h')}</b>` : t(p)))}</p>
</div></section>`
