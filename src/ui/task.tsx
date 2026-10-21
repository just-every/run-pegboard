import { Tick } from './icons'
import { Dots, glue, tidy } from './dots'
import { initials } from './viewer'

// A task on the Path wall: a white card hung on its station's peg. The cord enters and leaves at the title line (the
// two end anchors). "critical" draws the tomato edge of a task the slip moved; "ghost" is dashed: an agent's proposal,
// where a moved task was, or, with no title, where a task will hang on an empty wall (blank, or one quiet `more` line).
// A done task carries the green tick; a milestone the black diamond.
export interface TaskCardProps {
  id: string
  /** Left out only on a ghost: a blank card at the pick's card size where a task will hang. */
  title?: string
  done?: boolean
  milestone?: boolean
  owner?: string
  when?: string
  /** A quiet line under the owner ("from the dieline and renders"); a blank ghost's one line. */
  more?: string
  /** The one tomato line: what a slip costs ("auto-shift misses it · next slot Thu Nov 12"). */
  warn?: string
  /** The dashed chip one step back: the date the task moved from. */
  was?: string
  /** The task's phase, the one place pink appears. */
  phase?: string
  state?: 'critical' | 'ghost'
  /** The path's end: the launch (its date beside the title) and whether it holds. */
  holds?: string
}

export function TaskCard({ id, title, done, milestone, owner, when, more, warn, was, phase, state, holds }: TaskCardProps) {
  const className = ['task', state, title === undefined && 'blank', holds !== undefined && 'end-card'].filter(Boolean).join(' ')
  return <article className={className}>
    <span className="end l" data-peg={`${id}-l`} data-at="l" data-bare="" aria-hidden="true" />
    <span className="end r" data-peg={`${id}-r`} data-at="r" data-bare="" aria-hidden="true" />
    <span className="end b" data-peg={`${id}-b`} data-at="b" data-bare="" aria-hidden="true" />
    {title !== undefined && <h3>{done && <span className="done-mark" role="img" aria-label="Done"><Tick /></span>}{milestone && <span className="diamond" role="img" aria-label="Milestone" />}{holds !== undefined && when ? <Dots phrases={[title, when]} /> : tidy(title)}</h3>}
    {holds === undefined && (owner || when) && <p className="who">{owner && <span className="avatar" aria-hidden="true">{initials(owner)}</span>}<Dots phrases={[owner, when].filter((phrase): phrase is string => Boolean(phrase))} /></p>}
    {more && <p className="more">{glue(more)}</p>}
    {warn && <p className="warn">{glue(warn)}</p>}
    {(was || phase) && <p className="marks">{was && <span className="was">was {tidy(was)}</span>}{phase && <span className="phase">{phase}</span>}</p>}
    {holds !== undefined && <p className="holds"><span className="done-mark" aria-hidden="true"><Tick /></span> {holds}</p>}
  </article>
}

// An off-path task hanging below its card on a short string; `chip` names a linked record (Jira FW-212).
export function Tassel({ title, owner, when, chip, href }: { title: string; owner?: string; when?: string; chip?: string; href?: string }) {
  return <div className="tassel">
    <span className="peg" aria-hidden="true" />
    <h4>{href ? <a href={href}>{glue(title)}</a> : glue(title)}</h4>
    {(owner || when) && <p className="who">{owner && <span className="avatar" aria-hidden="true">{initials(owner)}</span>}<Dots phrases={[owner, when].filter((phrase): phrase is string => Boolean(phrase))} /></p>}
    {chip && <p className="chip">{chip}</p>}
  </div>
}

// The exception, clipped in place on the task it hits: the message that moved it.
export function Note({ children }: { children: string }) {
  return <div className="tassel note"><span className="peg" aria-hidden="true" /><p>{glue(children)}</p></div>
}
