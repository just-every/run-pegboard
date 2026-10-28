// OpenAI Chat Completions schema-fake. Native authorization, drafts and storage stay in the Worker.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

export async function statusModelEdge() {
  const requests = [], controls = { mode:'valid', beforeReply:null }
  const server = createServer(async (request,response)=>{
    const chunks=[]; for await(const chunk of request)chunks.push(chunk)
    assert.equal(request.method,'POST'); assert.equal(request.url,'/v1/chat/completions')
    assert.equal(request.headers.authorization,'Bearer synthetic-pegboard-credential-73')
    const body=JSON.parse(Buffer.concat(chunks)); requests.push(body)
    assert.equal(body.store,false); assert.equal(body.response_format.json_schema.strict,true)
    const connection=body.response_format.json_schema.name==='status_connection'
    const input=connection?{subjectType:'connection',sources:[{id:'synthetic-pegboard-connection-check'}]}:JSON.parse(body.messages.find(message=>message.role==='user').content)
    await controls.beforeReply?.()
    response.setHeader('content-type','application/json')
    if(controls.mode==='revoked'){response.writeHead(401);response.end(JSON.stringify({error:{message:'Invalid API key',type:'invalid_request_error',code:'invalid_api_key'}}));return}
    const content=connection?{ready:true}:{health:'on_track',summary:`${input.subjectType} status for the chosen window`,assertions:[{section:'highlights',text:'Creative review is complete.',sourceIds:[controls.mode==='uncited'?'synthetic-pegboard-unknown':input.sources[0].id]}]}
    response.end(JSON.stringify({id:'synthetic-pegboard-completion-1',object:'chat.completion',created:1793188800,model:body.model,choices:[{index:0,message:{role:'assistant',content:JSON.stringify(content),refusal:null},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150}}))
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  return {requests,controls,origin:`http://127.0.0.1:${server.address().port}/v1`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
}
