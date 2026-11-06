import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readdir,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runLanes} from '/workspace/run-pegboard/scripts/verify-app.mjs';
const fixture=await mkdtemp(join(tmpdir(),'pegboard-runner-fixture-'));
const original=process.cwd();
const before=new Set((await readdir(tmpdir())).filter(x=>x.startsWith('pegboard-verify-')));
try{
 process.chdir(fixture);
 execFileSync('git',['init','-q']);
 await writeFile('input.txt','tracked input\n');
 await writeFile('.dev.vars','FIXTURE_ONLY=must-not-copy\n');
 await mkdir('node_modules');
 execFileSync('git',['add','input.txt']);
 const check="test -f input.txt && test ! -f .dev.vars && test -d node_modules && test -d .git && test ! -f sibling.txt";
 await runLanes({name:'isolation-success',lanes:[{name:'one',commands:[check+' && touch sibling.txt']},{name:'two',commands:[check]}]});
 await assert.rejects(runLanes({name:'failure-propagation',lanes:[{name:'failed',commands:['exit 7']},{name:'survivor',commands:[`node -e 'setTimeout(()=>require("node:fs").writeFileSync(${JSON.stringify(join(fixture,'sibling-finished.txt'))},"finished"),150)'`]}]}),/Verification shard failed/);
 assert.equal(await readFile('sibling-finished.txt','utf8'),'finished');
 const after=(await readdir(tmpdir())).filter(x=>x.startsWith('pegboard-verify-'));
 assert.deepEqual(new Set(after),before);
 console.log('PASS: isolated inputs/dependencies/Git, private settings excluded, every sibling awaited after failure, nonzero propagation and scratch cleanup');
}finally{process.chdir(original);await rm(fixture,{recursive:true,force:true});}
