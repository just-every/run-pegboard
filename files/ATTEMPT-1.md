# sx-pegboard-ci-critical-path-2

Repository: just-every/run-pegboard. Branch: cloud/sx-pegboard-ci-critical-path-2.
Base: f0386615142fdd50970be89ae671391def0a18fc. Product candidate: 2ecb289f89c81ef79b0e45366c08f66de7804d5b.
Exact-SHA Verify: https://github.com/just-every/run-pegboard/actions/runs/42299250458.
PR: none; repository instructions do not require one for this handoff. No main push or landing was attempted.

## Plan and scope

1. Refresh the fleet bundle, install the credential helper and push guard, and check recent CI-shape branch custody before making any repository change.
2. Shallow filtered clone current main. Inspect Verify, all three CI scripts, the declared verification commands, repository instructions and source custody. Read the two requested historical runs' job durations once; inspect the follow-up failure's lane timings.
3. Look for repeated work before moving coverage. Retain the first pass's single build. Neither the plan nor summary repeats the tests. Do not share mutable Vite/Wrangler working directories or prepared owner databases. Preserve every test and journey.
4. Move complete suites and journey names between isolated lanes. Fill the unused post-diagnostics phase with capacity tests while diagnostics itself keeps exclusive CPU. Preserve eight jobs, at most three simultaneous lanes, ubuntu-24.04, 12-minute limits, workflow plan/reuse/concurrency, frozen dependencies, all assertions and hosted/hydration coverage.
5. Derive a complete leaf-test, journey and unchanged-command before/after mapping. Run meaningful scheduler probes, syntax/workflow checks, build, typecheck and first-party checks. Regenerate the source lock last and check it.
6. Commit only the invoked CI script and its source lock; inspect all candidate author/committer identities and messages; publish the named branch once through cloud-push.py. Observe its exact-SHA push Verify with REST within the ten-call GitHub budget. Rerun failed infrastructure jobs at most once if needed; never dispatch a new Verify.
7. Save complete public-safe reports and receipts separately, publish them on evidence/sx-pegboard-ci-critical-path-2, and return product status independently of evidence transport.

## Custody

Checked GitHub branch refs at 2026-11-06T21:36:48Z. The only recent matching branch was the explicitly excluded landed critical-path-1, at current main f0386615142fdd50970be89ae671391def0a18fc (20:10:15Z). Other cloud/sx-pegboard-ci* or cishape* matches were November 4 or older. No competing live writer appeared. Full API result: custody.json.

## Observed critical path

Run 42268005252's latest attempt cut work-graph-core after 736 seconds; other shards passed. Run 42252802997's latest attempt was green, with work-graph-core at 510 seconds. Actual returned job data is retained in the two corresponding run-*-jobs.json files.

Follow-up run 42295381995 on the announcement candidate had shard durations 529, 578, 553, 650, 537, 667, 419 and 736 seconds, total 4669 seconds (77m49s), mean 583.625 seconds (9m43.625s), maximum/mean 1.261. The final 736-second observation was censored by cancellation. It is not proof of that shard's complete duration.

Its command log showed PDF custody at 592.725 seconds, intake at 614.319 seconds including the new Project announcements suite (239.5 seconds), and core-work browser journeys still running at the job cutoff. Reporting's API lanes had already finished at 512.306 and 524.055 seconds. The lightest planning-services job finished in 419 seconds. Diagnostics took 259.878 seconds alone, followed by 253.257 seconds of rule audit; that serial tail left capacity available. See historical-lane-timings.txt. Raw workflow logs are not part of this public packet; the selected evidence contains only command names and durations.

The historical follow-up includes unlanded announcement coverage; this branch starts from current main as requested and does not import those product/tests. Thus cross-run times are observations, not a controlled claim that only composition caused their difference. The selector probe confirms future unknown core coverage remains selected once.

There is no evidence that balanced work cannot fit the existing limit, so the timeout and thresholds remain unchanged. The build was already once after the first pass and stays once. Derived log timings put runner setup before the shard step at 16.3–36.7 seconds, lane preparation before the first command at 12.0–26.7 seconds, and final scratch cleanup at 1.1–2.0 seconds (historical-overhead.json). These do not explain the multi-minute heavy selections; sharing mutable test installations would change isolation. No duplicate summary work was found. Each selected suite owns its test Worker; moving selectors between existing commands avoids additional Worker setup. The new independent capacity lane requires another isolated checkout copy but uses the same capacity command and same Workers as before. Vite/Wrangler caches remain isolated.

## Final composition

| Shard | Before lanes | After lanes |
| --- | --- | --- |
| runtime-source | runtime, source, access-control | runtime, source, access-control |
| core-capacity | work-graph-core, work-graph-intake, journeys-planning-capacity | work-graph-core, work-graph-custody-recovery, journeys-planning-capacity |
| extensions-services | work-graph-extensions, work-graph-pdf-custody, journeys-services-work | work-graph-extensions, portfolios, journeys-services-work |
| time-planning | work-graph-time, work-graph-decisions, journeys-planning-work | work-graph-time, work-graph-decisions, journeys-planning-work |
| custody-recovery | provider-diagnostics, work-graph-rule-audit | provider-diagnostics, work-graph-rule-audit, portfolio-capacity |
| custody-access | work-graph-custody-erasure, journeys-services, journeys-core-access | work-graph-custody-erasure, journeys-services, journeys-core-access |
| reporting-work | work-graph-reporting, work-graph-analyst, journeys-core-work | work-graph-reporting, work-graph-analyst, journeys-core-work |
| planning-services | work-graph-custody-recovery, portfolios, workflow-rules | work-graph-intake, work-graph-pdf-custody, workflow-rules |

