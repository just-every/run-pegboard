import type {Bindings} from '../../../auth.server'
import {invalid,PegError} from '../../db'
export async function meetingArtifact(env:Bindings,service:string,resource:string,credential:unknown){
  if(typeof credential!=='string'||!credential.trim()||credential.length>4096||/[\r\n]/.test(credential))throw invalid('meeting_credential_required')
  const official:Record<string,string>={zoom:'https://api.zoom.us',meet:'https://meet.googleapis.com',teams:'https://graph.microsoft.com'}
  if(!official[service])throw invalid('meeting_service_invalid')
  const local=env.AUTH_LOCAL==='true'&&env.PEGBOARD_LOCAL_MEETING_ORIGINS?JSON.parse(env.PEGBOARD_LOCAL_MEETING_ORIGINS)[service]:null
  const origin=local?new URL(local).origin:official[service]
  const parts=resource.split('/');if(parts.some(p=>!p||!/^[A-Za-z0-9_+=-]+$/.test(p)))throw invalid('meeting_source_resource_invalid')
  const encoded=parts.map(encodeURIComponent).join('/')
  async function get(url:string,token=credential as string){
    let response:Response
    try{response=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json, text/vtt'},redirect:'manual',signal:AbortSignal.timeout(15000)})}catch{throw new PegError(503,'meeting_source_unavailable')}
    if([401,403,404].includes(response.status))throw new PegError(403,'meeting_source_refused')
    if(!response.ok)throw new PegError(503,'meeting_source_unavailable')
    return response
  }
  if(service==='zoom'){
    if(parts.length!==4||parts[0]!=='meetings'||parts[2]!=='recordings')throw invalid('meeting_source_resource_invalid')
    const response=await get(origin+'/v2/meetings/'+encodeURIComponent(parts[1])+'/recordings'),body:any=await response.json()
    const file=body.recording_files?.find((f:any)=>f.id===parts[3]&&f.file_type==='TRANSCRIPT'&&f.status==='completed')
    if(!file)throw invalid('meeting_transcript_not_ready')
    let url:URL;try{url=new URL(file.download_url)}catch{throw invalid('meeting_download_invalid')}
    if(url.protocol!=='https:'||!/(^|\.)zoom\.us$/.test(url.hostname)||url.username||url.password)throw invalid('meeting_download_invalid')
    const download=await get(local?origin+url.pathname:url.href,typeof body.download_access_token==='string'?body.download_access_token:credential)
    return await download.text()
  }
  if(service==='meet'){
    if(parts.length!==4||parts[0]!=='conferenceRecords'||parts[2]!=='transcripts')throw invalid('meeting_source_resource_invalid')
    const entries:any[]=[],tokens=new Set<string>();let token=''
    for(let page=0;page<10;page++){
      const response=await get(origin+'/v2/'+encoded+'/entries?pageSize=100'+(token?'&pageToken='+encodeURIComponent(token):'')),body:any=await response.json()
      if(!Array.isArray(body.transcriptEntries))throw invalid('meeting_transcript_invalid')
      entries.push(...body.transcriptEntries);token=body.nextPageToken??''
      if(!token)return {transcriptEntries:entries}
      if(tokens.has(token))throw invalid('meeting_pagination_invalid');tokens.add(token)
    }
    throw invalid('meeting_complete_export_required')
  }
  if(parts.length!==6||parts[0]!=='users'||parts[2]!=='onlineMeetings'||parts[4]!=='transcripts')throw invalid('meeting_source_resource_invalid')
  return await (await get(origin+'/v1.0/'+encoded+'/content')).text()
}
