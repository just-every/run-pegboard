import type { Bindings } from './auth.server'
import { bound } from './pegboard/db'
import { demoComments, demoPeople, demoProjects, demoTasks, demoTimestamp } from './demo-workspace'

// withDemo calls this only in the disposable demo store, after its owner exists.
// Use the work graph's SQL directly: its normal services create random IDs and
// current timestamps. Stable inserts also keep a repeated hook from undoing edits.
export async function seedDemo(env: Bindings, { ownerEmail }: { ownerEmail: string; now: Date }): Promise<void> {
  const db = env.DB
  const owner = await db.prepare("SELECT id FROM oa_operators WHERE email = ? AND role = 'owner'").bind(ownerEmail).first<{ id: string }>()
  if (!owner) throw new Error('Demo owner must exist before seeding the workspace')
  const person = (key: string) => key === 'owner' ? owner.id : `op_demo_${key}`
  const sql = (text: string, ...args: (string | number | null)[]) => bound(db, text, args)
  const statements = [
    sql('INSERT INTO oa_first_run (singleton, completed_by, completed_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO NOTHING', owner.id, demoTimestamp),
    sql("UPDATE oa_operators SET display_name = 'Wes Holloway' WHERE id = ?", owner.id),
    sql("INSERT INTO peg_workspaces(id,name,settings,created_at) VALUES ('ws_main','Holloway Studio','{}',?) ON CONFLICT(id) DO NOTHING", demoTimestamp),
    ...demoPeople.flatMap(([key, name]) => [
      sql("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES (?,?,?,'member','active',1,?) ON CONFLICT(id) DO NOTHING", person(key), `${key}@demo.invalid`, name, demoTimestamp),
      sql("INSERT INTO peg_workspace_members(workspace_id,operator_id,role,created_by,created_at) VALUES ('ws_main',?,'member',?,?) ON CONFLICT(workspace_id,operator_id) DO NOTHING", person(key), owner.id, demoTimestamp),
    ]),
    sql("INSERT INTO peg_teams(id,workspace_id,name,description,privacy,default_level,created_by,created_at) VALUES ('team_demo_studio','ws_main','Brand crew','Design, content and launch delivery.','public','editor',?,?) ON CONFLICT(id) DO NOTHING", owner.id, demoTimestamp),
    ...['owner', ...demoPeople.map(([key]) => key)].map(key => sql("INSERT INTO peg_grants(id,workspace_id,object_type,object_id,grantee_type,grantee_id,level,scope,source,created_by,created_at) VALUES (?,'ws_main','team','team_demo_studio','person',?,?,'full','direct',?,?) ON CONFLICT(id) DO NOTHING", `grant_demo_${key}`, person(key), key === 'owner' ? 'admin' : 'editor', owner.id, demoTimestamp)),
  ]
  for (const project of demoProjects) {
    statements.push(sql("INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,team_id,visibility,team_level,start_date,due_date,created_by,created_at) VALUES (?,'ws_main',?,?,?,'team_demo_studio','team','editor','2026-10-19',?,?,?) ON CONFLICT(id) DO NOTHING", project.id, project.name, project.description, owner.id, project.dueDate, owner.id, demoTimestamp))
    for (const [position, [status, label]] of [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']].entries()) {
      statements.push(sql('INSERT INTO peg_sections(id,project_id,name,position,maps_to) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${project.id}_${status}`, project.id, label, position, status))
    }
  }
  for (const [position, task] of demoTasks.entries()) {
    statements.push(
      sql("INSERT INTO peg_tasks(id,workspace_id,title,description,status,priority,start_date,due_date,owner_id,creator_id,estimate_hours,created_at,updated_at,completed_at) VALUES (?,'ws_main',?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", task.id, task.title, task.description, task.status, task.priority, '2026-10-19', task.dueDate, person(task.assignee), owner.id, task.hours, demoTimestamp, demoTimestamp, task.status === 'done' ? demoTimestamp : null),
      sql('INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES (?,?,?,?,?,?) ON CONFLICT(task_id,project_id) DO NOTHING', task.id, task.projectId, `${task.projectId}_${task.status}`, position, owner.id, demoTimestamp),
      sql("INSERT INTO peg_history(task_id,at,actor_id,kind,detail) SELECT ?,?,?,'created',? WHERE NOT EXISTS (SELECT 1 FROM peg_history WHERE task_id=? AND kind='created')", task.id, demoTimestamp, owner.id, JSON.stringify({ kind: 'task', parentId: null }), task.id),
    )
  }
  for (const comment of demoComments) {
    statements.push(
      sql('INSERT INTO peg_comments(id,task_id,project_id,author_id,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', comment.id, comment.taskId, comment.projectId, person(comment.author), comment.body, demoTimestamp + 3_600_000),
      sql("INSERT INTO peg_history(task_id,at,actor_id,kind,detail) SELECT ?,?,?,'comment.added','{}' WHERE NOT EXISTS (SELECT 1 FROM peg_history WHERE task_id=? AND kind='comment.added' AND actor_id=?)", comment.taskId, demoTimestamp + 3_600_000, person(comment.author), comment.taskId, person(comment.author)),
    )
  }
  await db.batch(statements)
}
