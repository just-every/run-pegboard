// Official Vector issue, Jira Cloud issue and GitHub issue and pull request wire shapes.
import {createServer} from 'node:http'
export const vectorTodo='synthetic-pegboard-0000001',vectorDone='synthetic-pegboard-0000002'
export async function startEngineeringServices(){
  const services={},origins={}
  for(const service of ['vector','jira','github']){
    const state={status:service==='vector'?vectorTodo:service==='jira'?'100':'open',version:1,refused:false,outage:false,lose:false,writes:0,comments:[],commentWrites:0,requests:[],owner:'synthetic-pegboard-801'}
    const record=(pr=false)=>service==='vector'?{id:'synthetic-pegboard-802',identifier:'SYN-1',version:state.version,status:{id:state.status,name:'Synthetic status',category:'started'},assignee:{id:state.owner,name:'Synthetic person'}}:service==='jira'?{id:'10001',key:'SYN-1',fields:{status:{id:state.status,name:'Synthetic status'},assignee:{accountId:state.owner},updated:`2026-10-23T12:00:${String(state.version).padStart(2,'0')}.000+0000`}}:{id:pr?10002:10001,number:1,merged_at:pr&&state.merged?'2026-10-23T12:00:01Z':null,state:state.status,assignee:{id:801},updated_at:`2026-10-23T12:00:${String(state.version).padStart(2,'0')}Z`}
    const server=createServer(async(req,res)=>{
      let raw='';for await(const chunk of req)raw+=chunk
      const input=raw?JSON.parse(raw):null
      state.requests.push({method:req.method,path:req.url,input})
      const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(body===undefined?undefined:JSON.stringify(body))}
      if(req.headers.authorization!==(service==='jira'?'Basic ':'Bearer ')+'synthetic-pegboard-800')return send(401,{message:'Unauthorized'})
      if(state.refused)return send(403,{message:'Forbidden'})
      if(state.outage)return send(503,{message:'Unavailable'})
      const path=service==='vector'?'/api/v1/issues/SYN-1':service==='jira'?'/rest/api/3/issue/SYN-1':'/repos/'+['synthetic-pegboard-1','synthetic-pegboard-2','issues','1'].join('/')
      const commentPath=service==='vector'?'/api/v1/comments':service==='jira'?path+'/comment':path.replace('/pulls/','/issues/')+'/comments'
      if(req.method==='GET'&&req.url.startsWith(commentPath+'?'))return send(200,service==='github'?state.comments:{comments:state.comments,startAt:0,total:state.comments.length,nextCursor:null})
      if(req.method==='POST'&&req.url===(service==='vector'?path+'/comments':commentPath)){
        if(service==='jira'&&input?.body?.type!=='doc')return send(400,{errorMessages:['Invalid document']})
        state.comments.push({id:String(state.comments.length+1),body:input.body});state.commentWrites++
        if(state.lose){state.lose=false;req.socket.destroy();return}
        return send(201,state.comments.at(-1))
      }
      if(service==='jira'&&req.url===path+'/transitions'&&req.method==='GET')return send(200,{transitions:[{id:'31',to:{id:'200',name:'Done'}}]})
      if(service==='jira'&&req.url===path+'/transitions'&&req.method==='POST'){
        if(input?.transition?.id!=='31')return send(400,{errorMessages:['Invalid transition']})
        state.status='200';state.version++;state.writes++
      }else if(req.url!==path&&!(service==='github'&&req.url===path.replace('/issues/','/pulls/')))return send(404,{message:'Not found'})
      else if(req.method==='GET')return send(200,record(req.url.includes('/pulls/')))
      else if(req.method==='PATCH'){
        if(service==='vector'){
          if(Object.keys(input).sort().join(',')!=='expectedVersion,statusId'||input.expectedVersion!==state.version)return send(409,{error:'stale_version'})
          if(![vectorTodo,vectorDone].includes(input.statusId))return send(400,{error:'invalid_request'})
          state.status=input.statusId
        }else if(service==='github'){
          if(Object.keys(input).join(',')!=='state'||!['open','closed'].includes(input.state))return send(422,{message:'Validation failed'})
          state.status=input.state
        }else return send(405,{})
        state.version++;state.writes++
      }else return send(405,{})
      if(state.lose){state.lose=false;req.socket.destroy();return}
      return send(service==='jira'?204:200,service==='jira'?undefined:record())
    })
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origins[service]=`http://127.0.0.1:${server.address().port}`;services[service]=state;state.change=status=>{state.status=status;state.version++}
    state.stop=()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})
  }
  return {origins:JSON.stringify(origins),services,stop:()=>Promise.all(Object.values(services).map(s=>s.stop()))}
}
