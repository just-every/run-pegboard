import type { ReactNode } from 'react'

// The Path view's wall (owner pick A): the critical path as one tomato cord in switchback rows, a station for each task
// on it, in cord order (the second row runs right to left). public/look/cords.js draws the cord after layout: within a
// row it runs taut from card to card at the title line (or slung between bare pegs on an empty wall), and it turns
// down at the row's end. At phone width the stations stack beside one vertical cord.
export interface Station {
  id: string
  /** The task's card (Task); a station without one is a bare peg. */
  card?: ReactNode
  /** Off-path tasks hanging below the card on short strings (Tassel). */
  tassels?: ReactNode
  /** A wider slot, as the launch card takes. */
  wide?: boolean
  /** Left out of the single phone-width cord when the wall is empty. */
  minor?: boolean
  /** Hung on the wall but not on the solid cord: an agent's proposal, reached by its own dashed cord. */
  off?: boolean
}
/** One cord for public/look/cords.js: [from, to, kind, amount, colour, marks]. */
export type Cord = [string, string, string, number, string, string]

const tomato = '#F94436'
// A station's anchors: its peg on an empty wall, otherwise its card's left and right ends at the title line (and
// `${id}-peg`, the card's peg, for a proposal's dashed cord).
const end = (station: Station, side: 'l' | 'r') => station.card ? `${station.id}-${side}` : station.id

/** The solid cord through the stations, in order; a station that is `off` the cord is skipped. */
export function cordsFor(all: Station[][]): Cord[] {
  const cords: Cord[] = []
  const rows = all.map(row => row.filter(station => !station.off))
  rows.forEach((row, r) => {
    const forward = r % 2 === 0, out = forward ? 'r' : 'l', into = forward ? 'l' : 'r'
    row.slice(1).forEach((station, i) => {
      const from = row[i]
      cords.push(from.card || station.card ? [end(from, out), end(station, into), 'taut', 0, tomato, 'arrow'] : [from.id, station.id, 'sag', 16, tomato, 'arrow'])
    })
    const next = rows[r + 1]?.[0]
    if (next) cords.push([end(row[row.length - 1], out), end(next, out), 'loop', forward ? 84 : -84, tomato, 'arrow'])
  })
  return cords
}

/** `extra` adds cords beyond the solid path, such as a proposal's dashed re-hooked cord ([from, to, kind, amount, colour, "dash arrow"]). */
export function PathWall({ label, rows, extra = [], children }: { label: string; rows: Station[][]; extra?: Cord[]; children?: ReactNode }) {
  const empty = rows.every(row => row.every(station => !station.card))
  return <section className="wall" aria-label={label} data-cords={JSON.stringify([...cordsFor(rows), ...extra])}>
    <div className={empty ? 'path empty' : 'path'}>
      {rows.map((row, r) => <ol key={r} className={r % 2 ? 'row back' : 'row'}>
        {row.map(station => <li key={station.id} className={['station', station.wide && 'wide', station.minor && 'minor', station.off && 'off'].filter(Boolean).join(' ')}>
          <span className="peg" data-peg={station.card ? `${station.id}-peg` : station.id} aria-hidden="true" />
          {station.card}{station.tassels}
        </li>)}
      </ol>)}
    </div>
    {children}
  </section>
}
