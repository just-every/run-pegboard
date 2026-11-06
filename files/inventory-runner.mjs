import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
for (const file of ['tests/work-graph.test.mjs', 'tests/portfolios.test.mjs', 'tests/schedule.test.mjs', 'tests/access-control.test.mjs']) {
 globalThis.__pegboardFile = file;
 await import(pathToFileURL(`${process.cwd()}/${file}`));
}
writeFileSync('/tmp/pegboard-test-inventory.json', JSON.stringify(globalThis.__pegboardTestInventory, null, 2));
console.log(globalThis.__pegboardTestInventory.reduce((c,r)=>(c[r.type]++,c),{test:0,suite:0}));
