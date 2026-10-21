import { identity } from '../identity'
import { AppBar, type Tab } from './bar'
import { Flap } from './flap'
import { Heading } from './heading'
import { Arrow } from './icons'
import { PathWall, type Station } from './path'
import { Tag } from './tag'
import type { Viewer } from './viewer'

// The signed-in home (/app) while Pegboard has no projects: the Path view's composition in its empty state. The cord
// hangs between bare pegs in its three switchback rows; nothing is on it, so nothing is drawn as if it were.
const bare = (id: string, minor = false): Station => ({ id, minor })
const rows: Station[][] = [
  [bare('s1'), bare('s2', true), bare('s3'), bare('s4', true), bare('s5')],
  [bare('s6'), bare('s7', true), bare('s8', true), bare('s9')],
  [bare('s10'), bare('s11', true), bare('s12', true), bare('s13')],
]

export const homeTabs = (viewer: Viewer): Tab[] => [
  { label: 'Home', href: '/app', current: true },
  ...(viewer.role === 'owner' ? [{ label: 'Settings', href: '/auth/settings/identity' }] : []),
]

export function AppHome({ viewer }: { viewer: Viewer }) {
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer)} />
    <main className="board" id="main">
      <Heading title="No projects yet." chip={<Flap text="EMPTY" tone="quiet" />} facts={['No tasks', 'no owners', 'no critical path']} />
      <Tag label="Pegboard" say="Nothing to re-plan · projects, tasks and agent teammates are still being built · sign-in and settings work today" actions={<>
        <a className="button primary" href={`${identity.runSite}/contract`}>See what’s built<Arrow /></a>
        <a className="button quiet" href={`${identity.runSite}/docs`}>Read the docs</a>
      </>} />
      <PathWall label="Critical path, empty" rows={rows} />
    </main>
  </>
}
