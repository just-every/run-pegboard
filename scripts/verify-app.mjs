import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Keep the declared coverage in verification.json. Pack it into eight jobs,
// using independent lanes split at suite and journey boundaries. The
// November 6 follow-up reached 12m16s in reporting-work.
// Keep the unknown-suite remainder in planning-services so new core coverage
// does not accumulate beside the already long core and PDF browser journeys.
// Separate working directories are essential: Vite and Wrangler write caches
// beside their configs even when each test has a private database and port.
function packPush(shards, scripts) {
 const lanes = new Map(shards.map(shard => [shard.name, { ...shard, commands: [...shard.commands] }]));
 const replace = (command, from, to) => {
  if (command.split(from).length !== 2) throw Error('Verification selector changed; review its packing');
  return command.replace(from, to);
 };
 const core = lanes.get('work-graph-core');
 const coreCommand = core.commands[0];
 const coreSuites = 'Test worker lifecycle|PEG-001 one work graph|Work views through the native graph|Native text intake';
 if (core.commands.length !== 1) throw Error('Review core lane packing');
 core.commands = [replace(coreCommand, ' tests/work-graph.test.mjs', ` --test-name-pattern='^(?:${coreSuites})(?: |$)' tests/work-graph.test.mjs`)];
 lanes.set('work-graph-intake', { ...core, name: 'work-graph-intake', commands: [replace(coreCommand, "--test-skip-pattern='^(?:", `--test-skip-pattern='^(?:${coreSuites}|`)] });
 const time = lanes.get('work-graph-time');
 const timeCommand = time.commands[0];
 if (time.commands.length !== 1) throw Error('Review time lane packing');
 time.commands = [replace(timeCommand, 'Work planning time, recurrence and decisions|Approval routing custody|Calendar work blocks through provider schema edges|Native approval follow-up', 'Work planning time, recurrence and decisions')];
 lanes.set('work-graph-decisions', { ...time, name: 'work-graph-decisions', commands: [replace(timeCommand, 'Work planning time, recurrence and decisions|', '')] });
 const recovery = lanes.get('work-graph-custody-recovery');
 const recoveryCommand = recovery.commands[0];
 if (recovery.commands.length !== 1) throw Error('Review recovery lane packing');
 recovery.commands = [replace(replace(recoveryCommand, 'Data custody|PEG-064 retained graph recovery', 'Data custody'), 'Data custody intake erasure|Data custody PDF feedback', 'Data custody intake erasure|Data custody PDF feedback|Data custody provider diagnostics')];
 lanes.set('work-graph-recovery', { ...recovery, name: 'work-graph-recovery', commands: [replace(recoveryCommand, 'Data custody|PEG-064 retained graph recovery', 'Data custody provider diagnostics|PEG-064 retained graph recovery')] });
 const erasure = lanes.get('work-graph-custody-erasure');
 const erasureCommand = erasure.commands[0];
 if (erasure.commands.length !== 1) throw Error('Review erasure lane packing');
 erasure.commands = [replace(erasureCommand, 'Data custody intake erasure|Local rule audit attributes background', 'Data custody intake erasure')];
 lanes.set('work-graph-rule-audit', { ...erasure, name: 'work-graph-rule-audit', commands: [replace(erasureCommand, 'Data custody intake erasure|Local rule audit attributes background', 'Local rule audit attributes background')] });
 const reporting = lanes.get('work-graph-reporting');
 const reportingCommand = reporting.commands[0];
 if (reporting.commands.length !== 1) throw Error('Review reporting lane packing');
 reporting.commands = [replace(reportingCommand, 'Native reporting|Analyst exports|Project planning canvas', 'Native reporting|Project planning canvas')];
 lanes.set('work-graph-analyst', { ...reporting, name: 'work-graph-analyst', commands: [replace(reportingCommand, 'Native reporting|Analyst exports|Project planning canvas', 'Analyst exports')] });
 const extensions = lanes.get('work-graph-extensions');
 if (extensions.commands.length !== 2) throw Error('Review extension lane packing');
 lanes.set('work-graph-pdf-custody', { ...extensions, name: 'work-graph-pdf-custody', commands: extensions.commands.splice(1) });
 // The diagnostics scenario has its own six-minute assertion deadline. A
 // three-way CPU share took 396s and cancelled it, although its native restore
 // completed afterward. Give it the runner alone; the browser tail starts
 // only after diagnostics has finished.
 const retained = lanes.get('work-graph-recovery');
 const retainedCommand = retained.commands[0];
 retained.commands = [replace(retainedCommand, 'Data custody provider diagnostics|PEG-064 retained graph recovery', 'PEG-064 retained graph recovery')];
 lanes.set('provider-diagnostics', { ...retained, name: 'provider-diagnostics', commands: [replace(retainedCommand, 'Data custody provider diagnostics|PEG-064 retained graph recovery', 'Data custody provider diagnostics')] });
 const appendLane = (target, source) => {
  const destination = lanes.get(target), incoming = lanes.get(source);
  if (!destination || !incoming || incoming.hosted) throw Error('Review sequential lane packing');
  destination.commands.push(...incoming.commands);
  destination.browser ||= incoming.browser;
  lanes.delete(source);
 };
 appendLane('workflow-rules', 'work-graph-recovery');
 const services = lanes.get('work-graph-services');
 if (services.commands.length !== 1) throw Error('Review services lane packing');
 lanes.get('access-control').commands.push(replace(services.commands[0], 'Goal visibility and accountability|Engineering handoff|Meeting review', 'Goal visibility and accountability'));
 lanes.get('work-graph-time').commands.push(replace(services.commands[0], 'Goal visibility and accountability|Engineering handoff|Meeting review', 'Engineering handoff|Meeting review'));
 lanes.delete('work-graph-services');
 // Runtime needs the emitted Worker; hosted/hydration checks use that same
 // build after all lanes finish. The second identical build adds no coverage.
 const runtime = lanes.get('runtime');
 if (runtime.commands[0] !== 'pnpm run build' || runtime.commands.filter(command => command === 'pnpm run build').length !== 2) throw Error('Review runtime build packing');
 runtime.commands.splice(runtime.commands.indexOf('pnpm run build', 1), 1);
 const moveCommand = (command, destination) => {
  if (runtime.commands.filter(text => text === command).length !== 1) throw Error('Review runtime command packing');
  runtime.commands.splice(runtime.commands.indexOf(command), 1);
  lanes.get(destination).commands.push(command);
 };
 lanes.set('portfolio-capacity', { name: 'portfolio-capacity', browser: false, hosted: false, commands: [] });
 lanes.set('intake-decisions', { name: 'intake-decisions', browser: false, hosted: false, commands: [] });
 moveCommand('pnpm run test:graph:capacity', 'portfolio-capacity');
 moveCommand('pnpm run typecheck', 'source');
 // The fallback lane remains open to newly registered core suites. Move the
 // retained PDF API suite to the shorter analyst selection, without another
 // Worker or a second pass through any assertion.
 const intake = lanes.get('work-graph-intake');
 intake.commands[0] = replace(intake.commands[0], `--test-skip-pattern='^(?:`, `--test-skip-pattern='^(?:Native intake decisions|Retained PDF feedback|`);
 // Run 42303067464 spent 294s in exclusive diagnostics, then 186s in
 // capacity before even starting intake decisions; rule audit took 353s
 // alongside that tail. Move both complete selections to the two shortest
 // jobs as independent lanes. Neither waits behind diagnostics or another
 // suite, and diagnostics retains the runner alone before its browser tail.
 lanes.get('intake-decisions').commands.push(replace(coreCommand, ' tests/work-graph.test.mjs', ` --test-name-pattern='^(?:Native intake decisions)(?: |$)' tests/work-graph.test.mjs`));
 const analyst = lanes.get('work-graph-analyst');
 analyst.commands[0] = replace(analyst.commands[0], 'Analyst exports', 'Analyst exports|Retained PDF feedback');
 // Journey selection already gives each journey a fresh Worker. Moving names
 // between existing commands adds neither migrations nor browser launches.
 const moveJourney = (name, from, to) => {
  for (const [lane, take] of [[lanes.get(from), true], [lanes.get(to), false]]) {
   if (lane.commands.length !== 1) throw Error('Review journey lane packing');
   const command = lane.commands[0], match = /PEGBOARD_JOURNEY=([a-z0-9,-]+)/.exec(command);
   if (!match) throw Error('Review journey selection');
   const names = match[1].split(',');
   if (names.filter(value => value === name).length !== (take ? 1 : 0)) throw Error(`Missing or repeated journey: ${name}`);
   const selected = take ? names.filter(value => value !== name) : [...names, name];
   if (!selected.length) throw Error('Empty journey lane');
   lane.commands[0] = command.replace(match[0], `PEGBOARD_JOURNEY=${selected.join(',')}`);
  }
 };
 // Use the idle end of an API lane instead of growing a browser lane that
 // already determines its job's finish. Each journey still owns one Worker;
 // the separate command adds only another browser launch and service fixture.
 const moveJourneyToTail = (name, from, to) => {
  const source = lanes.get(from), destination = lanes.get(to);
  if (source.commands.length !== 1 || !destination) throw Error('Review journey tail packing');
  const command = source.commands[0], match = /PEGBOARD_JOURNEY=([a-z0-9,-]+)/.exec(command);
  if (!match) throw Error('Review journey tail selection');
  const names = match[1].split(',');
  if (names.filter(value => value === name).length !== 1 || names.length < 2) throw Error(`Missing or repeated journey: ${name}`);
  source.commands[0] = command.replace(match[0], `PEGBOARD_JOURNEY=${names.filter(value => value !== name).join(',')}`);
  destination.commands.push(command.replace(match[0], `PEGBOARD_JOURNEY=${name}`));
  destination.browser = true;
 };
 moveJourneyToTail('retained-pdf-review', 'journeys-core-work', 'work-graph-reporting');
 moveJourney('pdf-feedback', 'journeys-core-work', 'journeys-planning-capacity');
 // Run 42309430502's work-views refresh failed while three API lanes were
 // active. It passes alone in 57s including typecheck and installation. Each
 // journey already owns a fresh database; put work-views and canvas after
 // exclusive diagnostics so their browser polling has the runner to itself.
 lanes.set('recovery-journeys', { name: 'recovery-journeys', browser: true, hosted: false, commands: [] });
 moveJourneyToTail('work-views', 'journeys-planning-capacity', 'recovery-journeys');
 moveJourney('canvas', 'journeys-planning-capacity', 'recovery-journeys');
 moveJourney('analytics', 'journeys-services-work', 'journeys-planning-capacity');
 moveJourney('guests', 'journeys-core-access', 'journeys-planning-work');
 // The retained audit took 282s after 291s of diagnostics. Capacity finishes
 // early (209s) in runtime-source, leaving room for that complete audit suite.
 appendLane('portfolio-capacity', 'work-graph-rule-audit');
 // Portfolios took 616s. Its template suite owns a separate Worker and takes
 // 77s; run the complete suite after intake decisions (335s) in core-capacity.
 const portfolios = lanes.get('portfolios');
 if (portfolios.commands.length !== 1 || portfolios.commands[0] !== 'pnpm run test:graph:portfolios:core') throw Error('Review portfolio lane packing');
 const portfolioCommand = scripts['test:graph:portfolios:core'];
 const skip = /--test-skip-pattern='[^']+'/.exec(portfolioCommand)?.[0];
 if (!skip) throw Error('Review portfolio suite selection');
 portfolios.commands[0] = replace(portfolioCommand, "--test-skip-pattern='^(?:", "--test-skip-pattern='^(?:Reusable templates through reviewed public doors|");
 lanes.get('intake-decisions').commands.push(replace(portfolioCommand, skip, "--test-name-pattern='^Reusable templates through reviewed public doors(?: |$)'"));
 const groups = [
  ['runtime-source', ['runtime', 'source', 'access-control', 'portfolio-capacity']],
  ['core-capacity', ['work-graph-core', 'work-graph-custody-recovery', 'journeys-planning-capacity', 'intake-decisions']],
  ['extensions-services', ['work-graph-extensions', 'portfolios', 'journeys-services-work']],
  ['time-planning', ['work-graph-time', 'work-graph-decisions', 'journeys-planning-work']],
  ['custody-recovery', ['provider-diagnostics', 'recovery-journeys']],
  ['custody-access', ['work-graph-custody-erasure', 'journeys-services', 'journeys-core-access']],
  ['reporting-work', ['work-graph-reporting', 'work-graph-analyst', 'journeys-core-work']],
  ['planning-services', ['work-graph-intake', 'work-graph-pdf-custody', 'workflow-rules']],
 ];
 const used = new Set();
 const packed = groups.map(([name, members]) => {
  const selected = members.map(member => {
   if (!lanes.has(member) || used.has(member)) throw Error(`Missing or repeated verification lane: ${member}`);
   used.add(member);
   return lanes.get(member);
  });
  return { name, browser: selected.some(lane => lane.browser), hosted: selected.some(lane => lane.hosted),
   commands: selected.flatMap(lane => lane.commands), lanes: selected, exclusive: name === 'custody-recovery' ? 'provider-diagnostics' : undefined };
 });
 if (used.size !== lanes.size) throw Error('Unassigned verification lane');
 return packed;
}

