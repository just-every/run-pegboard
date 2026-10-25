import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { recoveryList, recoveryPreview, setRecovery } from '../recovery'
export function recoveryRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/recovery',door(({db,actor,workspace})=>recoveryList(db,actor,workspace)))
 app.post('/recovery/preview',door(({db,actor,workspace,input})=>recoveryPreview(db,actor,workspace,input)))
 app.post('/recovery/apply',door(({db,actor,workspace,input})=>setRecovery(db,actor,workspace,input),{next:()=>'/app/recovery'}))
}
