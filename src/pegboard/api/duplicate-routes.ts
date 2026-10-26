import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {sourceDuplication} from '../duplication/source'
import {previewDuplicate} from '../duplication/preview'
import {duplicateProject,duplicateResult} from '../duplication/execution'
import {previewDuplicateActivation,activateDuplicate} from '../duplication/activation'

export function duplicateRoutes(app:Hono<{Bindings:Bindings}>){
 app.get('/projects/:id/duplicate-source',door(({db,actor,params})=>sourceDuplication(db,actor,params.id)))
 app.post('/projects/:id/duplicate/preview',door(({db,actor,params,input})=>previewDuplicate(db,actor,params.id,input)))
 app.post('/projects/:id/duplicate',door(({db,actor,params,input})=>duplicateProject(db,actor,params.id,input),{next:r=>`/app/projects/${r.project.id}/duplicate?result=1`}))
 app.get('/projects/:id/duplicate-result',door(({db,actor,params})=>duplicateResult(db,actor,params.id)))
 app.post('/projects/:id/duplicate-review/preview',door(({db,actor,params,input})=>previewDuplicateActivation(db,actor,params.id,input)))
 app.post('/projects/:id/duplicate-review/activate',door(({db,actor,params,input})=>activateDuplicate(db,actor,params.id,input),{next:r=>`/app/projects/${r.project.id}/duplicate?result=1`}))
}
