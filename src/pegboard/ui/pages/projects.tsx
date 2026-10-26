import type { ProjectListing } from '../../workspace/projects'
import type { TeamListing } from '../../workspace/teams'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, levelLabel } from '../shell'

export function ProjectsPage({ viewer, projects, teams, canCreate, workspace }: { viewer: Viewer; projects: ProjectListing[]; teams: TeamListing[]; canCreate: boolean; workspace: string }) {
  return <Shell viewer={viewer} current="/app/projects" title="Projects" chip={projects.length ? `${projects.length} OPEN` : 'NONE'} facts={[`${projects.length} project${projects.length === 1 ? '' : 's'} you can open`]}>
    <Card title="Your projects">
      {projects.length === 0 ? <p className="muted">You have no projects yet. Projects you create, or are given access to, hang here.</p> : <ul className="rows">
        {projects.map(project => <li key={project.id}><span className="grow"><a href={`/app/projects/${project.id}`}>{project.name}</a>{project.description && <><br /><small>{project.description}</small></>}</span><span className="tagline">{levelLabel(project.level)}</span><span className="tagline">{project.visibility === 'private' ? 'Private to members' : project.visibility === 'team' ? 'Team only' : 'Shared with workspace'}</span></li>)}
      </ul>}
    </Card>
    {canCreate && <Card title="Start a project">
      <p><a className="button quiet" href="/app/templates">New project from a template</a></p>
      <Form action="/api/v1/projects" next="/app/projects" label="Start a project">
        <input type="hidden" name="workspaceId" value={workspace} />
        <Field label="Project name" name="name" required />
        <Area label="Description" name="description" />
        <Pick label="Share with" name="visibility" value="private" options={[{ value: 'private', label: 'Private to members' }, { value: 'team', label: 'Team only' }, { value: 'workspace', label: 'Shared with workspace' }]} />
        <Pick label="Team (for Team only)" name="teamId" blank="No team" options={teams.filter(team => team.member).map(team => ({ value: team.id, label: team.name }))} />
        <Pick label="Default level for the team or workspace" name="teamLevel" value="viewer" options={[{ value: 'viewer', label: 'Viewer' }, { value: 'commenter', label: 'Commenter' }, { value: 'editor', label: 'Editor' }]} />
        <Submit>Create project</Submit>
      </Form>
    </Card>}
  </Shell>
}
