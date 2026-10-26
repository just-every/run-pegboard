import {all,conflict,invalid} from '../db'
import {digest} from '../decisions/revision'
import {changePreview,changeDefinition} from '../fields/values'
import {displayNames,type Actor} from '../workspace/people'
export async function fieldRevisionView(db:D1Database,actor:Actor,id:string){
 const current=await changePreview(db,actor,id,{}),rows=await all<{version:number;snapshot:string;actor_id:string|null;created_at:number}>(db,'SELECT * FROM peg_field_versions WHERE field_id=? ORDER BY version DESC',id),names=await displayNames(db,rows.flatMap(r=>r.actor_id?[r.actor_id]:[]))
 return {fieldId:id,current:current.next,versions:rows.map(r=>({version:r.version,snapshot:JSON.parse(r.snapshot),actor:r.actor_id?names.get(r.actor_id)??'Former member':'Earlier retained definition',at:r.created_at}))}
}
export async function fieldRevisionPreview(db:D1Database,actor:Actor,id:string,input:Record<string,unknown>){
 const view=await fieldRevisionView(db,actor,id),fromVersion=Number(input.fromVersion),source=view.versions.find(v=>v.version===fromVersion)
 if(!Number.isSafeInteger(fromVersion)||!source)throw invalid('field_revision')
 const validation=await changePreview(db,actor,id,source.snapshot)
 const plan={fieldId:id,fromVersion,current:view.current,restored:validation.next,canApply:validation.canApply,incompatible:validation.incompatible,affected:validation.affected,projects:validation.projects,validation,changed:JSON.stringify(view.current)!==JSON.stringify(validation.next)}
 return {...plan,token:await digest([actor.id,plan])}
}
export async function restoreFieldRevision(db:D1Database,actor:Actor,id:string,input:Record<string,unknown>){
 const preview=await fieldRevisionPreview(db,actor,id,input)
 if(input.token!==preview.token)throw conflict('field_revision_review_changed')
 if(!preview.changed)throw conflict('field_revision_unchanged')
 if(!preview.canApply)throw conflict('incompatible_values_preserved')
 await changeDefinition(db,actor,id,{...preview.restored,previewRevision:preview.validation.token})
 return {id,restoredFrom:preview.fromVersion}
}
