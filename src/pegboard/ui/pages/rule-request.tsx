import type {Viewer} from '../../../ui/viewer'
import {Card,Field,Form,Shell,Submit} from '../shell'
export function RuleRequestPage({viewer,project,requestKey}:{viewer:Viewer;project:{id:string;name:string};requestKey:string}){
 return <Shell viewer={viewer} current="/app/projects" title="Submit project request" facts={[project.name,'Internal project form']}>
 <Card title="Request work"><p>Your request creates a task in this project. Activated form rules apply their reviewed assignments and dates. Retrying this submission creates no duplicate work.</p><Form action={`/api/v1/projects/${project.id}/requests`} next={`/app/projects/${project.id}`} label="Submit project request"><input type="hidden" name="requestKey" value={requestKey}/><Field label="Request title" name="title" required/><Field label="Requested start date" name="startDate" type="date"/><Field label="Requested due date" name="dueDate" type="date"/><Submit>Submit request</Submit></Form><a href={`/app/projects/${project.id}/settings`}>Back to project settings</a></Card>
 </Shell>
}
