// 09 · Re-plan (page-09, the one dark band; phone plan page-09-390): Wildwood's working-day grid Mon Oct 26 – Tue Nov 10,
// every bar and baseline on its day columns, cords only between live bars, the 4:10 pm to 9:00 am event rail and the
// result strip. The same re-plan the app shows one minute after the agent's proposal.
import { NB, dots, eyebrow, t } from '../parts'

const days = ['Mon Oct 26', 'Tue Oct 27', 'Wed Oct 28', 'Thu Oct 29', 'Fri Oct 30', 'Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6', 'Mon Nov 9', 'Tue Nov 10']
const D = (d: string) => days.indexOf(d)
type Row = [string, string, [string, string], [string, string]?, string?, ('sw' | 'mv' | 'rp')?, string?]
// [label, owner, live, baseline, tag, kind, phone line]
const rows: Row[] = [
  ['Color samples in', 'Ben Ortiz', ['Wed Oct 28', 'Wed Oct 28'], ['Tue Oct 27', 'Tue Oct 27'], '+1, same week', 'sw', 'Ben Ortiz · Wed Oct 28 (was Tue Oct 27)'],
  ['Photo shoot', 'Noriko Tanabe', ['Thu Oct 29', 'Fri Oct 30'], ['Wed Oct 28', 'Thu Oct 29'], '+1, same week', 'sw', 'Noriko Tanabe · Thu Oct 29 – Fri Oct 30'],
  ['Packaging artwork final', 'Eli Ramos', ['Mon Nov 2', 'Mon Nov 2'], ['Fri Oct 30', 'Fri Oct 30'], 'moved +1', 'mv', 'Eli Ramos · Mon Nov 2 (was Fri Oct 30)'],
  ['Sell-in deck photos', 'Noriko Tanabe', ['Mon Nov 2', 'Mon Nov 2'], ['Fri Oct 30', 'Fri Oct 30'], 'moved +1', 'mv', 'Noriko Tanabe · Mon Nov 2 (was Fri Oct 30)'],
  ['◆Packaging locked', '+1 working day vs baseline', ['Mon Nov 2', 'Mon Nov 2'], ['Fri Oct 30', 'Fri Oct 30'], 'moved +1', 'mv', 'Mon Nov 2 · +1 working day vs baseline'],
  ['Copy & legal review', 'Lucy Chen', ['Fri Oct 30', 'Mon Nov 2'], ['Mon Nov 2', 'Tue Nov 3'], 're-planned: beside the shoot', 'rp', 'Lucy Chen · Fri Oct 30 – Mon Nov 2'],
  ['Printer files', 'Eli Ramos', ['Wed Nov 4', 'Wed Nov 4'], undefined, undefined, undefined, 'Eli Ramos · Wed Nov 4'],
  ['Press slot', '', ['Thu Nov 5', 'Thu Nov 5'], undefined, undefined, undefined, 'Thu Nov 5'],
  ['Packaging samples', '', ['Mon Nov 9', 'Mon Nov 9'], undefined, undefined, undefined, 'Mon Nov 9'],
  ['◆Retail sell-in', 'Nora Lind', ['Tue Nov 10', 'Tue Nov 10'], undefined, undefined, undefined, 'Nora Lind · Tue Nov 10'],
]
const RH = 48, N = days.length
const col = (i: number) => `${(i / N * 100).toFixed(4)}%`
// the bar and milestone geometry in grid units (x: day columns 0..12, y: px) for the cords
const geo: [number, number, number][] = rows.map(([lab, , live], r) => {
  const a = D(live[0]), b = D(live[1]), y = r * RH + 13
  return lab.startsWith('◆') ? [b + 1, b + 1, y] : [a + .07, b + 1 - .07, y]
})
// cords leave a predecessor's end for its successor's start: critical path tomato, shoot → deck photos grey, the
// re-planned review → printer files green; the two cords into Printer files run level past the review's baseline, then drop
const links: [number, number, 't' | 'm' | 'g', boolean?][] = [[0, 1, 't'], [1, 2, 't'], [2, 4, 't'], [4, 6, 't', true], [6, 7, 't'], [7, 8, 't'], [8, 9, 't'], [1, 3, 'm'], [5, 6, 'g', true]]
const U = 100 // svg units per day column
const cords = links.map(([p, s, k, around]) => {
  const [, pe, py] = geo[p], [ss, , sy] = geo[s]
  const x1 = pe * U, x2 = ss * U, colour = k === 't' ? '#F94436' : k === 'g' ? '#4AF489' : '#7D858E'
  const vx = x2 - (k === 't' ? 8 : 16)
  const d = around ? `M${x1} ${py}H${vx - 14}C${vx} ${py} ${vx} ${py} ${vx} ${py + 14}V${sy - 14}C${vx} ${sy} ${vx} ${sy} ${x2} ${sy}`
    : `M${x1} ${py}C${x1 + Math.max(18, (x2 - x1) / 2)} ${py} ${x2 - Math.max(18, (x2 - x1) / 2)} ${sy} ${x2} ${sy}`
  return `<path d="${d}" stroke="${colour}" stroke-width="${k === 'm' ? 2 : 2.6}"/>`
}).join('')
const ends = links.flatMap(([p, s, k]) => [[geo[p][1], geo[p][2], k], [geo[s][0], geo[s][2], k]] as [number, number, string][])
const endDots = ends.map(([x, y, k]) => `<span class="rp-end ${k}" style="left:${col(x)};top:${y}px"></span>`).join('')

