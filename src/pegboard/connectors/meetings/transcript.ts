// Authorized source exports enter here. No recorder joins a meeting or invokes a provider.
import { invalid } from '../../db'
export interface Segment { at: string; text: string }
export function transcript(service: string, input: Record<string,any>): Segment[] {
  let segments: Segment[]
  if(service==='meet'){
    let document: any
    try{document=typeof input.content==='string'?JSON.parse(input.content):input.content}catch{throw invalid('meeting_transcript_invalid')}
    if(!Array.isArray(document?.transcriptEntries)||document.nextPageToken)throw invalid('meeting_complete_export_required')
    segments=document.transcriptEntries.map((s:any)=>({at:s.startTime,text:s.text}))
  }else if(service==='zoom'||service==='teams'){
    if(typeof input.content!=='string'||!input.content.trimStart().startsWith('WEBVTT'))throw invalid('meeting_vtt_required')
    segments=input.content.replaceAll('\r','').split(/\n\s*\n/).flatMap(block=>{
      const lines=block.split('\n'),index=lines.findIndex(l=>/^\d{2}:\d{2}(?::\d{2})?\.\d{3} --> /.test(l))
      if(index<0)return []
      return [{at:lines[index].split(' --> ')[0],text:lines.slice(index+1).join(' ').replace(/<[^>]*>/g,'').trim()}]
    })
  }else throw invalid('meeting_service_invalid')
  if(!segments.length||segments.length>1000||segments.some(s=>typeof s.text!=='string'||!s.text.trim()||s.text.length>5000||typeof s.at!=='string'||s.at.length>60))throw invalid('meeting_transcript_invalid')
  return segments.map(s=>({at:s.at,text:s.text.trim()}))
}
