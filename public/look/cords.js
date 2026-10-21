// Tomato cords between pegs, measured after layout (the desk's cords.js, made responsive), for the homepage's drawings
// and the app's peg wall. Each [data-cords] drawing lists its cords as [from, to, kind, amount, colour?, marks?]; from/to
// name [data-peg] anchors inside it (data-at picks an edge midpoint). Kinds: "sag" hangs below both pegs, "taut" is pulled
// nearly straight, "drop" falls from one peg to the next below, "loop" swings out to the right of both pegs and back (a
// switchback's turn; a negative amount swings left), "under" routes a brief's highlight round the plan to its card's foot
// (04); a "sag" dips below any [data-clear] callout it passes (12). Marks, space-separated: "arrow" sets a head at the
// cord's middle pointing from `from` to `to`, "dash" draws a proposal. The drawing's --cord sets the stroke width (2.6
// when unset); an anchor with data-bare gets no peg dot. Decoration only: the page reads without it.
(() => {
  const NS = 'http://www.w3.org/2000/svg'
  const point = (el, box) => {
    const r = el.getBoundingClientRect(), at = el.dataset.at || 'c'
    const x = at === 'r' ? r.right : at === 'l' ? r.left : r.left + r.width / 2
    const y = at === 'b' ? r.bottom : at === 't' ? r.top : r.top + r.height / 2
    return [x - box.left, y - box.top]
  }
  const node = (svg, name, attrs) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n }
  // The middle of a quadratic or cubic Bézier and its direction there.
  const middle = c => c.length === 3
    ? [(c[0][0] + 2 * c[1][0] + c[2][0]) / 4, (c[0][1] + 2 * c[1][1] + c[2][1]) / 4, c[2][0] - c[0][0], c[2][1] - c[0][1]]
    : [(c[0][0] + 3 * c[1][0] + 3 * c[2][0] + c[3][0]) / 8, (c[0][1] + 3 * c[1][1] + 3 * c[2][1] + c[3][1]) / 8, c[3][0] + c[2][0] - c[1][0] - c[0][0], c[3][1] + c[2][1] - c[1][1] - c[0][1]]
  const curve = c => c.length === 3 ? `M${c[0]} Q${c[1]} ${c[2]}` : `M${c[0]} C${c[1]} ${c[2]} ${c[3]}`
  function draw(fig) {
    let svg = fig.querySelector(':scope > svg.cords')
    if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'cords'); svg.setAttribute('aria-hidden', 'true'); fig.appendChild(svg) }
    svg.replaceChildren()
    if (getComputedStyle(svg).display === 'none') return
    const box = fig.getBoundingClientRect()
    const width = parseFloat(getComputedStyle(fig).getPropertyValue('--cord')) || 2.6
    const find = id => fig.querySelector(`[data-peg="${id}"]`)
    let list
    try { list = JSON.parse(fig.dataset.cords) } catch { return }
    list.forEach(([from, to, kind, amount = 28, colour = '#F94436', marks = ''], i) => {
      const fa = find(from), fb = find(to)
      if (!fa || !fb || !fa.getClientRects().length || !fb.getClientRects().length) return
      const [x1, y1] = point(fa, box), [x2, y2] = point(fb, box)
      let d, c
      if (kind === 'drop') c = [[x1, y1], [x1, y1 + amount], [x2, y2 - amount], [x2, y2]]
      else if (kind === 'taut') { const m = Math.max(y1, y2) + amount; c = [[x1, y1], [(x1 + x2) / 2, m], [x2, y2]] }
      else if (kind === 'loop') { const x = (amount > 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + amount; c = [[x1, y1], [x, y1], [x, y2], [x2, y2]] }
      else if (kind === 'under') {
        const brief = fig.querySelector('[data-ref="brief"]').getBoundingClientRect(), plan = fig.querySelector('[data-ref="plan"]').getBoundingClientRect()
        const vx = brief.right - box.left + 46 - amount * 9, ly = plan.bottom - box.top + 22 + amount * 12, r = 12
        d = `M${x1},${y1} L${vx - r},${y1} Q${vx},${y1} ${vx},${y1 + r} L${vx},${ly - r} Q${vx},${ly} ${vx + r},${ly} L${x2 - r},${ly} Q${x2},${ly} ${x2},${ly - r} L${x2},${y2}`
      } else {
        // a sag passes under any [data-clear] element it spans (the curve's lowest point is 3/4 of the way to m)
        let m = Math.max(y1, y2) + amount
        for (const c of fig.querySelectorAll('[data-clear]')) {
          const r = c.getBoundingClientRect(), cx = (r.left + r.right) / 2 - box.left
          if (cx > Math.min(x1, x2) && cx < Math.max(x1, x2)) m = Math.max(m, Math.max(y1, y2) + (r.bottom - box.top + 12 - Math.max(y1, y2)) / .75)
        }
        c = [[x1, y1], [x1 + (x2 - x1) * .3, m], [x1 + (x2 - x1) * .7, m], [x2, y2]]
      }
      const dash = marks.includes('dash') ? { 'stroke-dasharray': `${width * 3} ${width * 2.2}` } : {}
      node(svg, 'path', { d: d ?? curve(c), fill: 'none', stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round', ...dash })
      if (c && marks.includes('arrow')) {
        const [x, y, dx, dy] = middle(c), s = width * 1.9
        node(svg, 'path', { d: `M${-s},${-s} L${s * .55},0 L${-s},${s}`, fill: 'none', stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: `translate(${x} ${y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})` })
      }
      for (const [el, x, y] of [[fa, x1, y1], [fb, x2, y2]]) if (!el.classList.contains('peg') && !el.hasAttribute('data-bare')) node(svg, 'circle', { cx: x, cy: y, r: 5.5, fill: '#141414' })
    })
  }
  const figs = [...document.querySelectorAll('[data-cords]')]
  const all = () => figs.forEach(draw)
  let frame = 0
  const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(all) }
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(soon); figs.forEach(f => ro.observe(f)) }
  addEventListener('resize', soon)
  document.fonts?.ready.then(soon)
  soon()
})()
