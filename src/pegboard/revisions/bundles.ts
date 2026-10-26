import {all,bound,conflict,invalid,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {loadBundle,type Component} from '../bundles/definitions'
import {bundleHistory} from '../bundles/adoption'
import {permanentEvent} from '../audit/search'
import type {Actor} from '../workspace/people'
interface Version {version:number;components:string}
export async function bundleRevisionPreview(db:D1Database,actor:Actor,id:string,input:Record<string,unknown>){
 const rev=await revision(db),bundle=await loadBundle(db,actor,id),versions=await all<Version>(db,'SELECT version,components FROM peg_bundle_versions WHERE bundle_id=? ORDER BY version DESC',id)
 const fromVersion=Number(input.fromVersion),key=String(input.component??'')
 if(!Number.isSafeInteger(fromVersion)||fromVersion<1||!/^([a-z][a-z0-9_-]*)$/.test(key)||key.length>60)throw invalid('bundle_revision')
 const source=versions.find(v=>v.version===fromVersion),current=versions[0]
 if(!source)throw invalid('bundle_revision')
 const before=JSON.parse(current.components) as Record<string,Component>,sourceComponents=JSON.parse(source.components) as Record<string,Component>,restored=sourceComponents[key]
 if(!Object.prototype.hasOwnProperty.call(sourceComponents,key)||!restored)throw invalid('bundle_revision_component')
 const plan={bundleId:id,fromVersion,currentVersion:current.version,component:key,current:before[key]??null,restored,changed:JSON.stringify(before[key])!==JSON.stringify(restored),preserves:'Only this component changes in a new revision. Existing work, activated project configuration and separate approvals stay in place.'}
 return {...plan,rev,token:await digest([actor.id,rev,plan])}
}
export async function restoreBundleRevision(db:D1Database,actor:Actor,id:string,input:Record<string,unknown>){
 const preview=await bundleRevisionPreview(db,actor,id,input)
 if(input.token!==preview.token)throw conflict('bundle_revision_review_changed')
 if(!preview.changed)throw conflict('bundle_revision_unchanged')
 const bundle=await loadBundle(db,actor,id),current=(await all<Version>(db,'SELECT version,components FROM peg_bundle_versions WHERE bundle_id=? ORDER BY version DESC LIMIT 1',id))[0]
 const version=current.version+1,components={...JSON.parse(current.components),[preview.component]:preview.restored}
 await guarded(db,preview.rev,[bound(db,'INSERT INTO peg_bundle_versions VALUES(?,?,?,?,?)',[id,version,JSON.stringify(components),actor.id,now()]),bundleHistory(db,id,'',actor.id,'component.restored',{fromVersion:preview.fromVersion,component:preview.component,version}),permanentEvent(db,{workspace:bundle.workspace_id,actor:actor.id,action:'workflow.revision_restored',type:'workflow',id,metadata:{count:1}})])
 return {id,version,restoredFrom:preview.fromVersion,component:preview.component}
}
