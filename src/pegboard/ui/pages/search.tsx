import type {Viewer} from '../../../ui/viewer'
import type {contentSearch} from '../../search/content'
import type {savedSearches} from '../../search/saved'
import {Card,Check,Field,Form,Pick,Shell,Submit} from '../shell'
type Search=Awaited<ReturnType<typeof contentSearch>>
export function SearchPage({viewer,data,saved,projects}:{viewer:Viewer;data:Search;saved:Awaited<ReturnType<typeof savedSearches>>;projects:{value:string;label:string}[]}){
 const query=new URLSearchParams(data.filters).toString()
 return <Shell viewer={viewer} current="/app/search" title="Find work" facts={['Search the work you can currently open']}>
  <Card title="Search content"><form method="get" action="/app/search" className="stack" aria-label="Search work">
   <Field label="Words or reference" name="q" value={data.filters.q}/>
   <Pick label="Work type" name="kind" value={data.filters.kind} blank="All content" options={['task','approval','project','brief'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))}/>
   <Pick label="Status" name="status" value={data.filters.status} blank="Any status" options={['todo','doing','done'].map(value=>({value,label:value}))}/>
   <Pick label="Project" name="projectId" value={data.filters.projectId} blank="All permitted projects" options={projects}/>
   <Pick label="Priority" name="priority" value={data.filters.priority} blank="Any priority" options={['low','normal','high','urgent'].map(value=>({value,label:value}))}/>
   <Submit>Search work</Submit>
  </form></Card>
  <Card title="Matching work"><p role="status">{data.count} permitted results</p>
   <form method="get" action="/app/recovery/bulk" className="stack" aria-label="Change selected search results"><input type="hidden" name="selection" value="1"/>
    <ul className="rows" aria-label="Search results">{data.results.map(row=><li key={row.type+row.id} data-result-id={row.id}><span className="grow">{row.type==='task'&&<Check name="taskIds[]" value={row.id} label={'Select '+row.title}/>}<a href={row.href}>{row.title}</a><p>{row.matches.join(' · ')}{row.status?' · '+row.status:''}{row.priority?' · '+row.priority:''}{row.type==='task'&&!row.editable?' · Read only':''}</p></span></li>)}</ul>
    {!data.results.length&&<p>No matching work is available.</p>}
    {data.results.some(row=>row.type==='task')&&<><Pick label="New priority" name="priority" blank="Keep current priority" options={['low','normal','high','urgent'].map(value=>({value,label:value}))}/><Field label="New due date" name="dueDate" type="date"/><Submit>Review selected changes</Submit></>}
   </form>
   <p><a href={'/api/v1/search/export?'+query}>Download current results</a></p>
   {data.next&&<a href={'/app/search?'+query+'&after='+encodeURIComponent(data.next)}>Next results</a>}
  </Card>
  <Card title="Saved searches"><Form action="/api/v1/search/saved" next={'/app/search?'+query} label="Save this search">{Object.entries(data.filters).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}<Field label="Search name" name="name" required/><Submit quiet>Save search</Submit></Form>
   <ul className="rows" aria-label="Saved searches">{saved.map(row=><li key={row.id}><a className="grow" href={'/app/search?'+new URLSearchParams(row.filters).toString()}>{row.name}</a><Form action={`/api/v1/search/saved/${row.id}/remove`} next="/app/search" label={'Remove '+row.name}><Submit quiet>Remove search</Submit></Form></li>)}</ul>
  </Card>
 </Shell>
}
