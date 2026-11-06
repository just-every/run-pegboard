# sx-pegboard-ci-critical-path-2

Status: PUSHED, exact-SHA CI outcome not observed for the final correction. No READY claim.
Repository: just-every/run-pegboard.
Branch: cloud/sx-pegboard-ci-critical-path-2.
Final product head: 5c9580015024cf018316a34feeedb9dcf66216dc.
Base/current main: f0386615142fdd50970be89ae671391def0a18fc.
PR: none; no PR landing rule was specified in the repository instructions.
Product files: scripts/verify-app.mjs and generated sources.lock.json only.
Clause status changes: none. No product, test, migration, contract or generated view edits.

## Full plan and execution

1. Refresh the launcher bundle, install the mandated Git helper and guard, and check matching recent CI-shape branches before changing the repository. No competing live writer appeared; critical-path-1 was explicitly excluded as landed. The other matches were November 4 or older (custody.json).
2. Shallow filtered clone current main. Read the repository instructions, Verify and invoked scripts, command declarations and source custody. Read requested historical jobs once for 42268005252 and 42252802997, plus follow-up 42295381995. Keep those actual JSON receipts and selected lane timings.
3. Look for repeated work before moving coverage. The first pass had already removed the duplicate build. The summary job only checks results. Runner setup took 16.3–36.7 seconds and lane preparation 12.0–26.7 seconds in the follow-up; these did not explain the multi-minute tails. Keep mutable Vite/Wrangler directories and owner stores isolated. Use existing concurrency and idle lane tails.
4. Repack complete suites and journey names, preserving every assertion exactly once. Keep eight shard jobs, at most three concurrent lanes, diagnostics alone during its assertion, ubuntu-24.04, the 12-minute timeout, the plan job, concurrency group, one-full-run-per-commit logic, single build and hosted checks.
5. Produce a table for every registered leaf test, journey and unchanged standalone verification command. Check selectors, workflow permissions and syntax. Run build, typecheck, first-party checks, a real scheduler execution probe and a full local core-capacity execution. Regenerate/check the source lock last before each product commit.
6. Publish the first candidate, observe exact-SHA Verify and measure every job. Preserve that published history when measurements show the timing goal is missed. Use the remaining call for actual lane/command spans, make the specific correction, repeat final touched checks and source lock regeneration, then push a new commit. Re-fetch main after the save; it remains f0386615142fdd50970be89ae671391def0a18fc, so no merge/rebase is needed. Both pushes succeeded at their first transport attempt through cloud-push.py.
7. Keep all reports outside the product branch. Publish the complete regular-file packet only to evidence/sx-pegboard-ci-critical-path-2. Hand off the final exact SHA for CI/timing verification once the ten-call GitHub budget is exhausted. Never claim a previous SHA's success for this correction.

## Measurements and why a correction was necessary

The historical follow-up 42295381995 cancelled reporting-work after 736 seconds with seven green siblings; the observed mean was 583.625 seconds, and the maximum/mean ratio was 1.261. That run included unlanded announcement tests; this branch starts from current main and does not import them. Cross-run times are observations, not a controlled claim that only composition caused the difference.

