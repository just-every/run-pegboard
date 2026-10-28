import type { Viewer } from '../../../ui/viewer'
import type { teammateDirectory, teammateProfile } from '../../workspace/profiles'
import { Card, Shell } from '../shell'

export function PeoplePage({ viewer, people }: { viewer: Viewer; people: Awaited<ReturnType<typeof teammateDirectory>> }) {
  return <Shell viewer={viewer} current="/app/people" title="People" facts={['Teammates in this workspace']}>
    <Card title="Teammate profiles"><ul className="rows" aria-label="Teammates">
      {people.map(person => <li key={person.id}><a href={`/app/people/${person.id}`}>{person.name}</a></li>)}
      {!people.length && <li>No teammates available.</li>}
    </ul></Card>
  </Shell>
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const time = (minute: number) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute < 720 ? 'AM' : 'PM'}`
export function ProfilePage({ viewer, profile }: { viewer: Viewer; profile: Awaited<ReturnType<typeof teammateProfile>> }) {
  return <Shell viewer={viewer} current="/app/people" title={profile.person.name} crumbs={[{ label: 'People', href: '/app/people' }]}>
    <Card title="Assigned work"><p>Shared assignments you can open.</p><ul className="rows" aria-label="Permitted assignments">
      {profile.assignments.map(task => <li key={task.id}><a className="grow" href={`/app/tasks/${task.id}`}>{task.title}</a><span>{task.status === 'done' ? 'Complete' : task.status === 'doing' ? 'In progress' : 'To do'}</span></li>)}
      {!profile.assignments.length && <li>No shared assignments available to you.</li>}
    </ul></Card>
    <Card title="Working hours"><p>{profile.availability.zone}</p><ul className="rows" aria-label="Working hours">
      {profile.availability.week.map((hours, day) => <li key={day}><span className="grow">{days[day]}</span><span>{hours ? `${time(hours.start)} – ${time(hours.end)}` : 'Nonworking day'}</span></li>)}
    </ul></Card>
  </Shell>
}
