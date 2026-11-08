# sx-pegboard-f48fix1

Repository: just-every/run-pegboard
Product branch: cloud/sx-pegboard-f48fix1
Target: only BLOCKING A for PEG-078, ordinary due-timestamp tasks without a start falsely preventing a reviewed reassignment.

## Plan

1. Full-history clone at 03bf81053ee08e776394efca07bd885bfa820a6e and merge current main, preserving newer contract judgments, tests, CI configuration, and migration numbering.
2. Reproduce through authenticated public task, portfolio comparison, approval, workload and history API doors with a 2 h retained task due 2026-11-03T15:00:00Z and no start, on an 8 h working day. Exercise both the alternate and the designer as holder.
3. Make the smallest interval-boundary correction and extend the existing capacity scenario with one regression assertion. Keep every existing assertion.
4. Run that same probe after the fix, touched capacity scenarios, build/typecheck, source-lock check, and scoped browser proof. Do not run the full local suite or a publication scan.
5. Regenerate source custody last, inspect all candidate identities/messages including side parents, push only the named product branch, and require exact-SHA branch Verify. Publish selected non-secret reports/receipts separately on evidence/sx-pegboard-f48fix1.

## Integration

Main at integration: 3be7283 (full SHA recorded in receipt). Contract and generated views taken whole from origin/main. Generator write/check PEG-078 passed, 22 done / 20 partial / 50 missing; generated views restored whole from main. No clause Status, Gap or Evidence edit; no DONE claim. Main's migration rename to 0082 retained without duplicate 0076 capacity migration; main's navigation wait assertion retained alongside all candidate capacity assertions.

Merge save: 195d4fe9a6abcaf7d5c7f3ec5e4a49f11595072d [skip ci], pushed successfully on attempt 3 after two transient authentication refusals. All four candidate commits had fleet authors/committers and absent trailers.

Local setup initially ran during unresolved merge and was retried after resolving package metadata. Its initial scratch database contained the pre-main migration number, so that newly created local state was preserved outside the checkout and setup resumed with a new local store. No existing installation data was reset. Private local settings are kept outside evidence.

## Fix and before/after proof

Final product head: `2f1ceaf26575272f3bf1e9b817106481f527d6f6`.

The FIX commit changes only `src/pegboard/capacity/workload.ts`, the existing `tests/scenarios/portfolio-capacity.mjs`, and their generated hashes in `sources.lock.json`. A missing start now permits working time earlier on the deadline day; a missing due permits time later on the start day. Explicit start/end commitments continue to use the original timed bounds and current absence intervals. No dates, assignments, skill/access checks or review authority are bypassed.

A separate authored probe uses actual authenticated API doors and native persistence, not mocks or internal function calls. A 2 h task due 2026-11-03T15:00:00Z with no start is held first by the alternate, then by the designer. Before (merge-save head `195d4fe9a6abcaf7d5c7f3ec5e4a49f11595072d`), each case returns feasible `[false,false]`, false staffing shortage, 2 unavailable hours and approval HTTP 409. After, each returns feasible `[true,true]`, no shortage, approval HTTP 200 and zero unavailable/overload hours across the affected actual person-days. The actual assignment changes to the alternate with one new attributed application per approval. The deadline and effort remain unchanged; reviewed undo restores the original assignment between cases.

`deadline-before.log`, `deadline-after.log`, `probe-receipt.json` and `deadline-probe.mjs` retain the full public-door reproduction. The single added regression assertion in the existing scenario covers both affected holders, comparison feasibility, approval status, resulting assignee and the actual unavailable-hours totals. It fails before (0 pass / 1 fail) and passes after inside the unchanged registered test. Zero registered tests added; exactly one regression assertion added; no existing assertion removed or weakened.

## Local validation

