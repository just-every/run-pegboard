import ts from '/workspace/run-pegboard/node_modules/typescript/lib/typescript.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {verificationPlan} from '/workspace/run-pegboard/scripts/verify-app.mjs';
import {join,dirname} from 'node:path';
const root='/workspace/run-pegboard';
const packet=process.env.HOME+'/rer-consolidation/work/sx-pegboard-ci-critical-path-1/packet';
const before=JSON.parse(readFileSync(join(packet,'before-verification.json')));
const after=await verificationPlan();
writeFileSync(join(packet,'after-verification.json'),JSON.stringify(after,null,2)+'\n');
const registry={};
function leaves(file,suite='',executionFile=file){
 const source=ts.createSourceFile(file,readFileSync(join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),rows=[];
 for(const statement of source.statements)if(ts.isImportDeclaration(statement)&&statement.moduleSpecifier.text.startsWith('.')&&statement.importClause?.namedBindings&&ts.isNamedImports(statement.importClause.namedBindings)){for(const element of statement.importClause.namedBindings.elements)if(/^register.*Tests$/.test(element.name.text))registry[element.name.text]=join(dirname(file),statement.moduleSpecifier.text);}
 function walk(node,parent){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)){
   const name=node.expression.text, first=node.arguments[0];
   if(name==='describe'&&first&&ts.isStringLiteral(first)){
    for(const arg of node.arguments.slice(1))if(ts.isArrowFunction(arg)||ts.isFunctionExpression(arg))walk(arg,first.text);
    return;
   }
   if(['it','test'].includes(name)&&first&&ts.isStringLiteral(first)){rows.push({file:executionFile,definedIn:file,suite:parent,name:first.text});return;}
   if(registry[name]){rows.push(...leaves(registry[name],parent,executionFile));return;}
   if(/^register.*Tests$/.test(name))throw Error('Unmapped test registration '+name+' in '+file);
   if(['it','test'].includes(name)&&first&&!ts.isStringLiteral(first))throw Error('Computed test name needs explicit enumeration in '+file);
  }
  ts.forEachChild(node,child=>walk(child,parent));
 }
 walk(source,suite);return rows;
}
const files=['tests/work-graph.test.mjs','tests/access-control.test.mjs','tests/portfolios.test.mjs','tests/schedule.test.mjs'];
const tests=files.flatMap(file=>leaves(file));
const scripts=JSON.parse(readFileSync(join(root,'package.json'))).scripts;
const expand=command=>{
 const script=/^pnpm run ([\w:-]+)$/.exec(command)?.[1];return script?scripts[script]:command;
};
function assignments(plan){
 const rows=[];
 for(const tier of ['push','nightly'])for(const shard of plan[tier])for(const lane of shard.lanes??[shard])for(const original of lane.commands){
  const command=expand(original),location=shard.name+(shard.lanes?'/'+lane.name:'');
  const include=/--test-name-pattern='([^']+)'/.exec(command)?.[1],skip=/--test-skip-pattern='([^']+)'/.exec(command)?.[1];
  for(const segment of command.split(' && ')) {
   const include=/--test-name-pattern='([^']+)'/.exec(segment)?.[1],skip=/--test-skip-pattern='([^']+)'/.exec(segment)?.[1];
  for(const file of files)if(segment.includes(file))for(const test of tests.filter(test=>test.file===file)){
   const full=test.suite+' '+test.name;
   if((!include||new RegExp(include).test(full))&&(!skip||!new RegExp(skip).test(full)))rows.push({id:file+' :: '+full,location});
  }
  }
  const journeys=/PEGBOARD_JOURNEY=([\w,-]+)/.exec(command)?.[1];
  if(journeys)for(const name of journeys.split(','))rows.push({id:'journey :: '+name,location});
  for(const file of ['tests/runtime.mjs','tests/journeys/templates.mjs','tests/journeys/conversions.mjs'])if(command.includes(file))rows.push({id:file,location});
 }
 return rows;
}
const a=assignments(before),b=assignments(after),ids=[...new Set([...a,...b].map(x=>x.id))].sort();
const bad=ids.filter(id=>a.filter(x=>x.id===id).length!==1||b.filter(x=>x.id===id).length!==1);
if(bad.length)throw Error('Coverage mismatch: '+JSON.stringify(bad));
const journeyText=readFileSync(join(root,'tests/journeys/work-graph.journey.mjs'),'utf8');
const declared=JSON.parse(/const journeyNames = (\[[^\n]+\])/.exec(journeyText)[1]);
if(declared.length!==a.filter(x=>x.id.startsWith('journey ::')).length)throw Error('Unmapped journey');
const out=['# Exhaustive test and journey mapping','',`Before: ${before.push.length} push jobs. After: ${after.push.length} push jobs, at most ${Math.max(...after.push.map(s=>s.lanes.length))} concurrent isolated lanes per job.`, '',`Selected test leaves: ${a.filter(x=>x.id.includes(' :: ')&&!x.id.startsWith('journey')).length} before / ${b.filter(x=>x.id.includes(' :: ')&&!x.id.startsWith('journey')).length} after. Browser journey selectors: ${declared.length} / ${declared.length}. Additional executable test files: 3 / 3. Every row occurs exactly once in each full run.`, '', '| Test / journey | Before | After |','| --- | --- | --- |'];
for(const id of ids)out.push('| '+[id.replaceAll('|','\\|'),a.find(x=>x.id===id).location,b.find(x=>x.id===id).location].join(' | ')+' |');
out.push('','## Commands and non-test checks','','| Command | Before | After |','| --- | --- | --- |');
const cmds=plan=>plan.push.flatMap(s=>s.commands);
for(const cmd of [...new Set(cmds(before))])if(!cmd.includes('test:work-graph-core')&&!cmd.includes('test:work-graph-time'))out.push('| `'+cmd.replaceAll('|','\\|')+'` | '+cmds(before).filter(x=>x===cmd).length+' | '+cmds(after).filter(x=>x===cmd).length+' |');
out.push('','Core: Test worker lifecycle, PEG-001, Work views and Native text intake suites vs the original selector with those four excluded. Time: Work planning suite vs the other three original suite prefixes. Recovery is split into Data custody versus diagnostics and retained graph recovery; intake erasure versus background rule audit; reporting/canvas versus Analyst exports; and the separate PDF-custody command moves intact into its own lane. All selector splits are disjoint complements of the prior selectors. No assertion or test file changed. The only removed non-test command is the second identical production build. Hosted output/hydration remain once in runtime-source; typecheck, first-party check and generated contract check remain unchanged. Nightly remains empty.');
out.push('', 'Provider diagnostics now runs alone before background rule audit. Goal suites join core; engineering and meeting suites join time; retained recovery joins reporting; capacity joins analyst exports; typecheck joins source. Their exact leaf selections remain disjoint and complete.');
out.push('',readFileSync(join(packet,'COMPONENT-JOURNEYS.md'),'utf8'));
writeFileSync(join(packet,'MAPPING.md'),out.join('\n')+'\n');
writeFileSync(join(packet,'mapping-receipt.json'),JSON.stringify({before:before.push.length,after:after.push.length,testLeaves:a.filter(x=>x.id.includes(' :: ')&&!x.id.startsWith('journey')).length,journeys:declared.length,otherTestFiles:3,rows:ids.length,duplicates:0,dropped:0,added:0,builds:{before:2,after:1}},null,2)+'\n');
console.log(out.slice(0,7).join('\n'));
