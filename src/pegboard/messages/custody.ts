import { all, placeholders } from '../db'
/** An exact owner review removes a whole affected conversation, including immutable copied text.
 * Every related person, project and work link participates in hold review. No snapshot exemption is added.
 */
export async function messageErasureScope(db:D1Database,type:string,id:string,tasks:string[],projects:string[]) {
 const publications=await all<{id:string;root_id:string;draft_id:string;project_id:string;author_id:string;recipients:string;links:string}>(db,'SELECT * FROM peg_message_publications ORDER BY id')
 const drafts=await all<{id:string;project_id:string;author_id:string;recipients:string;links:string;corrects_id:string|null}>(db,'SELECT * FROM peg_message_drafts ORDER BY id')
 const authors=type==='person'?new Set((await all<{root_id:string}>(db,'SELECT root_id FROM peg_message_comments WHERE author_id=?',id)).map(c=>c.root_id)):new Set<string>()
 const affected=(r:{project_id:string;author_id:string;recipients:string;links:string})=>projects.includes(r.project_id)||JSON.parse(r.links).some((s:any)=>tasks.includes(s.id))||type==='person'&&(r.author_id===id||JSON.parse(r.recipients).includes(id))
 const roots=new Set(publications.filter(p=>affected(p)||authors.has(p.root_id)).map(p=>p.root_id))
 const selected=publications.filter(p=>roots.has(p.root_id)), selectedDrafts=drafts.filter(d=>affected(d)||selected.some(p=>p.draft_id===d.id||p.id===d.corrects_id))
 // Related drafts may include a correction not published yet, so include all roots they correct.
 for(const d of selectedDrafts)if(d.corrects_id){const p=publications.find(p=>p.id===d.corrects_id);if(p)roots.add(p.root_id)}
 const complete=publications.filter(p=>roots.has(p.root_id))
 const draftIds=[...new Set([...selectedDrafts.map(d=>d.id),...complete.map(p=>p.draft_id)])].sort()
 const rows=[...complete,...drafts.filter(d=>draftIds.includes(d.id))]
 const comments=await all<{author_id:string}>(db,`SELECT author_id FROM peg_message_comments WHERE root_id IN (${placeholders([...roots])})`,...[...roots])
 return {roots:[...roots].sort(),drafts:draftIds,projects:[...new Set(rows.map(r=>r.project_id))],tasks:[...new Set(rows.flatMap(r=>JSON.parse(r.links).map((s:any)=>s.id))) ] as string[],people:[...new Set([...rows.flatMap(r=>[r.author_id,...JSON.parse(r.recipients)]),...comments.map(c=>c.author_id)])] as string[]}
}
