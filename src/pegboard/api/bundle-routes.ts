import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {bundleView,createBundle,listBundles,loadBundle,versionBundle} from '../bundles/definitions'
import {adoptBundle,disableBundle,overrideRule,previewBundle} from '../bundles/adoption'
import {bundleConfiguration,instantiateBundle} from '../bundles/execution'
import {processBundleJobs} from '../bundles/queue'
export function bundleRoutes(app:Hono<{Bindings:Bindings}>){
 const next=(_:unknown,{params}:{params:Record<string,string>})=>`/app/workflow-bundles/${params.id}`
 app.get('/workflow-bundles',door(({db,actor,workspace})=>listBundles(db,actor,workspace).then(bundles=>({bundles}))))
 app.post('/workflow-bundles',door(({db,actor,workspace,input})=>createBundle(db,actor,workspace,input),{next:r=>`/app/workflow-bundles/${r.id}`}))
 app.get('/workflow-bundles/:id',door(({db,actor,params})=>bundleView(db,actor,params.id)))
 app.post('/workflow-bundles/:id/versions',door(({db,actor,params,input})=>versionBundle(db,actor,params.id,input),{next}))
 app.post('/workflow-bundles/:id/preview',door(({db,actor,params,input})=>previewBundle(db,actor,params.id,input)))
 app.post('/workflow-bundles/:id/adopt',door(({db,actor,params,input})=>adoptBundle(db,actor,params.id,input),{next}))
 app.post('/workflow-bundles/:id/projects/:project/override',door(({db,actor,params,input})=>overrideRule(db,actor,params.id,params.project,input),{next}))
 app.post('/workflow-bundles/:id/projects/:project/disable',door(({db,actor,params})=>disableBundle(db,actor,params.id,params.project),{next}))
 app.post('/workflow-bundles/:id/jobs/process',door(async({db,actor,params})=>{await loadBundle(db,actor,params.id);return processBundleJobs(db,params.id)},{next}))
 app.get('/projects/:id/bundle-configuration',door(({db,actor,params})=>bundleConfiguration(db,actor,params.id)))
 app.post('/workflow-bundles/:id/projects/:project/start',door(({db,actor,params,input})=>instantiateBundle(db,actor,params.id,params.project,input),{next:r=>`/app/tasks/${r.taskId}`}))
}
