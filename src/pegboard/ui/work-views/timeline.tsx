import type { WorkRow } from '../../views/rows'
import { dateValue } from './rows'
const day=(date:string)=>Math.floor(Date.parse(date.slice(0,10)+'T12:00:00Z')/86400000)
export function TimelineRange({rows}:{rows:WorkRow[]}) {
 const dates=rows.flatMap(row=>[row.startDate,row.dueDate].filter((value):value is string=>!!value)).map(day)
 if(!dates.length)return <p>Undated tasks remain listed below.</p>
 const first=Math.min(...dates),last=Math.max(...dates),span=Math.max(1,last-first+1)
 const pct=(value:number)=>Math.max(0,Math.min(100,Math.round(value/5)*5))
 return <section className="work-timeline" aria-label="Schedule overview"><p>{new Date(first*86400000).toISOString().slice(0,10)} to {new Date(last*86400000).toISOString().slice(0,10)}</p>{rows.filter(row=>row.startDate||row.dueDate).map(row=>{
  const start=day(row.startDate??row.dueDate!),end=day(row.dueDate??row.startDate!)
  return <div key={row.id}><a href={`/app/tasks/${row.id}`}>{row.title}</a><span className="track" role="img" aria-label={`${row.title}: ${dateValue(row.startDate)} to ${dateValue(row.dueDate)}`}><span className={`fill off-${pct((start-first)/span*100)} pct-${Math.max(5,pct((end-start+1)/span*100))}`}/></span><p>{dateValue(row.startDate)} → {dateValue(row.dueDate)}</p></div>
 })}</section>
}
