import type {Viewer} from '../../../ui/viewer'
import type {suggestionView} from '../../rules/suggestions'
import {Area,Card,Form,Shell,Submit,when} from '../shell'
export function RuleSuggestionsPage({viewer,view}:{viewer:Viewer;view:Awaited<ReturnType<typeof suggestionView>>}){
 const here=`/app/projects/${view.project.id}/rule-suggestions`
 return <Shell viewer={viewer} current="/app/projects" title="Ask your project Admin" facts={[view.project.name]}>
 <Card title="Responsible project Admins"><p>{view.responsible.map(p=>p.name).join(', ')||'No current Admin is available.'}</p><p>A suggestion requests a review. It creates no rule, grants no access and sends no external message.</p><a href={`/app/projects/${view.project.id}/settings`}>Back to project settings</a></Card>
 <Card title="Suggest a work rule"><Form action={`/api/v1/projects/${view.project.id}/rule-suggestions`} next={here} label="Suggest a work rule"><Area label="Rule suggestion" name="message"/><Submit>Submit suggestion</Submit></Form></Card>
 <Card title="Request state"><ul className="rows">{view.requests.map(request=><li key={request.id}><span className="grow">{request.message}<br/>{request.status} · {when(request.created_at)}{request.reviewed_by&&<> · reviewed by {view.responsible.find(p=>p.id===request.reviewed_by)?.name??'Former Admin'}</>}{view.admin&&request.status==='submitted'&&<Form action={`/api/v1/rule-suggestions/${request.id}/review`} next={here} label="Record suggestion review"><Submit quiet>Mark reviewed</Submit></Form>}</span></li>)}</ul></Card>
 </Shell>
}
