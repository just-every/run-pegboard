import { invalid } from '../db'
export const widgetKinds = ['horizontal-bar', 'vertical-column', 'line', 'donut', 'single-number', 'table', 'burn-up', 'burn-down'] as const
export const measures = ['count', 'effort', 'completed', 'overdue', 'throughput', 'cycle-hours', 'status-age-hours'] as const
export type Measure = typeof measures[number]
export interface Definition { projects: string[]; start: string; end: string; timezone: string; status: string; widgets: { kind: typeof widgetKinds[number]; measure: Measure }[] }
export function definition(input: Record<string, any>): Definition {
 const projects = [...new Set<string>(Array.isArray(input.projects) ? input.projects.map(String) : String(input.projects ?? '').split(',').filter(Boolean))]
 const start=String(input.start??''),end=String(input.end??''),timezone=String(input.timezone??''),status=String(input.status??'all')
 if(!projects.length||projects.length>50||!['all','todo','doing','done'].includes(status))throw invalid('report_scope')
 for(const day of [start,end])if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw invalid('report_dates')
 if(start>end||(Date.parse(end)-Date.parse(start))/86400000>366)throw invalid('report_window')
 try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(0)}catch{throw invalid('report_timezone')}
 const widgets = input.widgets ?? widgetKinds.map(kind=>({kind,measure:input['measure:'+kind]??input.measure??'count'}))
 if(!Array.isArray(widgets)||!widgets.length||widgets.length>16||widgets.some(w=>!widgetKinds.includes(w.kind)||!measures.includes(w.measure)))throw invalid('report_widgets')
 if(widgets.some(w=>['burn-up','burn-down'].includes(w.kind)&&!['count','effort'].includes(w.measure)))throw invalid('burn_measure_count_or_effort')
 return {projects,start,end,timezone,status,widgets:widgets.map(w=>({kind:w.kind,measure:w.measure}))}
}
export function localDay(at:number, timezone:string) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at)
 const part=(name:string)=>parts.find(p=>p.type===name)!.value
 return `${part('year')}-${part('month')}-${part('day')}`
}
export const nextDay=(day:string)=>new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10)
/** First instant of a local day, including short and long DST days. */
export function midnight(day:string,timezone:string) {
 let lo=Date.parse(day+'T00:00:00Z')-86400000,hi=lo+3*86400000
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(localDay(mid,timezone)<day)lo=mid;else hi=mid}
 return hi
}