Additional movements within lanes:

- Native intake decisions moves from the fallback core selector to the bounded core selector.
- Goal visibility moves from core to the access-control lane in runtime-source.
- Retained PDF API feedback moves from fallback core to the analyst selector. Newly registered unmatched core suites continue through the fallback, now in planning-services.
- Retained graph recovery moves from reporting to the workflow-rules lane.
- Portfolio capacity moves from the analyst tail to its own isolated lane after diagnostics, concurrent with rule audit. Diagnostics never shares CPU with it.
- retained-pdf-review and pdf-feedback browser journeys move from core-work to planning-capacity; canvas moves from planning-capacity to planning-work. All names are preserved exactly once.
- PDF custody and portfolio core exchange groups; Data custody leaves planning-services for core-capacity. No suite's assertions, deadlines, migration inputs or product implementation change.

The workflow file, plan job, one-full-run-per-commit rules, concurrency group and runner versions are byte-identical to main. Only scripts/verify-app.mjs and sources.lock.json change. There are no product, test, migration, contract or generated-view changes. Clause status changes: none.

## Coverage and local validation

148 registered node:test leaves before and after; 35 named journeys before and after; 7 other verification commands before and after. Every unit has multiplicity one in both plans, with zero dropped or duplicated units. One application build and one hosted verification lane in both plans. MAPPING.md lists every unit and its before/after owner; coverage.json is the machine-readable receipt. commands-before.json and commands-after.json contain the actual packed commands.

The inventory used temporary test-registration instrumentation outside the repository: describe callbacks register names, hooks and assertion bodies never execute. Package scripts and queue wrappers are recursively expanded before applying the actual include/skip selectors to full leaf names. This is structural coverage proof, separate from executing assertions. The unchanged standalone runtime/templates/conversions scripts keep all assertions under their exact commands.

Passed: rer setup with the required fleet owner, rer build, typecheck, rer check --profile first-party, Node syntax, reusable-workflow permissions, matrix enumeration, git diff --check, source lock regeneration/check, and an isolated scheduler execution probe. The probe checks exclusive diagnostics, simultaneous tail selections, separate working directories and cleanup; it deliberately fails diagnostics in a second pass and proves both remaining lanes still finish before rejection. The expected probe failure is not a product assertion failure.

Local environment used Node 24.19.0 with pnpm 10.12.4; the provided toolchain keeps a newer VM Node. CI remains pinned to Node 22.20.0. Final assertion and timing acceptance comes from exact-SHA CI, not from extrapolating cloud timings. Full local core-capacity execution passed (exit 0): 17 bounded-core tests in 5 suites, 9 Data custody tests in 1 suite, and all five selected browser journeys. Retained PDF review and feedback checks covered 1440 and 390; other journeys retained their existing assertion/proof-width policies. Zero assertion failures, cancellations or skips. Actual logs and local-core-receipt.json are retained. Its 962.248-second wall time includes serialization by local operator policy through one queue slot; this is not a CI timing measurement and no queue settings were changed.

## Publication and remaining gates

Product push succeeded on its first attempt at 2026-11-06T21:44:54Z. Fleet identity and no trailers were verified for the sole unpublished candidate before push. The checkout is retained, and its product commit is on the named cloud branch. Exact-SHA Verify run 42299250458 completed/success, observed via REST at 2026-11-06T22:00:46Z. No rerun or second product push was needed. Every shard duration and the maximum/mean ratio will be added from the next permitted job-metadata read before evidence publication. Independent landing and publication scans remain with the fleet.

## Exact-SHA CI result

Verify run 42299250458 completed/success on 2ecb289f89c81ef79b0e45366c08f66de7804d5b. No builder rerun or extra product push. All eight shard jobs succeeded. Job metadata is retained in candidate-jobs.json and calculations in ci-receipt.json.

| Shard | Job ID | Wall duration | Result |
| --- | --- | --- | --- |
| shards (extensions-services) | 128172509120 | 9m21s | success |
| shards (planning-services) | 128172509232 | 8m54s | success |
| shards (time-planning) | 128172509258 | 11m45s | success |
| shards (custody-recovery) | 128172509271 | 8m36s | success |
| shards (core-capacity) | 128172509294 | 11m24s | success |
| shards (runtime-source) | 128172509362 | 9m24s | success |
| shards (reporting-work) | 128172509406 | 9m23s | success |
| shards (custody-access) | 128172509429 | 9m24s | success |

Longest: shards (time-planning), 11m45s. Mean: 586.375 seconds (9m46s). Maximum/mean: 1.202. Sum of shard durations: 78m11s. Longest margin to the unchanged 12-minute timeout: 0m15s. Within 1.2 times the mean: False. No product or contract clause status changes.

There are no unresolved assertion failures. Product landing and publication remain with the fleet, independently of evidence transfer. The local checkout and remote cloud branch retain the exact green product SHA. All reports are selected as regular files, excluding private setup output, credentials, environment dumps, owner state, and held-out gate material.
