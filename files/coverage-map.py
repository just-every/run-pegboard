from pathlib import Path
import json,re,shlex,collections
root=Path('/home/agent/rer-consolidation/work/sx-pegboard-ci-critical-path-3/repo')
packet=Path.home()/'rer-consolidation/work/sx-pegboard-ci-critical-path-3/packet'
pkg=json.loads((root/'package.json').read_text())['scripts']
inventory=json.loads(Path('/tmp/pegboard-test-inventory.json').read_text())
tests=[r for r in inventory if r['type']=='test']
journeys=re.search(r'const journeyNames = (\[.*?\])', (root/'tests/journeys/work-graph.journey.mjs').read_text())[1]
journeys=json.loads(journeys)

def expand(command):
 parts=shlex.split(command)
 if parts[:2]==['pnpm','run']:
  return expand(pkg[parts[2]]+(' '+shlex.join(parts[3:]) if len(parts)>3 else ''))
 if 'sh' in parts and '-c' in parts:
  return expand(parts[parts.index('-c')+1])
 if '&&' in parts:
  out=[]; start=0
  for i,p in enumerate(parts+['&&']):
   if p=='&&':out+=expand(shlex.join(parts[start:i]));start=i+1
  return out
 return [parts]

def mapping(plan):
 out=collections.defaultdict(list);commands=[]
 for shard in plan['push']:
  for lane in shard['lanes']:
   for cmd in lane['commands']:
    commands.append({'shard':shard['name'],'lane':lane['name'],'command':cmd})
    for parts in expand(cmd):
     owner=shard['name']+' / '+lane['name']
     if '--test' in parts:
      include=next((p.split('=',1)[1] for p in parts if p.startswith('--test-name-pattern=')),None)
      exclude=next((p.split('=',1)[1] for p in parts if p.startswith('--test-skip-pattern=')),None)
      files=[p for p in parts if p.endswith('.test.mjs')]
      for t in tests:
       if t['file'] in files and (not include or re.search(include,t['name'])) and (not exclude or not re.search(exclude,t['name'])):
        out[t['file']+' :: '+t['name']].append(owner)
     elif 'tests/journeys/work-graph.journey.mjs' in parts:
      selection=next((p.split('=',1)[1].split(',') for p in parts if p.startswith('PEGBOARD_JOURNEY=')),journeys)
      for name in selection:out['journey :: '+name].append(owner)
     else:
      out['command :: '+shlex.join(parts)].append(owner)
 return dict(out),commands
before,bcommands=mapping(json.loads(Path('/tmp/pegboard-before-plan.json').read_text()))
after,acommands=mapping(json.loads(Path('/tmp/pegboard-after-plan.json').read_text()))
expected={t['file']+' :: '+t['name'] for t in tests}|{'journey :: '+j for j in journeys}
assert expected <= before.keys(), ('not covered before',expected-before.keys())
assert before.keys()==after.keys(), ('coverage differs',before.keys()-after.keys(),after.keys()-before.keys())
assert all(len(v)==1 for v in before.values()), ('before duplicated',{k:v for k,v in before.items() if len(v)!=1})
assert all(len(v)==1 for v in after.values()), ('after duplicated',{k:v for k,v in after.items() if len(v)!=1})
rows=[{'unit':key,'before':before[key][0],'after':after[key][0],'before_count':1,'after_count':1} for key in sorted(before)]
receipt={'before_tests':len(tests),'after_tests':len(tests),'before_journeys':len(journeys),'after_journeys':len(journeys),'before_commands':len(before)-len(expected),'after_commands':len(after)-len(expected),'units':len(rows),'duplicate_units':0,'dropped_units':0,'build_commands_before':sum(k=='command :: rer build' for k in before),'build_commands_after':sum(k=='command :: rer build' for k in after),'rows':rows}
(packet/'coverage.json').write_text(json.dumps(receipt,indent=2)+'\n')
(packet/'commands-before.json').write_text(json.dumps(bcommands,indent=2)+'\n')
(packet/'commands-after.json').write_text(json.dumps(acommands,indent=2)+'\n')
(packet/'MAPPING.md').write_text('# Complete coverage mapping\n\nRegistration was observed with a temporary Node loader that records node:test suite/test registration without invoking hooks or test bodies. Package aliases and rer queue wrappers were expanded, then the actual Node name/skip selectors were applied to every full leaf name. Journey names come from the runner registry. Standalone script assertions remain under their unchanged commands.\n\n| Test, journey or command | Before shard / lane | After shard / lane | Before / after count |\n| --- | --- | --- | --- |\n'+''.join('| '+r['unit'].replace('|','\\|')+' | '+r['before']+' | '+r['after']+' | 1 / 1 |\n' for r in rows))
print(json.dumps({k:v for k,v in receipt.items() if k!='rows'},indent=2))
