import {all,bound,invalid,newId,notFound,run,now} from '../db'
import {searchInput,type SearchInput} from './content'
import {workspaceRole,type Actor} from '../workspace/people'
interface Saved {id:string;name:string;filters:string}
export async function savedSearches(db:D1Database,actor:Actor,workspace:string){
 if(!await workspaceRole(db,actor.id,workspace))throw notFound()
 return (await all<Saved>(db,'SELECT id,name,filters FROM peg_saved_searches WHERE workspace_id=? AND owner_id=? ORDER BY created_at,id',workspace,actor.id)).map(row=>({...row,filters:searchInput(JSON.parse(row.filters))}))
}
export async function saveSearch(db:D1Database,actor:Actor,workspace:string,input:SearchInput&{name?:unknown}){
 if(!await workspaceRole(db,actor.id,workspace))throw notFound()
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw invalid('search_name')
 const filters=searchInput(input),id=newId('search')
 await run(db,'INSERT INTO peg_saved_searches VALUES(?,?,?,?,?,?)',id,workspace,actor.id,input.name.trim(),JSON.stringify(filters),now())
 return {id}
}
export async function removeSearch(db:D1Database,actor:Actor,workspace:string,id:string){
 if(!(await savedSearches(db,actor,workspace)).some(row=>row.id===id))throw notFound()
 await db.batch([bound(db,'DELETE FROM peg_saved_searches WHERE id=? AND owner_id=?',[id,actor.id])]);return {id}
}
