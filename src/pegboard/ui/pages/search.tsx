import type {Viewer} from '../../../ui/viewer'
import type {contentSearch} from '../../search/content'
import type {savedSearches} from '../../search/saved'
import type {workMarks} from '../../search/marks'
import {Card,Check,Field,Form,Pick,Shell,Submit} from '../shell'
type Search=Awaited<ReturnType<typeof contentSearch>>
export function SearchPage({viewer,data,saved,marks,projects,people}:{viewer:Viewer;data:Search;saved:Awaited<ReturnType<typeof savedSearches>>;marks:Awaited<ReturnType<typeof workMarks>>;projects:{value:string;label:string}[];people:{value:string;label:string}[]}){
 const query=new URLSearchParams(data.filters).toString()
 return <Shell viewer={viewer} current="/app/search" title="Find work" facts={['Search the work you can currently open']}>
  <Card title="Search content"><form method="get" action="/app/search" className="stack" aria-label="Search work">
   <Field label="Words or reference" name="q" value={data.filters.q}/>
   <Pick label="Work type" name="kind" value={data.filters.kind} blank="All content" options={['task','approval','project','brief'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))}/>
   <Pick label="Status" name="status" value={data.filters.status} blank="Any status" options={['todo','doing','done'].map(value=>({value,label:value}))}/>
   <Pick label="Project" name="projectId" value={data.filters.projectId} blank="All permitted projects" options={projects}/>
   <Pick label="Owner" name="ownerId" value={data.filters.ownerId} blank="Any owner" options={people}/>
   <Pick label="Priority" name="priority" value={data.filters.priority} blank="Any priority" options={['low','normal','high','urgent'].map(value=>({value,label:value}))}/>
   <Submit>Search work</Submit>
  </form></Card>
  <Card title="Matching work"><p role="status">{data.count} permitted results</p>
   <form method="get" action="/app/recovery/bulk" className="stack" aria-label="Change selected search results"><input type="hidden" name="selection" value="1"/>
    <ul className="rows" aria-label="Search results">{data.results.map(row=><li key={row.type+row.id} data-result-id={row.id}><span className="grow">{row.type==='task'&&<Check name="taskIds[]" value={row.id} label={'Select '+row.title}/>}<a href={row.href}>{row.title}</a><p>{row.matches.join(' · ')}{row.status?' · '+row.status:''}{row.priority?' · '+row.priority:''}{row.type==='task'&&!row.editable?' · Read only':''}</p></span></li>)}</ul>
    {!data.results.length&&<p>No matching work is available.</p>}
    {data.results.some(row=>row.type==='task')&&<><Pick label="New owner" name="ownerId" blank="Keep current owner" options={people}/><Pick label="New priority" name="priority" blank="Keep current priority" options={['low','normal','high','urgent'].map(value=>({value,label:value}))}/><Field label="New due date" name="dueDate" type="date"/><Submit>Review selected changes</Submit></>}
   </form>
   <p><a href={'/api/v1/search/export?'+query}>Download current results</a></p>
   {data.next&&<a href={'/app/search?'+query+'&after='+encodeURIComponent(data.next)}>Next results</a>}
  </Card>
  <Card title="Favorites and recent work"><h3>Favorites</h3><ul className="rows" aria-label="Favorite work">{marks.favorites.map(row=><li key={row.id}><a className="grow" href={row.href}>{row.title}</a><Form action="/api/v1/search/favorite" next="/app/search" label={'Unfavorite '+row.title}><input type="hidden" name="taskId" value={row.id}/><input type="hidden" name="favorite" value="0"/><Submit quiet>Remove favorite</Submit></Form></li>)}</ul><Form action="/api/v1/search/favorite" next={'/app/search?'+query} label="Favorite a result"><Pick label="Task to favorite" name="taskId" blank="Choose a result" options={data.results.filter(r=>r.type==='task').map(r=>({value:r.id,label:r.title}))}/><input type="hidden" name="favorite" value="1"/><Submit quiet>Add favorite</Submit></Form><h3>Recent work</h3><ul className="rows" aria-label="Recent work">{marks.recent.map(row=><li key={row.id}><a href={row.href}>{row.title}</a></li>)}</ul></Card>
  <Card title="Quick add"><p>Alt+F finds work. Alt+N focuses a new task. Alt+S selects the displayed tasks.</p><Form action="/api/v1/tasks" next="/app/search" label="Quick add task"><Field label="New task title" name="title" required/><Pick label="Project for new task" name="projectId" blank="Private personal task" options={projects}/><Submit quiet>Create task</Submit></Form></Card>
  <Card title="Saved searches"><Form action="/api/v1/search/saved" next={'/app/search?'+query} label="Save this search">{Object.entries(data.filters).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}<Field label="Search name" name="name" required/><Submit quiet>Save search</Submit></Form>
   <ul className="rows" aria-label="Saved searches">{saved.map(row=><li key={row.id}><a className="grow" href={'/app/search?'+new URLSearchParams(row.filters).toString()}>{row.name}</a><Form action={`/api/v1/search/saved/${row.id}/remove`} next="/app/search" label={'Remove '+row.name}><Submit quiet>Remove search</Submit></Form></li>)}</ul>
  </Card>
 </Shell>
}
