import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {previewConversion,applyConversion} from '../conversion/service'
import {conversionView} from '../conversion/operations'
import {undoConversionPreview,undoConversion} from '../conversion/undo'

export function conversionRoutes(app:Hono<{Bindings:Bindings}>){
 app.post('/conversions/preview',door(({db,actor,workspace,input})=>previewConversion(db,actor,workspace,input)))
 app.post('/conversions/apply',door(({db,actor,workspace,input})=>applyConversion(db,actor,workspace,input),{next:r=>`/app/conversions/${r.id}`}))
 app.get('/conversions/:id',door(({db,actor,params})=>conversionView(db,actor,params.id)))
 app.post('/conversions/:id/undo/preview',door(({db,actor,workspace,params})=>undoConversionPreview(db,actor,workspace,params.id)))
 app.post('/conversions/:id/undo',door(({db,actor,workspace,params,input})=>undoConversion(db,actor,workspace,params.id,input),{next:r=>`/app/conversions/${r.id}`}))
}
