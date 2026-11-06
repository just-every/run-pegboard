import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { runLanes } from '/workspace/run-pegboard/scripts/verify-app.mjs';
const root = await mkdtemp(join(tmpdir(), 'pegboard-scheduler-check-'));
const events = join(root, 'events');
const prior = process.cwd();
try {
 process.chdir(root);
 execFileSync('git',['init','-q']);
 await mkdir('node_modules');
 await writeFile('input.txt','immutable input');
 execFileSync('git',['add','input.txt']);
 const command = (name,fail=false) => `node --input-type=module -e '${`import {appendFile, readFile} from "node:fs/promises"; import {setTimeout} from "node:timers/promises"; const log = ${JSON.stringify(events)}; await appendFile(log, JSON.stringify({name:${JSON.stringify(name)},event:"start",cwd:process.cwd(),at:Date.now()})+"\\n"); await setTimeout(150); await appendFile(log, JSON.stringify({name:${JSON.stringify(name)},event:"end",at:Date.now()})+"\\n"); process.exit(${fail?1:0});`}'`;
 for (const failed of [false,true]) {
  await writeFile(events,'');
  const shard = {name:'probe', exclusive:'diagnostics',lanes:['diagnostics','audit','capacity'].map(name=>({name,hosted:false,commands:[command(name,failed&&name==='diagnostics')]}))};
  if (failed) await assert.rejects(runLanes(shard),/Verification shard failed/);
  else await runLanes(shard);
  const rows=(await readFile(events,'utf8')).trim().split('\n').map(l=>JSON.parse(l));
  const event=(name,type)=>rows.find(r=>r.name===name&&r.event===type);
  assert.equal(rows.length,6);
  for(const name of ['audit','capacity'])assert.ok(event(name,'start').at>=event('diagnostics','end').at);
  assert.ok(event('audit','start').at<event('capacity','end').at&&event('capacity','start').at<event('audit','end').at);
  assert.equal(new Set(rows.filter(r=>r.event==='start').map(r=>r.cwd)).size,3);
 }
 console.log('PASS: exclusive diagnostics, concurrent tail, failure preservation, isolated working directories, scratch cleanup');
} finally {process.chdir(prior);await rm(root,{recursive:true,force:true});}
