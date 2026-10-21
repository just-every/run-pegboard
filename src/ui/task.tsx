import { Tick } from './icons'
import { Dots } from './dots'
import { initials } from './viewer'

// A task on the Path wall: a white card hung on its station's peg. The cord enters and leaves at the title line (the
// two end anchors). "critical" draws the tomato edge of a task the slip moved; "ghost" is dashed: an agent's proposal,
// or where a moved task was. A done task carries the green tick; a milestone the black diamond.
export interface TaskCardProps {
  id: string
  title: string
  done?: boolean
  milestone?: boolean
  owner?: string
  when?: string
  /** A quiet line under the owner ("from the dieline and renders"). */
  more?: string
  /** The one tomato line: what a slip costs ("auto-shift misses it · next slot Thu Nov 12"). */
  warn?: string
  /** The dashed chip one step back: the date the task moved from. */
  was?: string
  /** The task's phase, the one place pink appears. */
  phase?: string
  state?: 'critical' | 'ghost'
  /** The path's end: the launch and whether it holds. */
  holds?: string
}

export function TaskCard({ id, title, done, milestone, owner, when, more, warn, was, phase, state, holds }: TaskCardProps) {
  const className = ['task', state, holds !== undefined && 'end-card'].filter(Boolean).join(' ')
  return <article className={className}>
    <span className="end l" data-peg={`${id}-l`} data-at="l" data-bare="" aria-hidden="true" />
    <span className="end r" data-peg={`${id}-r`} data-at="r" data-bare="" aria-hidden="true" />
    <h3>{done && <span className="done-mark" role="img" aria-label="Done"><Tick /></span>}{milestone && <span className="diamond" role="img" aria-label="Milestone" />}{title}</h3>
    {(owner || when) && <p className="who">{owner && <span className="avatar" aria-hidden="true">{initials(owner)}</span>}<Dots phrases={[owner, when].filter(Boolean)} /></p>}
    {more && <p className="more">{more}</p>}
    {warn && <p className="warn"><Dots phrases={warn.split(' · ')} /></p>}
    {was && <p className="was">was {was}</p>}
    {phase && <p className="phase">{phase}</p>}
    {holds !== undefined && <p className="holds"><span className="done-mark" aria-hidden="true"><Tick /></span> {holds}</p>}
  </article>
}

// An off-path task hanging below its card on a short string; `chip` names a linked record (Jira FW-212).
export function Tassel({ title, owner, when, chip }: { title: string; owner?: string; when?: string; chip?: string }) {
  return <div className="tassel">
    <span className="peg" aria-hidden="true" />
    <h4>{title}</h4>
    {(owner || when) && <p className="who">{owner && <span className="avatar" aria-hidden="true">{initials(owner)}</span>}<Dots phrases={[owner, when].filter(Boolean)} /></p>}
    {chip && <p className="chip">{chip}</p>}
  </div>
}

// The exception, clipped in place on the task it hits: the message that moved it.
export function Note({ children }: { children: string }) {
  return <div className="tassel note"><span className="peg" aria-hidden="true" /><p><Dots phrases={children.split(' · ')} /></p></div>
}
