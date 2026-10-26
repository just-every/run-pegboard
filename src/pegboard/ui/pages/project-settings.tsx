import type {FieldRow} from '../../model'
import type {changePreview} from '../../fields/values'
import {fieldTypes} from '../../fields/definitions'
import type { board } from '../../tasks/board'
import type { SharePreview } from '../../workspace/projects'
import type { Viewer } from '../../../ui/viewer'
import { Area, Card, Field, Form, Pick, Shell, Submit, levelLabel, levelOptions } from '../shell'

type Board = Awaited<ReturnType<typeof board>>
export interface Grantee { value: string; label: string }
export interface GrantLine { id: string; grantee: string; level: string; scope: string; source: string; by: string }
export interface Props { viewer: Viewer; id: string; data: Board; grants: GrantLine[] | null; people: Grantee[]; teams: Grantee[]; preview: SharePreview | null; proposal: Record<string, string>; sourceProjects:Grantee[];library:FieldRow[];fieldPreview:Awaited<ReturnType<typeof changePreview>>|null;sectionList: { id: string; name: string; mapsTo: string | null }[] }

const visibilityLabel = (value: string) => value === 'private' ? 'Private to members' : value === 'team' ? 'Team only' : 'Shared with workspace'
const mapsLabel = (value: string | null) => value === 'todo' ? 'To do' : value === 'doing' ? 'Doing' : value === 'done' ? 'Done' : 'No status'

