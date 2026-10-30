// Regenerate selected checklist rows from the contract, retaining unrelated legacy rows verbatim.
import {readFile,writeFile} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'
const [mode,...ids]=process.argv.slice(2)
if(!['write','check'].includes(mode)||!ids.length||ids.some(id=>!/^(?:PEG|BASE-AGENT)-\d{3}$/.test(id)))throw Error('Usage: contract-docs.mjs write|check PEG-000 [PEG-001 ...]')
let source=await readFile('CONTRACT.md','utf8')
const rows=new Map(source.split('\n').filter(line=>/^\| `(?:PEG|BASE-AGENT)-\d+`/.test(line)).map(line=>{
 const cells=line.split('|').slice(1,-1).map(value=>value.trim());return [cells[0].replaceAll('`',''),cells]
}))
const tally=selected=>['done','partial','missing'].map(state=>selected.filter(row=>row[3]===state).length).concat(selected.length)
source=source.replace(/^\| (Published|Target and push further|All) \|.*$/gm,(_,label)=>{const selected=[...rows.values()].filter(row=>label==='All'||(label==='Published'?row[2]==='published':row[2]!=='published'));return '| '+label+' | '+tally(selected).join(' | ')+' |'})
if(mode==='write')await writeFile('CONTRACT.md',source)
else if(source!==await readFile('CONTRACT.md','utf8'))throw Error('Contract summary counts are stale')
const contract=parseContract(source)
// Preserve paths and links, while writing prose conjunctions instead of ambiguous repository-shaped tokens.
const prose=value=>value.split(/(`[^`]*`|https?:\/\/\S+)/).map((part,i)=>{if(i%2)return part;let previous;do{previous=part;part=part.replace(/\b([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\b/g,'$1 and $2')}while(part!==previous);return part}).join('')
let acceptance=await readFile('ACCEPTANCE.md','utf8')
for(const id of ids){
 const clause=contract.clauses.find(clause=>clause.id===id),row=rows.get(id)
 if(!clause||!row)throw Error('Unknown clause: '+id)
 const definition=source.split('\n').find(line=>line.startsWith('**'+id+' — ')) ?? clause.text
 const marker=id.startsWith('BASE-AGENT-')?'**Acceptance.**':'**Acceptance evidence:**',at=definition.indexOf(marker)
 if(at<0)throw Error('Missing acceptance evidence: '+id)
 const evidence=definition.slice(at+marker.length).split('**As built:**')[0].trim()
 const line=`- **${id} — ${clause.title}. Status: ${clause.status}.** ${prose(evidence)} Evidence: ${prose(row[4]||'none')}. Gap: ${prose(row[5]||'None for this clause.')}`
 const pattern=new RegExp('^- \\*\\*'+id+' — .*$', 'm')
 const previous=acceptance.split('\n').filter(row=>/^- \*\*PEG-\d+ — /.test(row)&&row.includes(' — '+clause.title+'. Status: '))
 if(previous.length>1)throw Error('Ambiguous checklist title: '+clause.title)
 acceptance=pattern.test(acceptance)?acceptance.replace(pattern,line):previous.length?acceptance.replace(previous[0],line):acceptance.trimEnd()+'\n\n'+line+'\n'
}
const counts=contract.counts
acceptance=acceptance.replace(/Of \d+ clauses, \d+ are \*\*done\*\*, \d+ are \*\*partial\*\* and \d+ are \*\*missing\*\*/,`Of ${counts.total} clauses, ${counts.done} are **done**, ${counts.partial} are **partial** and ${counts.missing} are **missing**`)
const claims='# Product status and proof\n\nGenerated from CONTRACT.md. Acceptance obligations remain in that source.\n\n'+[...rows.values()].map(row=>`- **${row[0].replaceAll('`','')} — ${row[1]}. Status: ${row[3]}.** Evidence: ${prose(row[4]||'none')}. Gap: ${prose(row[5]||'None for this clause.')}`).join('\n\n')+'\n'
for(const [path,expected] of [['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(mode==='write')await writeFile(path,expected)
 else if(await readFile(path,'utf8').catch(()=>null)!==expected)throw Error('Generated document stale: '+path)
}
console.log('contract-docs '+mode+': '+ids.join(', ')+'; counts '+counts.done+' done, '+counts.partial+' partial, '+counts.missing+' missing')
