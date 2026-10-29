import {randomUUID} from 'node:crypto'
export default async function ({request,origin,cookie,phase}) {
 const call=async(method,path,body)=>{
  const response=await request(new URL(path,origin).href,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  if(!response.ok)throw Error('Native fixture refused')
  return response.json()
 }
 const internal=await call('POST','/api/v1/projects',{name:`Campaign coordination ${phase} ${randomUUID()}`})
 const shared=await call('POST','/api/v1/projects',{name:`Client review ${phase} ${randomUUID()}`})
 const guest=(await call('GET','/api/v1/workspaces/ws_main/people')).people.find(person=>person.email==='synthetic-pegboard-client@example.invalid')
 if(!guest||guest.status!=='active')throw Error('Native guest lifecycle incomplete')
 await call('POST','/api/v1/grants',{objectType:'project',objectId:shared.id,granteeId:guest.id,level:'viewer'})
 return {values:{internal,shared,guest}}
}
