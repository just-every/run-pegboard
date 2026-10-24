import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { deploymentSpec } from './delivery/base/spec.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('packaging.json', root), 'utf8'));
const spec = await deploymentSpec(root.pathname, config.artifact.specInputs);
const bytes = `${JSON.stringify(spec, null, 2)}\n`;
const target = new URL('management/integration/deployment-spec.json', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== bytes) throw Error('Deployment specification is stale; run pnpm delivery:spec after building.');
  console.log('Deployment specification is current.');
} else {
  await mkdir(new URL('.', target), { recursive: true });
  await writeFile(target, bytes);
  console.log('Wrote management/integration/deployment-spec.json.');
}
