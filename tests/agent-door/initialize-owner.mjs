export default async function ({request,origin,claim,returnTo,reviewers}) {
 const ownerName='Morgan Hale'
 const response=await request(new URL(claim.path,origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({token:claim.token,displayName:ownerName,returnTo})})
 if(response.status!==303)throw Error('Native bootstrap refused')
 const cookie=response.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ')
 const setup=await request(new URL('/setup',origin).href,{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({displayName:ownerName,confirm:'yes'}).toString()})
 if(setup.status!==303)throw Error('Native first-run setup refused')
 await reviewers.initialize('guest',{cookie})
 return response
}
