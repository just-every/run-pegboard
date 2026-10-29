import type { Report } from './dashboard'
import { toCsv } from '../tasks/board'

/** All formats contain the same definitions, plotted values and event references. */
export function exportRecords(report:Report):Record<string,string|number|null>[] {
 const records:Record<string,string|number|null>[]=[{section:'snapshot',snapshot:report.id,name:report.name,capturedAt:report.capturedAt,start:report.definition.start,end:report.definition.end,timezone:report.definition.timezone,status:report.definition.status,projects:report.definition.projects.join(';'),unknown:report.unknown.join(';')}]
 for(const [index,widget] of report.widgets.entries())for(const point of widget.values)records.push({section:'value',widget:index,kind:widget.kind,measure:widget.measure,group:widget.group,label:point.label,value:point.value,sources:point.sourceIds.join(';'),events:point.eventIds.join(';')})
 for(const source of report.sources){records.push({section:'source',task:source.id,title:source.title,due:source.due});for(const event of source.events)records.push({section:'event',task:source.id,event:event.seq,at:event.at,kind:event.kind,status:event.status,effort:event.effort,projects:event.projects.join(';')})}
 return records
}
export const reportCsv=(report:Report)=>toCsv(exportRecords(report))
const xml=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
const utf8=(s:string)=>new TextEncoder().encode(s)
const concat=(parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}
const crc32=(bytes:Uint8Array)=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
const header=(size:number)=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)}}
/** Standards-compliant ZIP, stored entries: no runtime, provider or filesystem dependency. */
function zip(files:Record<string,string>) {
 const chunks:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0
 for(const [path,text] of Object.entries(files)){
  const name=utf8(path),body=utf8(text),crc=crc32(body),local=header(30),entry=header(46)
  local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,body.length,true);local.view.setUint32(22,body.length,true);local.view.setUint16(26,name.length,true)
  entry.view.setUint32(0,0x02014b50,true);entry.view.setUint16(4,20,true);entry.view.setUint16(6,20,true);entry.view.setUint16(8,0x800,true);entry.view.setUint32(16,crc,true);entry.view.setUint32(20,body.length,true);entry.view.setUint32(24,body.length,true);entry.view.setUint16(28,name.length,true);entry.view.setUint32(42,offset,true)
  chunks.push(local.bytes,name,body);central.push(entry.bytes,name);offset+=30+name.length+body.length
 }
 const directory=concat(central),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,central.length/2,true);end.view.setUint16(10,central.length/2,true);end.view.setUint32(12,directory.length,true);end.view.setUint32(16,offset,true)
 return concat([...chunks,directory,end.bytes])
}
const column=(n:number):string=>n<26?String.fromCharCode(65+n):column(Math.floor(n/26)-1)+column(n%26)
export function reportXlsx(report:Report) {
 const records=exportRecords(report),columns=[...new Set(records.flatMap(row=>Object.keys(row)))],rows:unknown[][]=[columns,...records.map(row=>columns.map(name=>row[name]??null))]
 const sheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,r)=>`<row r="${r+1}">`+row.map((v,c)=>typeof v==='number'?`<c r="${column(c)}${r+1}"><v>${v}</v></c>`:`<c r="${column(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>'
 return zip({
  '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':sheet,
 })
}
/** Letter pages; every record is emitted and paginated, never silently truncated. */
export function reportPdf(report:Report) {
 const escape=(s:string)=>s.replace(/[^\x20-\x7e]/gu,c=>'[U+'+c.codePointAt(0)!.toString(16).toUpperCase()+']').replace(/[\\()]/g,c=>'\\'+c)
 const lines=['Pegboard report',report.name,'Snapshot '+report.id,'Window '+report.definition.start+' to '+report.definition.end+' '+report.definition.timezone,'Unknown history: '+(report.unknown.join(', ')||'none'),...exportRecords(report).flatMap(row=>Object.entries(row).filter(([,v])=>v!==null).flatMap(([k,v])=>{const text=k+': '+String(v);return text.match(/.{1,85}/gu)??['']}))]
 const pages:Array<string[]>=[];for(let i=0;i<lines.length;i+=49)pages.push(lines.slice(i,i+49))
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
 pages.forEach((page,i)=>{const stream='BT /F1 10 Tf 13 TL 36 756 Td '+page.map((line,j)=>(j?'T* ':'')+'('+escape(line)+') Tj').join('\n')+' ET';objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,`<< /Length ${utf8(stream).length} >>\nstream\n${stream}\nendstream`)})
 let text='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(utf8(text).length);text+=`${i} 0 obj\n${objects[i]}\nendobj\n`}
 const xref=utf8(text).length;text+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return utf8(text)
}
