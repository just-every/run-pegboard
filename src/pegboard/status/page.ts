import { all, notFound, PegError } from '../db'
import type { Actor } from '../workspace/people'
import { workspaceRole, displayNames } from '../workspace/people'
import { openTask } from '../tasks/access'
import { readDraft, readRevision, reviewDraft, statusAccess, statusHistory } from './drafts'
import { statusSubscription } from './subscriptions'

export async function statusPage(db: D1Database, actor: Actor, type: string, id: string, query: URLSearchParams) {
  const { workspace } = await statusAccess(db, actor, type, id)
  let manage = false
  try { await statusAccess(db, actor, type, id, true); manage = ['owner','admin','manager','member'].includes(await workspaceRole(db,actor.id,workspace) ?? '') } catch (error) { if (!(error instanceof PegError && error.status === 403)) throw error }
  const history = await statusHistory(db,actor,type,id)
  const sources: {value:string;label:string}[] = [], drafts = []
  let selected = null, review = null, correction = null
  if (manage) {
    const projects = type === 'project' ? [id] : (await all<{project_id:string}>(db,`WITH RECURSIVE family(id) AS (SELECT ? UNION ALL SELECT p.id FROM peg_portfolios p JOIN family f ON p.parent_id=f.id) SELECT project_id FROM peg_portfolio_projects WHERE portfolio_id IN (SELECT id FROM family)`,id)).map(p=>p.project_id)
    for (const task of await all<{id:string}>(db,'SELECT id FROM peg_tasks WHERE workspace_id=? ORDER BY title,id',workspace)) {
      try {
        const opened = await openTask(db,actor,task.id)
        if ([...opened.access.contexts.keys()].some(project=>projects.includes(project))) sources.push({value:task.id,label:opened.task.title})
      } catch (error) { if (!(error instanceof PegError && [403,404].includes(error.status))) throw error }
    }
    for (const row of await all<{id:string}>(db,'SELECT id FROM peg_status_drafts WHERE subject_type=? AND subject_id=? ORDER BY updated_at DESC,id',type,id)) {
      try { drafts.push(await readDraft(db,actor,row.id)) } catch(error) { if (!(error instanceof PegError && error.code === 'status_rights_custody_review')) throw error }
    }
    if(query.get('draft')) {
      selected = await readDraft(db,actor,query.get('draft')!)
      if(selected.subjectType !== type || selected.subjectId !== id) throw notFound()
      if(query.has('review')) review = await reviewDraft(db,actor,selected.id)
    }
    if(query.get('corrects')) {
      correction = await readRevision(db,actor,query.get('corrects')!)
      if(correction.subjectType !== type || correction.subjectId !== id) throw notFound()
    }
  }
  const role = await workspaceRole(db,actor.id,workspace)
  const subscription = ['owner','admin','manager','member'].includes(role ?? '') ? await statusSubscription(db,actor,type,id) : null
  const names = await displayNames(db,[...history.revisions.flatMap(r=>[r.reviewedBy,...r.receipts.map(p=>p.recipient_id)]),...(selected?.recipients.map(r=>r.id) ?? [])])
  return {type,id,workspace,manage,history:history.revisions,sources,drafts,selected,review,correction,subscription,names:Object.fromEntries(names)}
}
