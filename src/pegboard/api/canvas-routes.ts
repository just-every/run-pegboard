import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { addCanvasNode, canvasView, promoteCanvasNode, updateCanvasNode } from '../canvas/nodes'
import { need, openProject } from '../workspace/projects'
import { forbidden } from '../db'
import { door, flag, json } from './door'

export function canvasRoutes(app:Hono<{Bindings:Bindings}>) {
 const path='/projects/:id/canvas',next=(_:unknown,{params}:{params:Record<string,string>})=>`/app/projects/${params.id}/canvas`
 app.get(path,door(({db,actor,params})=>canvasView(db,actor,params.id)))
 app.get(path+'/export',door(async({db,actor,params})=>{
  const {effective}=await openProject(db,actor,params.id);need(effective,'export')
  const view=await canvasView(db,actor,params.id);if(!view.canExport)throw forbidden('export')
  const response=json(view);response.headers.set('content-disposition','attachment; filename="planning-canvas.json"');return response
 }))
 app.post(path+'/nodes',door(({db,actor,params,input})=>addCanvasNode(db,actor,params.id,{...input,internalOnly:flag(input.internalOnly)}),{next}))
 app.post(path+'/nodes/:node/update',door(({db,actor,params,input})=>updateCanvasNode(db,actor,params.id,params.node,input),{next}))
 app.post(path+'/nodes/:node/promote',door(({db,actor,params,input})=>promoteCanvasNode(db,actor,params.id,params.node,{...input,confirm:flag(input.confirm)}),{next}))
}
