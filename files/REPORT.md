# sx-pegboard-ci-limit-2

Repository: just-every/run-pegboard
Product branch: cloud/sx-pegboard-ci-limit-2
Product head: 3be7283f0152224202de59c4b2e0852c732ac02f

## Plan
1. Read launcher and repository rules, shallow filtered clone current main, configure fleet identity and commit hook.
2. Change exactly the two requested Verify job timeout lines from 12 to 16 minutes; retain every shard, test, assertion, plan, summary and one-minute job.
3. Check workflow permissions, compare the complete workflow against main allowing only those two replacements, confirm eight push shards, regenerate source lock last and run its check.
4. Commit and push only the named product branch with candidate identity/trailer inspection.
5. Watch exact-SHA Verify through REST, report all shard durations; rerun failed jobs once only for a qualifying infrastructure failure.
6. Publish actual reports and receipts through the separate evidence ref and return product custody separately.

## Change and rationale
This is a deliberate limit change based on the supplied measurements: total shard work of about 78–85 minutes across eight shards, measured longest jobs of 666–671 seconds (about 11.2 minutes), and repeated cancellations at the old 12-minute limit. Sixteen minutes provides about four minutes of margin. No further balancing is attempted because earlier passes introduced an order-dependent failure.

Only .github/workflows/verify.yml job timeouts changed: shards fallback 12 → 16 and light job 12 → 16. The workflow_call timeout input declaration remains unchanged, as do explicit caller overrides. Nightly already explicitly requests 45 minutes. Plan, proof and summary one-minute limits are unchanged.
sources.lock.json was regenerated last; only the Verify workflow digest changed.

Before/after: push shards 8 → 8; moved tests 0; changed assertions 0; changed clause statuses 0; shard/light job limits 12 → 16 minutes. Mallet and Glove shapes were not touched.

## Local validation
- Exact workflow comparison permits only the two requested timeout replacements.
- Push matrix has exactly eight shards; verification plan, package scripts, tests and assertions are unchanged.
- node scripts/verify-ci.mjs --check-workflows passed.
- node scripts/edition-authoring/cli.mjs lock then check passed.
- git diff --check passed.
- An initial attempted node --test tests/verify-ci.test.mjs could not run because that file does not exist. It is recorded honestly in ci-tests.txt; no new tests were added for this two-line configuration change.
- App setup, UI/browser proof and typecheck were not needed for the workflow-only edit; full exact-SHA CI remains the acceptance check.

## Publication
The first and only product commit was pushed immediately through cloud-push.py. Product identity and committer are Run Edit Run fleet <fleet@runeditrun.com>, with no co-author trailers. There is no PR requirement in the repository AGENTS.md; no PR was opened. No main/default branch was pushed.

## CI
Exact-SHA Verify run 42317583910 (attempt 1): completed/success. URL: https://github.com/just-every/run-pegboard/actions/runs/42317583910. Head matches product head exactly. One watcher polled at 301-second intervals. GitHub call count so far: 5.

Clause counts before and after (unchanged): {'done': 22, 'partial': 20, 'missing': 50}; total 92.

## Observed jobs

| Job | ID | Conclusion | Duration (seconds) |
| --- | --- | --- | ---: |
| plan | 128233917767 | success | 8 |
| shards (custody-access) | 128233982587 | success | 449 |
| shards (custody-recovery) | 128233982647 | success | 621 |
| shards (time-planning) | 128233982654 | success | 425 |
| shards (planning-services) | 128233982686 | success | 576 |
| shards (core-capacity) | 128233982689 | success | 429 |
| shards (extensions-services) | 128233982709 | success | 463 |
| shards (reporting-work) | 128233982719 | success | 707 |
| shards (runtime-source) | 128233982720 | success | 468 |
| light | 128233984637 | skipped | 0 |
| full-push-proof | 128238037462 | success | 4 |
| nightly-proof | 128238039043 | skipped | 0 |
| verify | 128238075084 | success | 3 |

Product checkout is clean. Complete actual CI responses and job durations are retained in the packet; no secrets or environment dumps are selected for publication.

## Final result

All eight shard jobs succeeded on attempt 1. No rerun, assertion edits or new Verify dispatch occurred. The longest job was reporting-work, 707 seconds (11m47s), leaving 253 seconds (4m13s) below the new sixteen-minute limit. The total observed shard job time was 4,138 seconds (68m58s). No blockers. No PR created. Mallet and Glove shapes were not touched.

Custody: READY branch=cloud/sx-pegboard-ci-limit-2 head=3be7283f0152224202de59c4b2e0852c732ac02f. This is product custody, independent of report-only evidence transport.
