# sx-pegboard-ci-critical-path-1

**READY:** final exact-SHA Verify 42286041668 completed successfully on f0386615142fdd50970be89ae671391def0a18fc. All eight shard jobs, full-push-proof and verify succeeded. Longest: reporting-work, 628s (10m28s); mean: 521.375s (8m41.375s); longest/mean: 1.2045, within 1.5. No blockers. No PR required or created.

Repository: just-every/run-pegboard
Product branch: cloud/sx-pegboard-ci-critical-path-1
Base main: 47f7e9b50fae330f8109d1e97e10a27783439820
Product head: f0386615142fdd50970be89ae671391def0a18fc

## Problem and change

Historical Verify 42268005252 has a work-graph-core cancellation at 736 seconds (12m16s); 42252802997 succeeded only on its later core attempt. Current main already declares 18 push shard jobs. The implementation keeps the existing manifest as the coverage source and packs it through the already invoked scripts/verify-app.mjs into eight Ubuntu 24.04 jobs, with 23 isolated lanes: seven jobs run at most three lanes concurrently and the provider-diagnostics job runs two serial phases. Core, time, custody/recovery, erasure and reporting are split at disjoint suite boundaries; the separate PDF-custody command moves intact. The original 12-minute job deadline is unchanged.

Each lane receives a separate temporary copy of repository inputs, Git metadata and frozen dependencies. Private local settings, stores, command locks and generated build artifacts are excluded. Mutable Vite and Wrangler caches are consequently separate. The hosted runtime lane retains the original checkout, produces one production build and preserves the runtime, capacity, templates, conversions, typecheck, hosted-output and hydration checks. Only the second identical build command is removed. Every sibling finishes after a lane failure, the job fails and temporary copies are cleaned.

The plan job, workflow YAML, event triggers, concurrency group, one-full-run-per-commit evidence rules and existing planner are byte-for-byte unchanged. No product, test, migration, manifest, package pin, timeout, threshold or contract file changes. Provider diagnostics retains its 360000ms test deadline. No permanent test added. Product commit contains only scripts/verify-app.mjs and its generated sources.lock.json digest.

## Plan, custody and coverage proof

PLAN.md records the full execution plan; COMPOSITION.md records all eight jobs and their lanes. Initial custody inspection found five matching historical cloud/sx-pegboard-ci* refs, none with a commit within two hours and none with an associated open PR. No competing writer was duplicated. The exact query and response are retained.

MAPPING.md and mapping-audit.mjs enumerate every selected Node leaf and browser selector before and after, including expanded package scripts and every imported scenario-test registration factory. The audit now attributes every helper-registered case to its executable test file. The earlier provisional count of 126 omitted 21 registered cases, including eight calendar/readiness/schedule-rule cases; the complete inventory is 147 before and after. No test execution changed. Counts: 147 Node test leaves before/after; 35 work-graph browser journey selectors before/after; three other complete executable test files before/after (runtime, templates, conversions). Every mapped row occurs once on each side; zero duplicates or omissions. Template and conversion file contents and all their component journeys remain byte-identical. Push jobs: 18 -> 8. Build commands: 2 -> 1. Hosted verification: 1 -> 1. Contract status counts: 22 done / 20 partial / 50 missing -> unchanged; no clause status changes.

## Validation

LOCAL-RESULTS.md describes local checks and distinguishes the exploratory VM-default Node 24 diagnostic from all passing pinned Node 22.20.0 checks. Isolation/failure/cleanup fixture checks, exhaustive mapping, JavaScript syntax, first-party check, workflow permissions, production build, typecheck, source-lock check and the unchanged contract-generator check passed. The exploratory old-core diagnostic was stopped, with only its owned descendants, and is never counted as a pass or used for timing conclusions. Core/capacity passed all 19 Node test leaves and four browser selectors. Time/planning passed all 21 Node test leaves and five browser selectors. Both commands exited 0; local-receipt.json records every lane and elapsed duration. The initial core sample partition took 748.796 seconds, demonstrating why that first partition was refined. LOCAL-PROJECTIONS.md shows the measured unchanged-suite sums for the final split (349.683 and 467.206 seconds), with the capacity browser lane at 483.570 seconds. These are local projections; candidate CI determines the final balance.

The source lock is regenerated last using node scripts/edition-authoring/cli.mjs lock and checked using the documented check command. Generated acceptance/claims views are not committed. Public-safe actual logs and receipts accompany this report; private setup output and environment/credential files are excluded.

## Exact-SHA CI and terminal custody

