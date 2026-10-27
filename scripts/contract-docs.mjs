// Reconcile the existing acceptance checklist and public claims with CONTRACT.md.
// Acceptance prose stays in its established layout; status, evidence and gaps have one source.
import { readFile, writeFile } from 'node:fs/promises'
import { parseContract } from '../src/base/seed-contract.mjs'
const mode = process.argv[2]
if (!['write','check'].includes(mode)) throw Error('Use contract-docs.mjs write or check')
const original = await readFile('CONTRACT.md','utf8')
const rawRows = original.split('\n').filter(line=>/^\| `PEG-\d+` \|/.test(line)).map(line=>{const cells=line.trim().slice(1,-1).split(' | ').map(v=>v.trim());return {kind:cells[2],status:cells[3]}})
const tally = rows => [rows.filter(c=>c.status==='done').length,rows.filter(c=>c.status==='partial').length,rows.filter(c=>c.status==='missing').length,rows.length]
let source = original
for (const [label,rows] of [['Published',rawRows.filter(c=>c.kind==='published')],['Target and push further',rawRows.filter(c=>c.kind!=='published')],['All',rawRows]]) {
  source = source.replace(new RegExp(`^\\| ${label} \\|.*$`,'m'),`| ${label} | ${tally(rows).join(' | ')} |`)
}
const contract = parseContract(source)
const lines = source.split('\n'), rows = new Map(contract.clauses.map(c=>[c.id,lines[c.row-1].trim().slice(1,-1).split(' | ').map(v=>v.trim())]))
const acceptance = await readFile('ACCEPTANCE.md','utf8')
const [done,partial,missing,total] = tally(contract.clauses)
let expected = acceptance.replace(/Of \d+ clauses, \d+ are \*\*done\*\*, \d+ are \*\*partial\*\* and \d+ are \*\*missing\*\*/,`Of ${total} clauses, ${done} are **done**, ${partial} are **partial** and ${missing} are **missing**`)
expected = expected.replace(/^- \*\*(PEG-\d+) — ([\s\S]*?)(?=\n\n|$)/gm,(block,id)=>{
  const row=rows.get(id)
  if(!row)throw Error(`Unknown acceptance clause ${id}`)
  if(!/(?:Existing evidence|Evidence):/.test(block)||!block.includes('Gap:'))throw Error(`Missing evidence fields for ${id}`)
  return block.replace(/Status: (done|partial|missing)\./,`Status: ${row[3]}.`).replace(/((?:Existing evidence|Evidence):) [\s\S]*$/,(_all,label)=>`${label} ${row[4] ? row[4].replace(/[.]$/, '') : 'none'}. Gap: ${row[5]}`)
})
const claims = '# Current implementation claims\n\nGenerated from CONTRACT.md by `node scripts/contract-docs.mjs write`. The contract remains the acceptance source.\n\n' + '| Clause | Title | Status | Evidence | Gap |\n| --- | --- | --- | --- | --- |\n' + contract.clauses.map(c=>{const row=rows.get(c.id);return `| ${row[0]} | ${row[1]} | ${row[3]} | ${row[4]} | ${row[5]} |`}).join('\n')+'\n'
for(const [path,content] of [['CONTRACT.md',source],['ACCEPTANCE.md',expected],['docs/CLAIMS.md',claims]]){
  let current='';try{current=await readFile(path,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
  if(mode==='write'){if(current!==content)await writeFile(path,content)}
  else if(current!==content)throw Error(`Stale generated document: ${path}`)
}
console.log(`Contract documents ${mode==='write'?'regenerated':'current'}: ${done} done, ${partial} partial, ${missing} missing`)
