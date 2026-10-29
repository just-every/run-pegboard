import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { invalid } from '../db'
import { captureReport, createDashboard, dashboards, readSnapshot } from '../reporting/dashboard'
import { reportCsv, reportPdf, reportXlsx } from '../reporting/exports'
export function reportingRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/reports',door(async d=>({dashboards:await dashboards(d.db,d.actor,d.workspace)})))
 app.post('/reports',door(d=>createDashboard(d.db,d.actor,d.workspace,d.input),{next:(r)=>`/app/reports/${r.id}`}))
 app.post('/reports/:id/capture',door(d=>captureReport(d.db,d.actor,d.workspace,d.params.id),{next:r=>`/app/reports/${r.dashboardId}?snapshot=${r.id}`}))
 app.get('/reports/:id/snapshots/:snapshot',door(async d=>{
  const report=await readSnapshot(d.db,d.actor,d.workspace,d.params.id,d.params.snapshot),format=d.query.get('format')
  if(!format)return report
  if(!['csv','xlsx','pdf'].includes(format))throw invalid('report_format')
  const body=format==='csv'?reportCsv(report):format==='xlsx'?reportXlsx(report):reportPdf(report)
  return new Response(body,{headers:{'content-type':format==='csv'?'text/csv; charset=utf-8':format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf','content-disposition':`attachment; filename="${report.id}.${format}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}})
 }))
}
