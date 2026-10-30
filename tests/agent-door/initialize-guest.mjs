export default async function ({request,origin,email,owner,mail}) {
 const invited=await request(new URL('/api/v1/workspaces/ws_main/people',origin).href,{method:'POST',headers:{Origin:origin,Cookie:owner.cookie,'content-type':'application/json'},body:JSON.stringify({email,displayName:'Casey Client',role:'guest'})})
 if(!invited.ok)throw Error('Native invitation refused')
 const messages=await mail.read({limit:20})
 const link=messages.flatMap(message=>(message.text+' '+message.html).match(/https?:\/\/[^\s<>"']+\/auth\/confirm\?token=[^\s<>"']+/g)??[]).at(-1)
 if(!link)throw Error('Native invitation mail unavailable')
 const token=new URL(link.replaceAll('&amp;','&')).searchParams.get('token')
 return request(new URL('/auth/confirm',origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({token})})
}
