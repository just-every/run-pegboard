import type { ReactNode } from 'react'

// The Path view's wall (owner pick A): the critical path as one tomato cord in switchback rows, a station for each task
// on it, in cord order (the second row runs right to left). public/look/cords.js draws the cord after layout: within a
// row it runs taut from card to card at the title line, and it turns down at the row's end. The rows hold from 1024 px
// up; below that the stations stack beside one vertical cord.
export interface Station {
  id: string
  /** The task's card (TaskCard, with the station's id); on an empty wall a blank ghost. */
  card: ReactNode
  /** Off-path tasks hanging below the card on short strings (Tassel). */
  tassels?: ReactNode
  /** A wider slot, as the launch card takes. */
  wide?: boolean
  /** Hung on the wall but not on the solid cord: an agent's proposal, reached by its own dashed cord. */
  off?: boolean
}
/** One cord for public/look/cords.js: [from, to, kind, amount, colour, marks]. */
export type Cord = [string, string, string, number, string, string]

const tomato = '#F94436'

/** The solid cord through the stations, in order, from each card's end to the next card's at the title line (anchors
 *  `${id}-l`, `-r`, `-b` and the card's peg `${id}-peg`); a station that is `off` the cord is skipped. */
export function cordsFor(all: Station[][]): Cord[] {
  const cords: Cord[] = []
  const rows = all.map(row => row.filter(station => !station.off))
  rows.forEach((row, r) => {
    const forward = r % 2 === 0, out = forward ? 'r' : 'l', into = forward ? 'l' : 'r'
    row.slice(1).forEach((station, i) => cords.push([`${row[i].id}-${out}`, `${station.id}-${into}`, 'taut', 0, tomato, 'arrow']))
    const next = rows[r + 1]?.[0]
    if (next) cords.push([`${row[row.length - 1].id}-${out}`, `${next.id}-${out}`, 'loop', forward ? 84 : -84, tomato, 'arrow'])
  })
  return cords
}

/** `extra` adds cords beyond the solid path, such as a proposal's dashed re-hooked cord ([from, to, kind, amount, colour, "dash arrow"]). */
export function PathWall({ label, rows, extra = [], children }: { label: string; rows: Station[][]; extra?: Cord[]; children?: ReactNode }) {
  return <section className="wall" aria-label={label} data-cords={JSON.stringify([...cordsFor(rows), ...extra])}>
    <div className="path">
      {rows.map((row, r) => <ol key={r} className={r % 2 ? 'row back' : 'row'}>
        {row.map(station => <li key={station.id} className={['station', station.wide && 'wide', station.off && 'off'].filter(Boolean).join(' ')}>
          <span className="peg" data-peg={`${station.id}-peg`} aria-hidden="true" />
          {station.card}{station.tassels}
        </li>)}
      </ol>)}
    </div>
    {children}
  </section>
}