export async function verificationPlan() {
 const plan = JSON.parse(await readFile(new URL('../verification.json', import.meta.url), 'utf8'));
 const names = new Set();
 for (const tier of ['push', 'nightly']) {
  if (!Array.isArray(plan[tier])) throw Error(`Missing verification tier: ${tier}`);
  for (const shard of plan[tier]) {
   if (!/^[a-z][a-z0-9-]*$/.test(shard.name) || names.has(shard.name)) throw Error(`Invalid or duplicate shard: ${shard.name}`);
   if (typeof shard.browser !== 'boolean' || typeof shard.hosted !== 'boolean' || !Array.isArray(shard.commands) || !shard.commands.length || shard.commands.some(command => typeof command !== 'string' || !command.trim())) throw Error(`Incomplete shard: ${shard.name}`);
   names.add(shard.name);
  }
 }
 if (!plan.push.length || plan.push.filter(shard => shard.hosted).length !== 1) throw Error('Push verification must include the hosted production build');
 const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
 plan.push = packPush(plan.push, scripts);
 return plan;
}

export function run(command, env = process.env) {
 console.log(`> ${command}`);
 const result = spawnSync('/bin/bash', ['-euo', 'pipefail', '-c', command], { stdio: 'inherit', env });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}

export async function runLanes(shard) {
 const root = process.cwd();
 // Copy only repository inputs and the frozen dependencies, never local owner
 // settings, stores, command locks, build output or browser proof artifacts.
 const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
 if (tracked.error || tracked.status !== 0) throw Error('Cannot enumerate verification inputs');
 const scratch = await mkdtemp(join(tmpdir(), 'pegboard-verify-'));
 const entries = new Set(tracked.stdout.split('\0').filter(Boolean).map(path => path.split('/')[0]));
 entries.add('node_modules');
 entries.add('.git');
 const command = (text, cwd, lane) => new Promise((resolve, reject) => {
  console.log(`> [${lane}] ${text}`);
  const env = { ...process.env };
  if (cwd !== root) delete env.RER_LOCAL_OPERATION;
  const child = spawn('/bin/bash', ['-euo', 'pipefail', '-c', text], { cwd, stdio: 'inherit', env });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`${lane} failed: ${signal ?? code}`)));
 });
 const started = Date.now();
 try {
  // Prepare copies serially before starting Workers: source reads cannot race
  // with another lane writing a cache. The hosted lane alone owns root/dist.
  const directories = new Map();
  for (const lane of shard.lanes) {
   const cwd = lane.hosted ? root : join(scratch, lane.name);
   if (!lane.hosted) {
    await mkdir(cwd, { recursive: true });
    for (const entry of await readdir(root)) if (entries.has(entry)) {
     await cp(join(root, entry), join(cwd, entry), { recursive: true, verbatimSymlinks: true });
    }
   }
   directories.set(lane.name, cwd);
  }
  // Await every lane even after a failure. No sibling assertion is cancelled,
  // and cleanup cannot remove a working directory while its Worker still runs.
  const execute = async lane => {
   const start = Date.now();
   try { for (const text of lane.commands) await command(text, directories.get(lane.name), lane.name); }
   finally { console.log(`LANE ${lane.name} duration_ms=${Date.now() - start}`); }
  };
  const results = [];
  // Diagnostics and its browser tail each keep the runner to themselves.
  // All other groups run their isolated lanes concurrently.
  const exclusive = shard.lanes.find(lane => lane.name === shard.exclusive);
  if (exclusive) {
   try { await execute(exclusive); results.push({ status: 'fulfilled' }); }
   catch (reason) { results.push({ status: 'rejected', reason }); }
  }
  results.push(...await Promise.allSettled(shard.lanes.filter(lane => lane !== exclusive).map(execute)));
  for (const result of results) if (result.status === 'rejected') console.error(result.reason);
  if (results.some(result => result.status === 'rejected')) throw Error(`Verification shard failed: ${shard.name}`);
 } finally {
  await rm(scratch, { recursive: true, force: true });
  console.log(`SHARD ${shard.name} duration_ms=${Date.now() - started}`);
 }
}

if (process.argv[1] === import.meta.filename) {
 const plan = await verificationPlan();
 const all = [...plan.push, ...plan.nightly];
 const selected = process.env.SEED_VERIFY_SHARD;
 const shards = selected ? all.filter(shard => shard.name === selected) : all;
 if (!shards.length) throw Error(`Unknown verification shard: ${selected}`);
 for (const shard of shards) {
  if (shard.lanes) await runLanes(shard);
  else for (const command of shard.commands) run(command);
 }
}