const label = ([lab, own]: Row) => { const ms = lab.startsWith('◆'); return `<p class="lab">${ms ? '<span class="dm" aria-hidden="true"></span>' : ''}${t(ms ? lab.slice(1) : lab)}${own ? `${NB}<span class="o">·${NB}${t(own)}</span>` : ''}</p>` }
const marks = ([lab, , live, base]: Row, r: number) => {
  const ms = lab.startsWith('◆'), a = D(live[0]), b = D(live[1]), y = r * RH
  let h = ''
  if (base) {
    const ga = D(base[0]), gb = D(base[1])
    h += ms ? `<span class="dia g" style="left:${col(gb + 1)};top:${y + 2}px"></span>` : `<span class="ghost" style="left:calc(${col(ga)} + 8px);width:calc(${col(gb + 1 - ga)} - 22px);top:${y + 31}px"></span>`
  }
  h += ms ? `<span class="dia" style="left:${col(b + 1)};top:${y + 2}px"></span>` : `<span class="bar" style="left:calc(${col(a)} + 6px);width:calc(${col(b + 1 - a)} - 12px);top:${y}px"></span>`
  return h
}
const tag = ([, , , , tg, kind]: Row) => tg ? `<span class="tag ${kind}">${t(tg)}</span>` : ''
const events: [string, string, string, string?][] = [
  ['t', 'Tue Oct 27, 4:10 pm', 'forwarder\'s email on the samples task: held at customs, delivery Wed 9:00 am'],
  ['', '4:12 pm', 'auto-shift: 3 tasks to Mon Nov 2 · press slot Thu Nov 5 missed · next slot Thu Nov 12, after sell-in'],
  ['', '4:20 pm', 'agent proposed: start copy & legal review Fri Oct 30 from the dieline and renders, beside the shoot'],
  ['ok', 'Wed Oct 28, 8:05 am', 'Wes Holloway approved · Eli, Noriko, Lucy and Nora told ✓'],
  ['ok', '9:00 am', 'samples in ✓'],
]

export const replanSection = (): string => `<section class="sec dark" id="replan"><div class="wrap">
  <div class="rp-top"><header class="sec-head">${eyebrow(['Re-plan', 'Product', 'Wildwood Audio', 'Tue Oct 27 – Wed Nov 4, PT'])}
    <h2 class="display"><span>Samples <em class="late">a${NB}day</em> late.</span> <span>Launch date${NB}held.</span></h2>
    <p class="lede">${t('Customs held the color samples a day. Pegboard shifted the chain, the agent saw the press slot slipping and proposed one change, and Wes approved it before the samples arrived.')}</p></header>
    <ol class="rp-ev">${events.map(([k, when, what]) => `<li class="${k}"><p>${dots([`<b>${t(when)}</b>`, ...what.split(' · ').map(t)])}</p></li>`).join('')}</ol></div>
  <div class="drawing rp-grid" role="img" aria-label="Working-day grid, Mon Oct 26 to Tue Nov 10: the shoot and three tasks moved one working day, copy and legal review re-planned beside the shoot, printer files, press slot, packaging samples and retail sell-in unchanged.">
    <div class="rp-labels" aria-hidden="true"><span class="rp-hd"></span>${rows.map(label).join('')}</div>
    <div class="rp-days" aria-hidden="true">
      <div class="rp-hd">${days.map(d => `<span><i>${d.slice(0, 3)}</i>${t(d.slice(4))}</span>`).join('')}</div>
      <div class="rp-body" style="height:${rows.length * RH}px">${days.map((_, i) => `<span class="cl" style="left:${col(i)}"></span>`).join('')}<span class="cl" style="left:100%"></span>
        <svg class="rp-cords" viewBox="0 0 ${N * U} ${rows.length * RH}" preserveAspectRatio="none" fill="none">${cords}</svg>
        ${rows.map(marks).join('')}${endDots}
        <div class="rp-tags">${rows.map((r, i) => `<span class="tg" style="top:${i * RH + 1}px">${tag(r)}</span>`).join('')}</div></div>
    </div>
  </div>
  <div class="rp-chain"><p class="ch">${dots([t('Re-planned chain'), t('Mon Oct 26 – Tue Nov 10')])}</p>
    <ol>${rows.map(([lab, , , , tg, kind, ph]) => `<li class="r${kind === 'rp' ? ' wide' : ''}"><div><p class="n">${t(lab.replace('◆', '◆ '))}</p><p class="d">${dots((ph ?? '').split(' · ').map(t))}</p></div><span class="tag ${kind ?? 'un'}">${t(tg ?? 'unchanged')}</span></li>`).join('')}</ol></div>
  <ul class="rp-res">
    <li class="c">${t('Mon Nov 2 · packaging locked ✓').replace(' · ', `${NB}·${NB}`)}</li><li class="arw" aria-hidden="true">→</li>
    <li class="c">${t('Wed Nov 4 · printer files sent ✓').replace(' · ', `${NB}·${NB}`)}</li><li class="arw" aria-hidden="true">→</li>
    <li class="c d3">${t('press slot Thu Nov 5 kept ✓')}</li>
    <li class="c d3"><span class="pin" aria-hidden="true"></span>${t('sell-in Tue Nov 10 held')}</li>
    <li class="c d3"><span class="pin" aria-hidden="true"></span>${t('launch Tue Feb 16, 2027 held ✓')}</li>
    <li class="c m3">${t('Press slot kept')}${NB}·${NB}${t('sell-in and launch held ✓')}</li>
  </ul>
</div></section>`
