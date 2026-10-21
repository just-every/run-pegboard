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
export const homeTabs = (viewer: Viewer, current = '/app'): Tab[] => [
  { label: 'Home', href: '/app' },
  ...(viewer.role === 'owner' ? [{ label: 'Settings', href: settingsPath }] : []),
].map(tab => ({ ...tab, current: tab.href === current }))

export function AppHome({ viewer }: { viewer: Viewer }) {
  // The tag speaks to its reader: only the owner has settings.
  const works = viewer.role === 'owner' ? 'sign-in and settings work today' : 'sign-in works today'
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer)} />
    <main className="board" id="main">
      <Heading title="No projects yet." chip={<Flap text="EMPTY" tone="quiet" />} facts={['No tasks', 'no owners', 'no critical path']} />
      <Tag label="Pegboard" say={`Nothing to re-plan · projects, tasks and agent teammates are still being built · ${works}`} actions={<>
        <a className="button primary" href={`${identity.runSite}/contract`}>See what’s built<Arrow /></a>
        <a className="button quiet" href={`${identity.runSite}/docs`}>Read the docs</a>
      </>} />
      <PathWall label="Critical path, empty" rows={rows} />
    </main>
  </>
}
