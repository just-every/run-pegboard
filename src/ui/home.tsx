import { identity } from '../identity'
import { AppBar, type Tab } from './bar'
import { Flap } from './flap'
import { Heading } from './heading'
import { Arrow } from './icons'
import { PathWall, type Station } from './path'
import { Tag } from './tag'
import { TaskCard } from './task'
import type { Viewer } from './viewer'

// The signed-in home (/app) while Pegboard has no projects: the Path view's composition in its empty state. A blank
// ghost card hangs at each of the pick's stations (five, four and four a row, ending on the launch card) and the cord
// runs card to card. Nothing is drawn as if it existed: no titles, owners or dates, only where the first task and the
// launch will hang.
const ghost = (id: string, line?: string, wide?: boolean): Station => ({ id, wide, card: <TaskCard id={id} state="ghost" more={line} /> })
const rows: Station[][] = [
  [ghost('s1', 'The first task hangs here'), ghost('s2'), ghost('s3'), ghost('s4'), ghost('s5')],
  [ghost('s6'), ghost('s7'), ghost('s8'), ghost('s9')],
  [ghost('s10'), ghost('s11'), ghost('s12'), ghost('launch', 'The launch hangs here', true)],
]

/** Base's sign-in settings, the owner's alone (Base answers anyone else 403). */
export const settingsPath = '/auth/settings/identity'
/** The views, in order. On a narrow bar the occasional ones fold into More first (fold 1), then the planning views and
 *  Inbox (fold 2); Home, Projects and My tasks always stay tabs. */
export const homeTabs = (viewer: Viewer, current = '/app'): Tab[] => {
  const views: Tab[] = [
    { label: 'Home', href: '/app' },
    { label: 'Projects', href: '/app/projects' },
    { label: 'My tasks', href: '/app/my-tasks' },
    { label: 'Goals', href: '/app/goals', fold: 2 },
    { label: 'Recurring work', href: '/app/recurrences', fold: 1 },
    { label: 'Teams', href: '/app/teams', fold: 2 },
    { label: 'Inbox', href: '/app/inbox', fold: 2 },
    ...(viewer.role === 'member' ? [] : [{ label: 'Access', href: '/app/access-review', fold: 1 }, { label: 'Admin', href: '/app/admin', fold: 1 }] satisfies Tab[]),
    ...(viewer.role === 'owner' ? [{ label: 'Settings', href: settingsPath, fold: 1 }] satisfies Tab[] : []),
  ]
  return views.map(tab => ({ ...tab, current: tab.href === current }))
}

export function AppHome({ viewer }: { viewer: Viewer }) {
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer)} />
    <main className="board" id="main">
      <Heading title="No projects yet." chip={<Flap text="EMPTY" tone="quiet" />} facts={['No tasks', 'no owners', 'no critical path']} />
      <Tag label="Pegboard" say="Nothing to re-plan · start a project and its sections and tasks hang here · agent teammates are still being built" actions={<>
        <a className="button primary" href="/app/projects">Start a project<Arrow /></a>
        <a className="button quiet" href={`${identity.runSite}/contract`}>See what’s built</a>
        <a className="button quiet" href={`${identity.runSite}/docs`}>Read the docs</a>
      </>} />
      <PathWall label="Critical path, empty" rows={rows} />
    </main>
  </>
}
