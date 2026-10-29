import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {mergePreview} from '../merge/preview'
import {applyMerge,mergeView,mergeUndoPreview,undoMerge} from '../merge/execution'
import {duplicatePreview,markDuplicate} from '../merge/duplicates'
export function mergeRoutes(app:Hono<{Bindings:Bindings}>){
 app.post('/task-merges/preview',door(({db,actor,workspace,input})=>mergePreview(db,actor,workspace,input)))
 app.post('/task-merges',door(({db,actor,workspace,input})=>applyMerge(db,actor,workspace,input),{next:r=>`/app/task-merges/${r.id}`}))
 app.get('/task-merges/:id',door(({db,actor,workspace,params})=>mergeView(db,actor,workspace,params.id)))
 app.get('/task-merges/:id/undo-preview',door(({db,actor,workspace,params})=>mergeUndoPreview(db,actor,workspace,params.id)))
 app.post('/task-merges/:id/undo',door(({db,actor,workspace,params,input})=>undoMerge(db,actor,workspace,params.id,input),{next:r=>`/app/tasks/${r.survivorId}`}))
 app.post('/task-duplicates/preview',door(({db,actor,workspace,input})=>duplicatePreview(db,actor,workspace,input)))
 app.post('/task-duplicates',door(({db,actor,workspace,input})=>markDuplicate(db,actor,workspace,input),{next:r=>`/app/tasks/${r.id}`}))
}
