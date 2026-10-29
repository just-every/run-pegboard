import { all, bound } from '../db'
export async function capacityErasureSources(db:D1Database,person:string) {
 const feeds=await all<{id:string;mapping:string}>(db,'SELECT id,mapping FROM peg_capacity_feeds'),sources:{feedId:string;sourcePerson:string}[]=[]
 for(const feed of feeds)for(const [source,id] of Object.entries(JSON.parse(feed.mapping)))if(id===person)sources.push({feedId:feed.id,sourcePerson:source})
 return sources
}
export function capacityErasureStatements(db:D1Database,person:string,sources:{feedId:string;sourcePerson:string}[]) {
 return [
  ...sources.flatMap(s=>[bound(db,'INSERT OR IGNORE INTO peg_capacity_erased_sources VALUES(?,?)',[s.feedId,s.sourcePerson]),bound(db,`UPDATE peg_capacity_feeds SET mapping=(SELECT json_group_object(key,value) FROM json_each(mapping) WHERE value<>?),revision=revision+1 WHERE id=?`,[person,s.feedId])]),
  bound(db,'UPDATE peg_capacity_feeds SET active=0,fetched_at=NULL,revision=revision+1 WHERE issuer_id=?',[person]),
  bound(db,'UPDATE peg_time_off SET delegate_id=NULL WHERE delegate_id=?',[person]),
 ]
}
