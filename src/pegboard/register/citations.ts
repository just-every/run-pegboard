import { all, bound, invalid, type Param } from '../db'
import { registerView } from './records'
import type { Actor } from '../workspace/people'
export async function recordCitations(db:D1Database,actor:Actor,statusId:string){
 const links=await all<{record_id:string;project_id:string}>(db,'SELECT r.id record_id,r.project_id FROM peg_status_delivery_records s JOIN peg_delivery_records r ON r.id=s.record_id WHERE s.status_id=?',statusId),out=[]
 for(const link of links)try{const record=(await registerView(db,actor,link.project_id)).records.find(r=>r.id===link.record_id);if(record)out.push({id:record.id,title:record.title,kind:record.kind,link:`/app/projects/${link.project_id}/register#${record.id}`})}catch{}
 return out
}
export async function citationStatements(db:D1Database,actor:Actor,statusId:string,type:string,subject:string,ids:unknown){
 if(ids===undefined||ids===null||ids==='')return []
 const selected=Array.isArray(ids)?ids:[ids]
 if(selected.length>50||selected.some(id=>typeof id!=='string'))throw invalid('delivery_records')
 const projectIds=type==='project'?[subject]:(await all<{project_id:string}>(db,`WITH RECURSIVE family(id) AS (SELECT ? UNION ALL SELECT p.id FROM peg_portfolios p JOIN family f ON p.parent_id=f.id) SELECT DISTINCT project_id FROM peg_portfolio_projects WHERE portfolio_id IN (SELECT id FROM family)`,subject)).map(r=>r.project_id)
 const allowed=new Set<string>()
 for(const projectId of projectIds)try{for(const record of (await registerView(db,actor,projectId)).records)allowed.add(record.id)}catch{}
 if(selected.some(id=>!allowed.has(id)))throw invalid('delivery_records')
 return [...new Set<string>(selected)].map(id=>bound(db,'INSERT INTO peg_status_delivery_records(status_id,record_id) VALUES(?,?)',[statusId,id] as Param[]))
}
