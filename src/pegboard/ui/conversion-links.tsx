import type {ConversionView} from '../conversion/operations'
import {Card} from './shell'
export const conversionHref=(object:{type:string;id:string})=>`/app/${object.type==='project'?'projects':'tasks'}/${object.id}`
export function ConversionLinks({links}:{links:ConversionView[]}){
 if(!links.length)return null
 return <Card title="Linked conversions"><ul className="rows">{links.map(link=><li key={link.id}><a href={`/app/conversions/${link.id}`}>{link.source.title} → {link.target.title}</a>{link.undoneAt?' · Undone':''}</li>)}</ul></Card>
}
