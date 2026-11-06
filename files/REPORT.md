# Pegboard CI critical path, pass 3

Repository: just-every/run-pegboard. Product branch: cloud/sx-pegboard-ci-critical-path-3.
Source predecessor: 5c9580015024cf018316a34feeedb9dcf66216dc.
Current main/base: f0386615142fdd50970be89ae671391def0a18fc.
No PR is required by the supplied repository rules; none was opened. The normal branch push is the only new full Verify trigger.

## Problem and resulting composition

The predecessor's Verify 42303067464 failed twice at the twelve-minute custody-recovery job limit. Attempt 2 job 128191715894 lasted 734 seconds, with seven green siblings. Its actual log shows exclusive diagnostics finishing after 293.974 seconds, then capacity consuming 186.644 seconds before intake decisions could start. Rule audit ran concurrently with that capacity/intake tail for 353.216 seconds. Intake was still unfinished at cancellation. This is a composition failure, not an infrastructure rerun opportunity in this pass.

The correction keeps diagnostics alone and gives rule audit the runner alone afterward. The complete portfolio capacity command moves into runtime-source, and the complete Native intake decisions selection moves into core-capacity. Both become independent lanes using the existing isolated-directory executor. The receiver jobs were the shortest at 459 and 412 seconds. They now have four lanes each; custody-recovery has two serial lanes. Other jobs keep three lanes. These moves remove at least the observed 186.644-second capacity span and the previously measured 296.200-second intake span from behind diagnostics. Those spans overlapped rule audit in the predecessor, so their sum is not a claimed wall-time saving.

| Shard | Candidate isolated lanes |
| --- | --- |
| runtime-source | runtime, source, access-control, portfolio-capacity |
| core-capacity | work-graph-core, work-graph-custody-recovery, journeys-planning-capacity, intake-decisions |
| extensions-services | work-graph-extensions, portfolios, journeys-services-work |
| time-planning | work-graph-time, work-graph-decisions, journeys-planning-work |
| custody-recovery | provider-diagnostics alone, then work-graph-rule-audit alone |
| custody-access | work-graph-custody-erasure, journeys-services, journeys-core-access |
| reporting-work | work-graph-reporting, work-graph-analyst, journeys-core-work |
| planning-services | work-graph-intake, work-graph-pdf-custody, workflow-rules |

Only scripts/verify-app.mjs and its generated source-lock entry change in this pass. Its two predecessor commits are retained unchanged. No product, test, migration, contract, generated acceptance view, workflow YAML or plan/reuse script changes. All timeouts, assertion deadlines, ubuntu-24.04, the workflow concurrency group and the one-full-run-per-commit behavior are unchanged.

The earlier pass already removed a duplicate production build; one build remains. The summary job only checks results, and each test Worker needs its own migrated store and owner. Sharing those mutable installations would change isolation. This pass uses the existing lane executor and removes the long serial tail rather than sharing setup or dropping an assertion. A new isolated directory adds preparation work, and four concurrent lanes may contend for CPU; the exact candidate's CI timings determine the actual outcome.

## Complete plan and custody

PLAN.md records the full sequence, scope, measurements, validation and return protocol. The custody query found the supplied critical-path-2 predecessor and no other matching branch committed within the two-hour window. The landed critical-path-1 and old cishape/cishard branches are not competing live work. The first GraphQL query was rejected for an invalid refPrefix; its successful correction and the error both count against the ten-call budget. Historical job lists were read once for 42268005252 and 42252802997, followed by the predecessor's current jobs and cancelled-job log archive. No forbidden direct log-blob request was made.

A shallow filtered main clone fetched the supplied predecessor. Main was already its base, so no rebase/merge was necessary. Fleet identity and preserved repository hooks remain active. Candidate authors, committers, messages and all trailers, including side parents, are inspected before the single guarded product push. The source lock was regenerated last after staging the script and then checked. No history is rewritten, main is not pushed, and reports are kept out of product commits.

## Coverage and local evidence

MAPPING.md lists every covered unit from the predecessor to this candidate. coverage.json and commands-before/after.json are machine-readable proof. The instrumentation only registers node:test suite/test names; it does not run hooks or test bodies. Alias/queue expansion and actual include/exclude selectors assign every registered leaf test. Unchanged runtime, template and conversion commands retain their own internal assertions. No permanent pin test was added.

| Coverage | Before | After |
| --- | ---: | ---: |
| Registered leaf tests | 148 | 148 |
| Journey selections | 35 | 35 |
| Other verification commands | 7 | 7 |
| Total mapped units | 190 | 190 |
| Duplicated or dropped units | 0 | 0 |
| Push shard jobs | 8 | 8 |
| Production build commands | 1 | 1 |

Syntax, workflow permissions, plan/matrix enumeration, build, typecheck, first-party checks and the scheduler execution probe passed. The probe exercised four isolated directories, exclusive diagnostics, concurrent remaining lanes and failure aggregation without cancelling siblings. Its deliberate failing child is expected and the probe itself passed.

Initial direct test commands from the setup checkout failed with owner-bootstrap invalid_host because the checkout contained private local settings. Those owned processes were stopped. A pinned-Node direct retry was also stopped when that local-settings cause was identified. The actual rerun uses the same runLanes tracked-input copy filter as CI, excludes private owner settings, and uses Node 22.20.0. Those initial attempts do not count as product assertion evidence. Actual local final selection results and exact-SHA CI outcomes are recorded in their receipts and in the final outcome section below. No test or authorization check was changed to address the local fixture issue.

