// Regenerate selected checklist rows from the contract, retaining unrelated legacy rows verbatim.
import {readFile,writeFile} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'
const [mode,...ids]=process.argv.slice(2)
if(!['write','check'].includes(mode)||!ids.length||ids.some(id=>!/^PEG-\d{3}$/.test(id)))throw Error('Usage: contract-docs.mjs write|check PEG-000 [PEG-001 ...]')
const source=await readFile('CONTRACT.md','utf8'),contract=parseContract(source)
const rows=new Map(source.split('\n').filter(line=>/^\| `PEG-\d+`/.test(line)).map(line=>{
 const cells=line.split('|').slice(1,-1).map(value=>value.trim());return [cells[0].replaceAll('`',''),cells]
}))
let acceptance=await readFile('ACCEPTANCE.md','utf8')
for(const id of ids){
 const clause=contract.clauses.find(clause=>clause.id===id),row=rows.get(id)
 if(!clause||!row)throw Error('Unknown clause: '+id)
 const definition=source.split('\n').find(line=>line.startsWith('**'+id+' — '))
 const marker='**Acceptance evidence:**',at=definition.indexOf(marker)
 if(at<0)throw Error('Missing acceptance evidence: '+id)
 const evidence=definition.slice(at+marker.length).split('**As built:**')[0].trim()
 const line=`- **${id} — ${clause.title}. Status: ${clause.status}.** ${evidence} Evidence: ${row[4]||'none'}. Gap: ${row[5]}`
 const pattern=new RegExp('^- \\*\\*'+id+' — .*$', 'm')
 if(!pattern.test(acceptance))throw Error('Missing checklist row: '+id)
 acceptance=acceptance.replace(pattern,line)
}
const counts=contract.counts
acceptance=acceptance.replace(/Of \d+ clauses, \d+ are \*\*done\*\*, \d+ are \*\*partial\*\* and \d+ are \*\*missing\*\*/,`Of ${counts.total} clauses, ${counts.done} are **done**, ${counts.partial} are **partial** and ${counts.missing} are **missing**`)
const claims='# Product status and proof\n\nGenerated from CONTRACT.md. Acceptance obligations remain in that source.\n\n'+[...rows.values()].map(row=>`- **${row[0].replaceAll('`','')} — ${row[1]}. Status: ${row[3]}.** Evidence: ${row[4]||'none'}. Gap: ${row[5]}`).join('\n\n')+'\n'
for(const [path,expected] of [['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(mode==='write')await writeFile(path,expected)
 else if(await readFile(path,'utf8').catch(()=>null)!==expected)throw Error('Generated document stale: '+path)
}
console.log('contract-docs '+mode+': '+ids.join(', ')+'; counts '+counts.done+' done, '+counts.partial+' partial, '+counts.missing+' missing')
