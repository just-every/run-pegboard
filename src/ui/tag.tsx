import type { ReactNode } from 'react'
import { glue } from './dots'

// The agent's tag, hung by its own peg: what it says (clauses joined by " · "), the screen's actions (one tomato
// primary) and who it tells. On a wall with no proposal (the empty home) it sits in the heading band's corner; on a
// populated Path it clips to the cord at the review card, beside the card its proposal moves, never covering it
// (APP.md, docs/LOOK.md).
export function Tag({ label, say, actions, tells }: { label: string; say: string; actions: ReactNode; tells?: ReactNode }) {
  return <aside className="tag" aria-label={label}>
    <span className="peg" aria-hidden="true" />
    <p className="say">{glue(say)}</p>
    <div className="acts">{actions}</div>
    {tells && <p className="tells">{tells}</p>}
  </aside>
}