First candidate 2ecb289f89c81ef79b0e45366c08f66de7804d5b passed exact-SHA Verify run [42299250458](https://github.com/just-every/run-pegboard/actions/runs/42299250458), attempt 1. It nevertheless missed the requested performance target: time-planning 705 seconds (11m45s), core-capacity 684 seconds (11m24s), mean 586.375 seconds, maximum/mean 1.2023023, and only 15 seconds margin to the unchanged timeout. No assertion failed; no rerun was requested. The complete first-candidate plan, table and results remain in ATTEMPT-1.md and first-candidate-ci-receipt.json.

The final archive read showed these actual critical spans:

| Selection/lane | First-candidate duration |
| --- | --- |
| time-planning browser lane | 651.913s |
| time-planning API lanes | 429.790s and 505.078s |
| core bounded API lane | 618.062s |
| Native intake decisions suite inside that lane | 296.200s |
| core capacity/PDF browser lane | 536.405s |
| extensions API lane | 280.433s |
| extensions browser lane | 493.474s |
| reporting API lane | 432.227s |
| reporting browser lane | 508.149s |
| diagnostics, exclusively | 229.596s |
| subsequent capacity lane | 143.200s |
| its rule-audit sibling | 240.721s |

The original rebalance extended the browser lane with canvas and put intake decisions on an already long core lane. The correction uses the measured spare tails instead. Final durations are unmeasured; these numbers describe the first candidate only.

## Final composition and changes

| Shard | Isolated lanes |
| --- | --- |
| runtime-source | runtime, source, access-control |
| core-capacity | work-graph-core, work-graph-custody-recovery, journeys-planning-capacity |
| extensions-services | work-graph-extensions, portfolios, journeys-services-work |
| time-planning | work-graph-time, work-graph-decisions, journeys-planning-work |
| custody-recovery | provider-diagnostics, work-graph-rule-audit, portfolio-capacity |
| custody-access | work-graph-custody-erasure, journeys-services, journeys-core-access |
| reporting-work | work-graph-reporting, work-graph-analyst, journeys-core-work |
| planning-services | work-graph-intake, work-graph-pdf-custody, workflow-rules |

Compared with current main:

- Data custody moves from planning-services to core-capacity; the unmatched core remainder moves to planning-services. Newly registered unmatched core suites remain covered once, including an explicit synthetic selector probe for a future Project announcements suite.
- PDF custody moves from extensions-services to planning-services; portfolio core moves to extensions-services.
- Native intake decisions is selected once after capacity in custody-recovery's shorter tail. Diagnostics still finishes alone before rule audit and the capacity/intake lane begin in parallel.
- Goal visibility moves to the access-control lane in runtime-source.
- Retained PDF API feedback moves to the analyst selector; retained graph recovery moves to the workflow-rules lane.
- pdf-feedback browser work moves from core-work to planning-capacity. retained-pdf-review runs once after the reporting API lane. canvas runs once after the extensions API lane. They do not extend the already long planning browser lane.
- The two standalone browser selections add browser launches and service fixtures. They keep the same per-journey Worker setup; every journey already receives its own fresh Worker. No assertion or migration is removed or shared.

The workflow file, plan/reuse scripts, declared verification.json, package pins, CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to main. No timeout or test threshold was raised. The generated lock was written and checked last for each commit.

## Coverage proof and tests

Final before/after mapping: 148 node:test leaves, 35 journeys and 7 other verification commands, each once in both plans. Zero missing, repeated or weakened tests. Eight jobs and one build before/after. MAPPING.md lists all 190 units; coverage.json and commands-before/after.json are machine-readable receipts.

The inventory used temporary Node instrumentation outside the repository. describe callbacks registered names; hooks and assertion bodies did not execute. Package aliases and queue wrappers were expanded, and actual include/skip patterns were applied to every full leaf name. Unchanged standalone runtime/templates/conversions commands retain all assertions. No permanent pin test was added; no skip/todo/only registration was found.

Local build, typecheck, first-party checks and full core-capacity execution passed against the first candidate's unchanged application source: 17 bounded-core tests, 9 Data custody tests, and all five selected browser journeys. Retained PDF checks covered 1440 and 390; other journeys kept their existing policies. The local operator queue serialized the three commands, so its 962.248-second wall time is not a CI timing comparison. The subreaper exited successfully after cleanup.

The scheduler probe passed exclusive diagnostics, concurrent tail execution, separate directories and cleanup. Its deliberate diagnostics failure also proved both siblings finish before rejection. No scheduler code changed in the correction.

For the final correction: Node syntax, workflow permissions, matrix enumeration, complete selector mapping, git diff --check and source lock regeneration/check all passed. Full CI and timing on 5c9580015024cf018316a34feeedb9dcf66216dc remain unobserved. Local Node was 24.19.0 with pnpm 10.12.4 through the provided toolchain; CI's Node 22.20.0 pin is unchanged.

## Terminal product custody and follow-up

The branch contains two new fleet commits, preserving the published first candidate. The second push was necessary because its green Verify did not meet the timing requirements; it is a correction to that failed performance result. Both candidate authors/committers and all messages/trailers were inspected before each push. There are no co-author trailers, rewrites or main pushes. The remote branch advertises 5c9580015024cf018316a34feeedb9dcf66216dc; the checkout is clean.

All ten allowed GitHub calls were used (api-budget.json). Candidate watcher reads were spaced by at least 300 seconds. The last call retrieved the first candidate's complete lane timings to support the correction. No new Verify was dispatched and no failed-job rerun was spent. The final push triggers the normal workflow, but its run ID, success and longest duration have not been observed. This is PUSHED custody, not READY or proof of performance acceptance.

Next independent gate: require completed/success Verify on 5c9580015024cf018316a34feeedb9dcf66216dc; measure all eight jobs and require the longest to have adequate margin to 12 minutes and at most 1.2 times their mean. If an infrastructure-class failure occurs, rerun failed jobs once under the brief's rules. Do not use run 42299250458 as green evidence for the final SHA. There is no missing account or ruling; the remaining gate is final exact-SHA CI/timing verification.

All actual public-safe reports and receipts are selected explicitly. Private setup output, credentials, environment dumps, owner state, held-out material and symlinks are excluded. Product acceptance, publication scanning and landing remain with the fleet independently of evidence transport.