export function ProjectSettingsPage({ viewer, id, data, grants, people, teams, preview, proposal, sectionList,library,fieldPreview,sourceProjects }: Props) {
  const can = (capability: string) => (data.capabilities as string[]).includes(capability)
  const back = `/app/projects/${id}/settings`
  const project = data.project
  return <Shell viewer={viewer} current="/app/projects" title={`${project.name}: settings`} chip={levelLabel(data.level).toUpperCase()} facts={[`Your access ${levelLabel(data.level)}`, visibilityLabel(project.visibility)]}
    crumbs={[{ label: 'Projects', href: '/app/projects' }, { label: project.name, href: `/app/projects/${id}` }, { label: 'Settings', href: back, current: true }]}>
    {can('manage_settings')&&<Card title="Recovery"><a className="button quiet" href={`/app/recovery?type=project&id=${project.id}&action=archive`}>Review archive</a> <a className="button quiet" href={`/app/projects/${project.id}/brief`}>Project brief</a></Card>}
    {can('manage_settings')&&<Card title="Reusable work"><p><a href={`/app/projects/${id}/duplicate`}>Duplicate project</a></p><p><a href={`/app/templates?targetProjectId=${id}`}>Add work from a template</a></p>{can('manage_rules')&&<p><a href={`/app/projects/${id}/template-rules`}>Template rules</a></p>}{['owner','admin'].includes(viewer.role)&&<p><a href="/app/workflow-bundles">Reusable workflow bundles</a></p>}</Card>}
    <Card title="How you have access">
      <ul className="rows">{data.paths.length ? data.paths.map((path, i) => <li key={i}><span className="grow">{path.via}</span><span className="tagline">{levelLabel(path.level)}</span>{path.scope !== 'full' && <span className="tagline">{path.scope === 'approve' ? 'Approve only' : 'Assigned tasks'}</span>}</li>) : <li>No grant gives you access.</li>}</ul>
    </Card>
    {can('manage_settings') && <Card title="Publish a status">
      <Form action="/api/v1/status-updates" next={back} label="Publish project status"><input type="hidden" name="subjectType" value="project" /><input type="hidden" name="subjectId" value={id} />
        <Pick label="Health" name="health" options={[{ value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' }, { value: 'off_track', label: 'Off track' }]} /><Area label="Status summary" name="summary" />
        <p className="muted">A published status is your own statement; portfolios show it beside what the work computes and never replace one with the other.</p><Submit>Publish status</Submit></Form>
    </Card>}
    {can('manage_settings') && <Card title="Details">
      <Form action={`/api/v1/projects/${id}/settings`} next={back} label="Project details">
        <Field label="Name" name="name" value={project.name} required /><Area label="Description" name="description" value={project.description} />
        <div className="inline"><Field label="Status" name="status" value={project.status} /><Field label="Starts" name="startDate" type="date" value={project.startDate} /><Field label="Due" name="dueDate" type="date" value={project.dueDate} /></div>
        <Submit>Save details</Submit>
      </Form>
      <h3>Task references</h3>
      <p className="muted">{project.prefix ? `Tasks here are ${project.prefix}-n. Changing the prefix keeps every old reference working.` : 'Give the project a prefix such as MKT and its tasks get references like MKT-1.'}</p>
      <Form action={`/api/v1/projects/${id}/prefix`} next={back} label="Reference prefix"><div className="inline"><Field label="Prefix" name="prefix" value={project.prefix} /><Submit>Set prefix</Submit></div></Form>
    </Card>}
    {can('manage_shares') && <Card title="Sharing">
      <p>{visibilityLabel(project.visibility)}{project.visibility === 'team' ? `, at ${levelLabel(project.teamLevel)}` : project.visibility === 'workspace' ? `, at ${levelLabel(project.workspaceLevel)}` : ''}.</p>
      <form method="get" action={back} className="stack" aria-label="Preview sharing">
        <Pick label="Share with" name="visibility" value={proposal.visibility ?? project.visibility} options={[{ value: 'private', label: 'Private to members' }, { value: 'team', label: 'Team only' }, { value: 'workspace', label: 'Shared with workspace' }]} />
        <Pick label="Team" name="teamId" value={proposal.teamId ?? project.teamId} blank="No team" options={teams} />
        <Pick label="Level for the team" name="teamLevel" value={proposal.teamLevel ?? project.teamLevel} options={levelOptions(['viewer', 'commenter', 'editor'])} />
        <Pick label="Level for the workspace" name="workspaceLevel" value={proposal.workspaceLevel ?? project.workspaceLevel} options={levelOptions(['viewer', 'commenter', 'editor'])} />
        <button type="submit" className="button quiet">Preview who would see it</button>
      </form>
      {preview && <>
        <h3>Preview</h3>
        <ul className="rows">{preview.audience.map((line, i) => <li key={i}><span className="grow">{line.who}{line.note && <><br /><small>{line.note}</small></>}</span><span className="tagline">{levelLabel(line.level)}</span>{line.count !== null && <small>{line.count} people</small>}</li>)}</ul>
        <Form action={`/api/v1/projects/${id}/settings`} next={back} label="Apply sharing">
          {Object.entries(proposal).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <input type="hidden" name="previewRevision" value={preview.revision} />
          <Submit>{preview.broadens ? 'Widen the audience as previewed' : 'Apply this sharing'}</Submit>
        </Form>
      </>}
    </Card>}
    {grants && <Card title="Who has access">
      <ul className="rows">{grants.map(grant => <li key={grant.id}><span className="grow">{grant.grantee}<br /><small>{grant.source === 'request' ? 'Approved request' : 'Granted'} by {grant.by}</small></span><span className="tagline">{levelLabel(grant.level)}</span>{grant.scope !== 'full' && <span className="tagline">{grant.scope === 'approve' ? 'Approve only' : 'Assigned tasks'}</span>}
        <form method="post" action={`/api/v1/grants/${grant.id}/revoke`}><input type="hidden" name="_next" value={back} /><button className="button quiet" type="submit">Revoke</button></form></li>)}
        {grants.length === 0 && <li>Only the project owner and the workspace administrators.</li>}</ul>
      <Form action="/api/v1/grants" next={back} label="Give access">
        <input type="hidden" name="objectType" value="project" /><input type="hidden" name="objectId" value={id} />
        <div className="inline"><Pick label="Person" name="granteeId" options={people} blank="Choose a person" /><Pick label="Level" name="level" value="viewer" options={levelOptions()} /><Submit>Give access</Submit></div>
      </Form>
      <Form action="/api/v1/grants" next={back} label="Give a team access">
        <input type="hidden" name="objectType" value="project" /><input type="hidden" name="objectId" value={id} /><input type="hidden" name="granteeType" value="team" />
        <div className="inline"><Pick label="Team" name="granteeId" options={teams} blank="Choose a team" /><Pick label="Level" name="level" value="viewer" options={levelOptions()} /><Submit>Give the team access</Submit></div>
      </Form>
    </Card>}
    <Card title="Sections and status">
      <ul className="rows">{sectionList.map(section => <li key={section.id}><span className="grow">{section.name}</span><span className="tagline">{mapsLabel(section.mapsTo)}</span>
        {can('manage_fields') && <form method="post" action={`/api/v1/sections/${section.id}/map`}><input type="hidden" name="_next" value={back} /><select className="select" name="mapsTo" defaultValue={section.mapsTo ?? ''} aria-label={`Status for ${section.name}`}><option value="">No status</option><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select><button className="button quiet" type="submit">Map</button></form>}</li>)}</ul>
      {can('edit') && <Form action={`/api/v1/projects/${id}/sections`} next={back} label="Add a section"><div className="inline"><Field label="New section" name="name" /><Submit>Add section</Submit></div></Form>}
    </Card>
    <Card title="Fields">
      <p><a href={`/app/projects/${id}/field-report`}>Open field report</a> · <a href="/app/tags">Tag catalogue and cross-project filters</a></p>
      <ul className="rows">{data.fields.map(field=><li key={field.key}><span className="grow">{field.label} · {field.type} · {field.units}<br/><code>{field.id}</code>{can('manage_fields')&&<p><a href={`/app/fields/${field.id}/revisions`}>Compare and restore revisions</a></p>}{can('manage_fields')&&<details><summary>Change type for {field.label}</summary><form method="get" action={back} className="stack" aria-label={`Preview type for ${field.label}`}><input type="hidden" name="fieldId" value={field.id}/><Pick label="Proposed type" name="type" value={field.type} options={fieldTypes.map(value=>({value,label:value}))}/><Field label="Dropdown options (comma separated)" name="options"/><Field label="Formula expression" name="expression"/><Field label="Rollup source field key" name="sourceKey"/><Submit quiet>Preview type change</Submit></form></details>}</span></li>)}{!data.fields.length&&<li>No project fields.</li>}</ul>
      {fieldPreview&&<><h3>Type change preview</h3><p>{fieldPreview.affected} records across {fieldPreview.projects.length} projects. {fieldPreview.canApply?'Existing values are preserved.':'Incompatible values are preserved; this change cannot be applied.'}</p>{fieldPreview.incompatible.length>0&&<p>Incompatible task IDs: {fieldPreview.incompatible.join(', ')}</p>}{fieldPreview.canApply&&<Form action={`/api/v1/fields/${fieldPreview.fieldId}/change`} next={back} label="Apply field change"><input type="hidden" name="previewRevision" value={fieldPreview.token}/>{Object.entries(fieldPreview.next).map(([key,value])=><input key={key} type="hidden" name={key} value={typeof value==='object'?JSON.stringify(value):value}/>)}<Submit>Apply reviewed field change</Submit></Form>}</>}
      {can('manage_fields')&&<>
      <Form action={`/api/v1/projects/${id}/fields`} next={back} label="Add a field"><div className="inline"><Field label="Key" name="key" required/><Field label="Label" name="label" required/><Pick label="Type" name="type" value="text" options={fieldTypes.map(value=>({value,label:value}))}/><Field label="Units" name="units"/><Pick label="Who reads it" name="visibility" value="everyone" options={[{value:'everyone',label:'Everyone with access'},{value:'internal',label:'Members, not guests'},{value:'editors',label:'Editors and up'},{value:'admins',label:'Admins'}]}/></div><Field label="Dropdown options (comma separated)" name="options"/><Field label="Formula expression" name="expression"/><p className="muted">Formulas use field keys, numbers, parentheses and + − * /. Rollups sum the source field on related tasks selected on the task.</p><Field label="Rollup source field key" name="sourceKey"/><Pick label="Rollup source project" name="sourceProject" options={sourceProjects} blank="This project"/><Submit>Add field</Submit></Form>
      <Form action={`/api/v1/projects/${id}/fields/adopt`} next={back} label="Adopt library field"><Pick label="Shared field" name="fieldId" options={library.filter(f=>!data.fields.some(d=>d.id===f.id)).map(f=>({value:f.id,label:`${f.label} (${f.key})`}))}/><Submit>Use shared field</Submit></Form>
      <Form action={`/api/v1/projects/${id}/statuses`} next={back} label="Define project status"><Field label="Status name" name="name" required/><Pick label="Work state" name="mapsTo" value="doing" options={[{value:'todo',label:'To do'},{value:'doing',label:'Doing'},{value:'done',label:'Done'}]}/><Submit>Add status</Submit></Form>
      </>}
    </Card>
  </Shell>
}
