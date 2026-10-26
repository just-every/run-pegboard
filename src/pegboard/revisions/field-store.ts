import {bound,now} from '../db'
export const fieldVersionStatement=(db:D1Database,id:string,actorId:string)=>bound(db,`INSERT INTO peg_field_versions SELECT id,version,json_object('key',key,'label',label,'type',type,'visibility',visibility,'units',units,'config',json(config)),?,? FROM peg_field_definitions WHERE id=?`,[actorId,now(),id])