- Frozen dependency setup and owner setup completed using the pinned rer package and Node 22.20.0.
- `npx -y @runeditrun/rer build`: exit 0.
- `pnpm run typecheck`: exit 0.
- `node --test --test-name-pattern='^(?:Human portfolio capacity|Capacity across committed work)(?: |$)' tests/portfolios.test.mjs`: 4 pass / 0 fail, 2 suites. Existing timed absence, adjacent interval, timezone, hidden-work, revoked grants, replay, erasure and selective undo assertions retained and passed.
- The separate deadline probe: before exit 1, after exit 0, same two trigger variants.
- `node scripts/edition-authoring/cli.mjs lock`, then `check`: exit 0. Lock generated last after staging source/test changes; checked again before publication.
- `node scripts/contract-docs.mjs write PEG-078`, then `check PEG-078`: exit 0; generated views restored whole from main. No contract or generated-view difference against origin/main.
- `git diff --check`: clean. Full-history checkout (`--is-shallow-repository=false`). All five candidate commits, including side parents, have fleet author and committer identities and no coauthor trailers.

## Browser proof

Four inspected screenshots show the exact deadline trigger, both the alternate and designer holders, at 1440 and 390 CSS pixels. Both alternatives display feasibility and Approve controls, preserved locks and complete sourced task/workload context. These are in `screens/`. The existing portfolio capacity sanity journey runs at its original 1440 assertion width; its result is recorded in `portfolio-journey.log` and the validation receipt.

## Counts and clause custody

Contract counts before and after: **22 done / 20 partial / 50 missing**, unchanged. PEG-078 remains partial; its Status, Gap and Evidence cells are untouched. Before/after deadline cases: 2 refused -> 2 accepted; unavailable hours: 2 -> 0 per case; approval: 409 -> 200; no added test registrations. This is a fix to the named human-review behavior, not acceptance of the full agent clause.

CLAIM PEG-078 PARTIAL points=none tests=tests/scenarios/portfolio-capacity.mjs#compares sourced alternatives across thirty projects and fences attributable application, replay and selective undo
DEFAULT PEG-078: Treat a missing task start as no lower timed bound within its deadline day, retaining its existing dated workload distribution and all explicit interval constraints.
GAP PEG-078: The main contract's existing agent-generation, ranking, routed-approval and model-consent gaps remain unchanged and outside this FIX.

## Product publication and CI

Both the merge save and final FIX head were pushed only to `cloud/sx-pegboard-f48fix1`. Final push succeeded on attempt 1. No default branch push, force push, rebase of published history, PR, publication scan or DONE claim. Exact-SHA push Verify run: `42479653822`, https://github.com/just-every/run-pegboard/actions/runs/42479653822. Its final conclusion is in `ci-receipt.json`; no success is inferred from any other SHA. One watcher polls REST at least 300 seconds apart within the ten-call budget. Evidence publication is independent of product READY and does not claim acceptance or landing.

Exact-SHA Verify **completed/success** on product head `2f1ceaf26575272f3bf1e9b817106481f527d6f6`, run `42479653822`. Four REST calls total, each run observation at least 300 seconds apart. No rerun or workflow dispatch was used. No blockers remain for this scoped candidate.

Initial report-only evidence save succeeded at `refs/heads/evidence/sx-pegboard-f48fix1`, head `bdcfb54bd32d7d83d5ef9c42ecbd523c9d1ef1dd`. The actual initial transport receipt is in `evidence-save-receipt.json`. This final packet adds the completed exact-SHA CI result and is published as a subsequent ordinary evidence commit; the final terminal EVIDENCE line identifies that commit. The evidence helper preserves the product checkout/head/index. All 21 selected files are actual regular report, receipt, patch, log or screenshot files. No credential, environment dump, held-out gate material or symlink is selected.

All local browser/server processes were closed by their own lifecycle. Failed initial scratch setup/test stores were removed after successful validation. The product clone is clean, its complete product history is pushed, and it is removed after final evidence publication as the repository rules require. The packet remains outside that clone under `$HOME/rer-consolidation/work/sx-pegboard-f48fix1/packet/`.

Proposed lane return: sx-pegboard-f48fix1 fixes BLOCKING A's deadline-only retained-task refusal for PEG-078; no clause cell changes, no new test registration, one regression assertion; 4/4 touched tests, browser sanity and exact-SHA Verify 42479653822 passed. Product head 2f1ceaf26575272f3bf1e9b817106481f527d6f6; contract counts remain 22/20/50. Independent gate and landing remain fleet-owned.

