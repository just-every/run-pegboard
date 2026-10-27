import {readFile,writeFile} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'
const mode=process.argv[2]
if(!['write','check'].includes(mode))throw Error('Usage: node scripts/contract-docs.mjs write|check')
let source=await readFile('CONTRACT.md','utf8')
const rows=[...source.matchAll(/^\| `([A-Z]+-\d+)` \| ([^|]+) \| ([^|]+) \| (done|partial|missing) \| ([^|]*) \| ([^|]*) \|$/gm)].map(m=>({id:m[1],title:m[2].trim(),kind:m[3].trim(),status:m[4],evidence:m[5].trim(),gap:m[6].trim()}))
if(!rows.length)throw Error('No contract status rows')
const count=items=>({done:items.filter(r=>r.status==='done').length,partial:items.filter(r=>r.status==='partial').length,missing:items.filter(r=>r.status==='missing').length,total:items.length})
for(const [label,items] of [['Published',rows.filter(r=>r.kind==='published')],['Target and push further',rows.filter(r=>r.kind!=='published')],['All',rows]]){const n=count(items);source=source.replace(new RegExp('^\\| '+label+' \\|.*$','m'),`| ${label} | ${n.done} | ${n.partial} | ${n.missing} | ${n.total} |`)}
parseContract(source)
const original=await readFile('ACCEPTANCE.md','utf8'),counts=count(rows)
let acceptance=original.replace(/Of \d+ clauses, \d+ are \*\*done\*\*, \d+ are \*\*partial\*\* and \d+ are \*\*missing\*\*/,`Of ${counts.total} clauses, ${counts.done} are **done**, ${counts.partial} are **partial** and ${counts.missing} are **missing**`)
for(const row of rows){
 const pattern=new RegExp('^(- \\*\\*'+row.id+' — .*?Status: )(done|partial|missing)(\\.\\*\\* .*?) (?:Existing evidence|Evidence): .*? Gap: .*?$','m')
 if(pattern.test(acceptance)){const old=acceptance.match(pattern)[0];const known=old.includes(row.evidence||'none')&&old.endsWith(row.gap||'None for this clause.');if(!known||!old.includes('Status: '+row.status+'.'))acceptance=acceptance.replace(pattern,(_m,start,_status,body)=>`${start}${row.status}${body} Existing evidence: ${row.evidence||'none'}. Gap: ${row.gap||'None for this clause.'}`)}
 else throw Error('Missing acceptance row '+row.id)
}
const claims='# Implementation claims\n\nGenerated from CONTRACT.md. Acceptance text and current scope remain in that source.\n\n'+rows.map(r=>`- **${r.id} — ${r.title}. Status: ${r.status}.** Evidence: ${r.evidence||'none'}. Gap: ${r.gap||'None for this clause.'}`).join('\n\n')+'\n'
for(const [path,want] of [['CONTRACT.md',source],['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 let have;try{have=await readFile(path,'utf8')}catch{have=''}
 if(have!==want){if(mode==='check')throw Error('Generated contract document is stale: '+path);await writeFile(path,want)}
}
console.log('Contract documents '+(mode==='check'?'current':'generated'))