Product commit e2c3d762315888794377822119176ee31c412c4c was pushed successfully on the first guarded attempt. Main was fetched afterward and remains 47f7e9b50fae330f8109d1e97e10a27783439820, already included; the product worktree is clean. Verify 42279915600 was discovered by exact head SHA and branch through REST and its first REST status read reports completed/failure on the exact SHA. Seven of eight shard jobs succeeded. custody-recovery job 128105974387 failed in Run this shard; verify failed on its dependency result. The longest job was runtime-source, 659 seconds (10m59s); mean 543.25 seconds (9m03.25s), ratio 1.2131, within 1.5. The failed-job archive was read exactly once. It reports testTimeoutFailure: provider diagnostics exceeded its unchanged 360000ms limit (396542.578ms reported), then continued and printed its custody proof after cancellation; the log reports zero failed assertions and one cancelled test. This is a CI scheduling deadline failure, so no infrastructure rerun is claimed. The follow-up gives that scenario exclusive CPU time, runs background audit afterward, moves capacity and typecheck off runtime, redistributes complete service/recovery selections, while preserving all execution thresholds. The uncached exclusive phase passed on two CPUs at 325934.524ms. The relocated source lane passed its schedule/rule-audit tests, first-party check, generated contract check and typecheck on two CPUs. An optional Node compile-cache experiment also passed at 324975.794ms, only 0.3% faster than 325934.524ms uncached, so that cache change was not retained. The serial-execution fixture passed. The follow-up commit f0386615142fdd50970be89ae671391def0a18fc was pushed on the first guarded attempt, without rewriting published history. Refreshed main remains included. Verify 42286041668 is the exact-SHA push run for this final candidate; its exact-SHA REST status is completed/success on attempt 1. The final job-duration read confirms eight successful shard jobs, full-push-proof and aggregate success, with a 1.2045 longest/mean ratio. This satisfies the exact-SHA READY and balance checks. Ten GitHub calls were used; no additional calls or reruns were made. The first-candidate run and failure receipts remain preserved separately. Final report will identify the exact SHA, Verify run ID/URL, attempt, every shard duration, longest/mean ratio and terminal result. A green result from a different SHA is never accepted. The ten-call GitHub budget includes the custody query and the two requested historical duration reads. One REST watcher is used; status requests are spaced at least 300 seconds apart, with a longer first wait to conserve calls for any failure diagnosis and a single permitted infrastructure rerun. No new Verify dispatch and no push to main.

## Evidence transfer and limitations

All reports remain outside the product branch under the task packet directory. The relevant actual packet is published only to evidence/sx-pegboard-ci-critical-path-1 using the separate report-only entrypoint, whose manifest records the terminal product SHA and file hashes. Evidence transfer does not grant product acceptance or landing. The fleet retains its independent publication scan and exact-SHA landing gates. No deployment or provider/account qualification is asserted. No PR is required by the repository instructions; none is created.

## Final exact-SHA timing table

# Exact-SHA Verify timings

Head: f0386615142fdd50970be89ae671391def0a18fc
Run: 42286041668; attempt 1; completed/success

| Shard | Job ID | Conclusion | Duration (s) |
| --- | --- | --- | --- |
| core-capacity | 128127106972 | success | 468.0 |
| custody-access | 128127106817 | success | 590.0 |
| custody-recovery | 128127106742 | success | 545.0 |
| extensions-services | 128127106801 | success | 578.0 |
| planning-services | 128127106862 | success | 430.0 |
| reporting-work | 128127106776 | success | 628.0 |
| runtime-source | 128127106765 | success | 402.0 |
| time-planning | 128127106684 | success | 530.0 |

Mean: 521.375; longest: reporting-work at 628.0 seconds; longest/mean: 1.204507312395109; <=1.5: True.
Full push proof: success; aggregate: success; READY: True.

## Before and after results

- Push jobs: 18 -> 8; complete planned Node leaves: 147 -> 147; work-graph browser selectors: 35 -> 35; other complete test executables: 3 -> 3. Six additional component journey routines and both runtime setup modes retain their original multiplicities.
- Production build commands: 2 -> 1; hosted/hydration verification: 1 -> 1. No test/source/migration/contract file changed and no permanent test was added.
- Historical core was cancelled at 736s. Final core-capacity is 468s (7m48s). The first candidate's runtime-source took 659s; redistributing capacity and typecheck reduced final runtime-source to 402s (6m42s).
- First candidate e2c3d762315888794377822119176ee31c412c4c / Verify 42279915600 had seven green shards and the provider-diagnostics test deadline failure. Follow-up f0386615142fdd50970be89ae671391def0a18fc / Verify 42286041668 passed on its first attempt. Both commits remain in published history; no forced push, rebase or manual Verify dispatch occurred.
- The workflow, planner, one-full-run-per-commit proof, concurrency group, Ubuntu image and 12-minute job limits are unchanged. Provider diagnostics retains its original six-minute test deadline. The final critical path is 10m28s, 92s below the 12-minute bound, with 1.2045 maximum/mean.
- Clause changes: none. Counts remain 22 done, 20 partial and 50 missing. Generated acceptance/claims views were not committed.

## Terminal product and evidence custody

READY branch=cloud/sx-pegboard-ci-critical-path-1 head=f0386615142fdd50970be89ae671391def0a18fc

Product branch is pushed and clean; fetched main remains included. Product scope is exactly scripts/verify-app.mjs and sources.lock.json. Identity/trailer receipts cover both unpublished-to-main candidate commits, with fleet author/committer and no co-author trailers. The actual local and CI receipts, first failure log and final timing table are retained in this packet. The GitHub step environment header was omitted from the public failed-job log; all failure output is retained. Private setup output, credential bundles, environment dumps, held-out gates and compile-cache binaries are excluded.

The initial report-only save round-tripped 39 selected files with manifest/hash verification. The final EVIDENCE line in the terminal response identifies the complete updated packet and exact evidence head. This is report transport, not product acceptance or landing; the fleet retains its independent publication scan and landing gates. No default branch push, PR bypass or deployment was performed.
