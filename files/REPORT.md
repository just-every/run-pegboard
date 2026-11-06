# sx-pegboard-ci-critical-path-1

Repository: just-every/run-pegboard
Product branch: cloud/sx-pegboard-ci-critical-path-1
Base main: 47f7e9b50fae330f8109d1e97e10a27783439820
Product head: e2c3d762315888794377822119176ee31c412c4c

## Problem and change

Historical Verify 42268005252 has a work-graph-core cancellation at 736 seconds (12m16s); 42252802997 succeeded only on its later core attempt. Current main already declares 18 push shard jobs. The implementation keeps the existing manifest as the coverage source and packs it through the already invoked scripts/verify-app.mjs into eight Ubuntu 24.04 jobs, each with three concurrent isolated lanes (24 lanes total). Core, time, custody/recovery, erasure and reporting are split at disjoint suite boundaries; the separate PDF-custody command moves intact. The original 12-minute job deadline is unchanged.

Each lane receives a separate temporary copy of repository inputs, Git metadata and frozen dependencies. Private local settings, stores, command locks and generated build artifacts are excluded. Mutable Vite and Wrangler caches are consequently separate. The hosted runtime lane retains the original checkout, produces one production build and preserves the runtime, capacity, templates, conversions, typecheck, hosted-output and hydration checks. Only the second identical build command is removed. Every sibling finishes after a lane failure, the job fails and temporary copies are cleaned.

The plan job, workflow YAML, event triggers, concurrency group, one-full-run-per-commit evidence rules and existing planner are byte-for-byte unchanged. No product, test, migration, manifest, package pin, timeout, threshold or contract file changes. No permanent test added. Product commit contains only scripts/verify-app.mjs and its generated sources.lock.json digest.

## Plan, custody and coverage proof

PLAN.md records the full execution plan; COMPOSITION.md records all eight jobs and their lanes. Initial custody inspection found five matching historical cloud/sx-pegboard-ci* refs, none with a commit within two hours and none with an associated open PR. No competing writer was duplicated. The exact query and response are retained.

MAPPING.md and mapping-audit.mjs enumerate every selected Node leaf and browser selector before and after, including expanded package scripts and registered scenario-test factories. Counts: 126 Node test leaves before/after; 35 work-graph browser journey selectors before/after; three other complete executable test files before/after (runtime, templates, conversions). Every mapped row occurs once on each side; zero duplicates or omissions. Template and conversion file contents and all their component journeys remain byte-identical. Push jobs: 18 -> 8. Build commands: 2 -> 1. Hosted verification: 1 -> 1. Contract status counts: 22 done / 20 partial / 50 missing -> unchanged; no clause status changes.

## Validation

LOCAL-RESULTS.md describes local checks and distinguishes the exploratory VM-default Node 24 diagnostic from all passing pinned Node 22.20.0 checks. Isolation/failure/cleanup fixture checks, exhaustive mapping, JavaScript syntax, first-party check, workflow permissions, production build, typecheck, source-lock check and the unchanged contract-generator check passed. The exploratory old-core diagnostic was stopped, with only its owned descendants, and is never counted as a pass or used for timing conclusions. Core/capacity passed all 19 Node test leaves and four browser selectors. Time/planning passed all 21 Node test leaves and five browser selectors. Both commands exited 0; local-receipt.json records every lane and elapsed duration. The initial core sample partition took 748.796 seconds, demonstrating why that first partition was refined. LOCAL-PROJECTIONS.md shows the measured unchanged-suite sums for the final split (349.683 and 467.206 seconds), with the capacity browser lane at 483.570 seconds. These are local projections; candidate CI determines the final balance.

The source lock is regenerated last using node scripts/edition-authoring/cli.mjs lock and checked using the documented check command. Generated acceptance/claims views are not committed. Public-safe actual logs and receipts accompany this report; private setup output and environment/credential files are excluded.

## Exact-SHA CI and terminal custody

Product commit e2c3d762315888794377822119176ee31c412c4c was pushed successfully on the first guarded attempt. Main was fetched afterward and remains 47f7e9b50fae330f8109d1e97e10a27783439820, already included; the product worktree is clean. Verify 42279915600 was discovered by exact head SHA and branch through REST and is being watched. No rerun has been requested. Final report will identify the exact SHA, Verify run ID/URL, attempt, every shard duration, longest/mean ratio and terminal result. A green result from a different SHA is never accepted. The ten-call GitHub budget includes the custody query and the two requested historical duration reads. One REST watcher is used; status requests are spaced at least 300 seconds apart, with a longer first wait to conserve calls for any failure diagnosis and a single permitted infrastructure rerun. No new Verify dispatch and no push to main.

## Evidence transfer and limitations

All reports remain outside the product branch under the task packet directory. The relevant actual packet is published only to evidence/sx-pegboard-ci-critical-path-1 using the separate report-only entrypoint, whose manifest records the terminal product SHA and file hashes. Evidence transfer does not grant product acceptance or landing. The fleet retains its independent publication scan and exact-SHA landing gates. No deployment or provider/account qualification is asserted. No PR is required by the repository instructions; none is created.