Clause counts remain 22 done, 20 partial and 50 missing. No clause status changes; the source and both generated views are unchanged. No UI or product behavior changes were requested or made.

## Publication boundary

Only explicitly selected regular report/receipt files are published to evidence/sx-pegboard-ci-critical-path-3. The complete raw cancelled workflow log is retained outside the selected packet; derived public command/selection spans are included. Credentials, environment dumps, private setup output, local owner state, held-out gate material and symlinks are excluded. Evidence publication is separate from product READY, acceptance, publication scanning and landing.

## Product and local outcome

Product head: 80d572830e8400e2183f520aafd5efaf7fb0bd0a. One product push succeeded on its first transport attempt. Exact-SHA Verify run: [42309430502](https://github.com/just-every/run-pegboard/actions/runs/42309430502). Its initial discovery was queued; final outcome is recorded below after the watcher completes. Main was fetched again after the published save and remains f0386615, so there is no updated main to merge.

Both moved selections passed locally through the CI lane executor: four capacity tests and one intake decision test, zero failures and zero skips. The queue serialized them locally. LANE durations include waiting and are not comparable to GitHub job durations. The scheduler probe also passed with four isolated directories. Local receipt and selection log preserve the actual results.

## Candidate CI result: blocked

The exact candidate did not pass. Job details from Verify 42309430502 show seven green shards and core-capacity job 128206975764 failed after 480 seconds. All returned jobs, including the failed verify summary, were completed. The last separate run-level REST status was in_progress before the completed-jobs read; no run-level success is claimed. The final allowed GitHub call is reserved for the required failed-job log. No new Verify was dispatched and no rerun was requested.

| Shard | Result | Seconds |
| --- | --- | ---: |
| runtime-source | success | 429 |
| core-capacity | failure | 480 |
| extensions-services | success | 671 |
| time-planning | success | 527 |
| custody-recovery | success | 608 |
| custody-access | success | 583 |
| reporting-work | success | 535 |
| planning-services | success | 544 |

The predecessor custody-recovery cancellation at 734 seconds became a successful 608-second job, but the requested 480–570-second band was not achieved. The longest observed candidate shard was extensions-services at 671 seconds (11m11s), with 49 seconds of margin to the unchanged 12-minute limit. Custody-recovery took 10m08s and custody-access 9m43s. The observed mean including the failed job was 547.125 seconds and longest/mean 1.226411, above 1.2. Because core-capacity failed, these timings are not evidence of a balanced successful full run. Runtime-source also finished below the requested band, at 7m09s.

No READY or performance-acceptance claim is made. Product custody remains the pushed branch at 80d572830e8400e2183f520aafd5efaf7fb0bd0a, with all test and journey definitions preserved and all clause statuses unchanged. The actual failing selection and lane spans are appended after the archive read. The exact product commit is retained for review; no empty commit, timeout increase, assertion change, force push or main push is used to obtain green.

## Final assertion diagnosis and measured critical paths

The required one-time archive command succeeded: `gh run view 42309430502 --repo just-every/run-pegboard --job 128206975764 --log-failed`. The failure is `workViewsJourney` at `tests/journeys/work-views.mjs:120`. After the owner previews and confirms erasure of the transient “Withdrawn launch work” task, the open work view still contains its row: expected count 0, received 1 throughout the existing 5000ms assertion deadline. This is a real browser assertion, not SQLITE_BUSY, cancellation, address-in-use or a provider transport signature. Its underlying product/timing cause is unproved. No rerun is authorized for that signature and no product/test edit is in scope. The journey's later assertions were not reached; the complete mapping proves the planned selection, not successful full-run coverage.

The archive also provides all actual lane/command spans without another GitHub call, preserved in candidate-lane-metrics.txt. Diagnostics took 291.180 seconds alone and rule audit 282.287 seconds alone: 573.467 seconds of serial assertion work before preparation/cleanup. That already exceeds the 570-second target, and the whole job took 608 seconds. There is no repeated production build or removable summary work explaining it. Further composition changes are necessary; no timeout increase is justified.

The moved capacity lane completed in 209.085 seconds in runtime-source. Intake decisions completed in 334.846 seconds in core-capacity. All three API siblings in the failed core job completed; the executor awaited them after the browser assertion failed. Extensions-services was led by portfolios at 616.152 seconds and its browser lane at 610.570 seconds; its full job took 671 seconds. Runtime-source's longest lane was source at 359.440 seconds, with a 429-second whole job. These are concrete inputs for a subsequent rebalance; they are not a green acceptance claim.

All ten allowed GitHub invocations were used, including the initial corrected query, historical reads, exact-SHA watcher reads and the required failed-job log. The watcher was stopped after the completed-jobs read so it would not consume the final log call on a redundant terminal status request. Reads for this candidate were spaced at least 300 seconds apart. Every returned job was completed and the verify summary failed; the last separate run-level status was still in_progress from the preceding read. No workflow dispatch, failed-job rerun or second product push was performed.

Terminal result: BLOCKED by the real work-views erasure assertion and failure to reach the requested timing band/spread. Product branch and SHA remain published and unchanged. The complete relevant public-safe packet is published separately; independent fleet gates retain authority over acceptance, publication scanning and landing. No READY line is emitted.
