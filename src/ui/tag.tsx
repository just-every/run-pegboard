import type { ReactNode } from 'react'
import { glue } from './dots'

// The agent's tag, clipped at the top right of the board by its own peg: what it says (clauses joined by " · "), the
// screen's actions (one tomato primary) and who it tells.
export function Tag({ label, say, actions, tells }: { label: string; say: string; actions: ReactNode; tells?: ReactNode }) {
  return <aside className="tag" aria-label={label}>
    <span className="peg" aria-hidden="true" />
    <p className="say">{glue(say)}</p>
    <div className="acts">{actions}</div>
    {tells && <p className="tells">{tells}</p>}
  </aside>
}
