import {operatorMail} from '../../mail.server.mjs'
import {createMailSender} from '../../modules/mail/index.mjs'

/** The seed mail seam, with an explicit local network edge for schema qualification. */
export function approvalMail(env){
 const edge=env.PEGBOARD_LOCAL_APPROVAL_MAIL_ORIGIN
 if(env.AUTH_LOCAL==='true'&&edge){
 const url=new URL(edge)
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('invalid_local_mail_edge')
 return createMailSender({provider:'resend',mode:'test',apiKey:'synthetic-pegboard-7400'},{fetch:(_url,init)=>fetch(url.origin+'/emails',init)})
 }
 return operatorMail(env)
}
