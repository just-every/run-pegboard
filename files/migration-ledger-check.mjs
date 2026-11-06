import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root=process.cwd()
const {mapMigrationLedger}=await import(root+'/node_modules/@runeditrun/rer/cli/portability-migrations.mjs')
const directory='migrations/core',names=(await readdir(directory)).filter(n=>n.endsWith('.sql')).sort(),entries=[]
for(const name of names){const body=await readFile(directory+'/'+name);entries.push({name,sha256:createHash('sha256').update(body).digest('hex')})}
const applied=execFileSync('git',['ls-tree','-r','--name-only','origin/main','--',directory],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
for(const path of applied){const expected=execFileSync('git',['show','origin/main:'+path]);assert.deepEqual(await readFile(path),expected,'preserve every applied migration byte: '+path)}
const mapped=await mapMigrationLedger({root,entries})
assert.deepEqual(mapped,entries)
console.log(JSON.stringify({check:'native migration ledger identity and forward-only source preservation',exit:0,migrations:entries.length,preserved:applied.length,added:names.filter(n=>!applied.includes(directory+'/'+n))}))
