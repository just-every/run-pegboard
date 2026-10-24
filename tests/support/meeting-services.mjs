import {createServer} from 'node:http'
export async function startMeetingServices(){
  const state={refused:new Set(),changed:new Set(),outage:new Set(),calls:[]}
  const vtt='WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nAction: Synthetic provider follow-up\n'
  const server=createServer((req,res)=>{
    const service=req.url.startsWith('/v2/meetings/')||req.url.startsWith('/rec/download/')?'zoom':req.url.startsWith('/v2/conferenceRecords/')?'meet':'teams'
    state.calls.push({service,path:req.url})
    if(req.headers.authorization!=='Bearer synthetic-pegboard-950'||state.refused.has(service)){res.writeHead(403,{'content-type':'application/json'});res.end('{}');return}
    if(state.outage.has(service)){res.writeHead(503);res.end();return}
    const text=state.changed.has(service)?'Action: Synthetic changed source context':'Action: Synthetic provider follow-up'
    const json=body=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(body))}
    if(service==='zoom'&&req.url.startsWith('/v2/meetings/'))return json({recording_files:[{id:'synthetic-pegboard-952',file_type:'TRANSCRIPT',status:'completed',download_url:'https://synthetic-pegboard-1.zoom.us/rec/download/synthetic-pegboard-953'}]})
    if(service==='meet')return json({transcriptEntries:[{name:'synthetic-pegboard-954',participant:'synthetic-pegboard-955',startTime:'2026-10-23T12:00:01Z',endTime:'2026-10-23T12:00:05Z',text}]})
    res.writeHead(200,{'content-type':'text/vtt'});res.end(vtt.replace('Action: Synthetic provider follow-up',text))
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`
  return {state,origins:JSON.stringify({zoom:origin,meet:origin,teams:origin}),stop:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
}
