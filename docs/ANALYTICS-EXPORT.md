# Scoped analyst exports

PEG-044 is partial. The first export service provides an OData 4.0 read subset
for projects, tasks, task placements, approved time, explicitly reviewed portfolios
and goals, native form requests and task or proof approval state. Local scheduled
reports and CSV downloads use those same frozen rows. Native Tableau and Power BI
connector qualification remains unproved.
No connected BI client or live provider qualification is claimed.

## Authorize a key

Open **Work settings → Analyst access** from Administration to manage your own
keys. Select projects, any additional portfolios and goals, dataset fields and a lifetime of 1, 7 or 30 days, then
explicitly consent to the recorded scope. No project, field or consent checkbox
is selected by default. The issued credential appears only in the current page;
dismissal, reload and navigation clear it. The list shows scope, expiry and
revocation state without a recoverable secret. Revoke from that list to refuse
all new fetches, including saved pagination and refresh links.

The same native API is available: an authenticated owner or administrator calls `POST /api/v1/analytics/keys` with
`name`, an explicit `projects` array, a `fields` object, a millisecond `expiresAt`
and `consent: true`. Optional `portfolios` and `goals` arrays explicitly select
those objects. Their entire linked graph must fit the reviewed projects and goals;
adding an outside dependency refuses new reads until the scope is reviewed again.
Personal goals cannot be selected. Every selected project must currently permit export.
Expiry must be in the future and no more than 30 days away. The response contains
`id`, a once-shown `secret`, `expiresAt` and `servicePath`. Store the secret in
the BI client's credential store, never in a workbook, URL or shared script.

Keys belong to their authorizing administrator. Their authority cannot exceed
that person's current authority. Account version changes, deactivation, loss of
administrator status, disabled integrations, expiry and explicit revocation
refuse later fetches. A key cannot fetch personal work or a project outside its
explicit scope. It never grants a signed-in application session or write access.

`GET /api/v1/analytics/keys` lists the caller's keys without secrets or hashes.
`POST /api/v1/analytics/keys/{id}/revoke` permanently revokes a key and removes
its cached snapshots. Rotate by issuing a new key and revoking the old one.
No other administrator can retrieve or reuse the original secret.

New authorizations also return a non-secret `scopeDigest`, reproduced by the
own-key list and recorded with consent and expiry in `analytics.key_authorized`.
This SHA-256 receipt binds the issuer, workspace, sorted project IDs, dataset
fields, additional object scopes and expiry. It lets an administrator reconcile the selected scope with
the permanent audit even after the temporary credential store is excluded from
an archive. The audit contains neither project names nor field contents nor
credentials. Earlier audit events are preserved without retroactive receipts.

## Read contract, version 1

Authenticate with HTTP Basic: username is the key ID and password is its secret.
Bearer authentication with the secret is also accepted at the returned service
path. Production connections must use HTTPS. The service document lists only
selected datasets; append `/$metadata` to read their XML entity definitions.
An unselected dataset or field is unavailable, including metadata discovery.

| Entity set | Available properties | Definition |
| --- | --- | --- |
| Projects | id, name, status | One row per selected project. |
| Tasks | id, title, status, estimateHours | One row per task, including subtasks. Estimate units are hours. A task in several selected projects still counts once. |
| TaskProjects | id, taskId, projectId | One relationship per task and project; subtasks inherit root membership. Count Tasks for overall totals, not joined placement rows. |
| Portfolios | id, name, parentId, taskCount, doneCount, estimateHours | Explicitly selected portfolios. Totals deduplicate all projects beneath them, exclude milestones as native portfolio totals do, and never include an unreviewed project. A parent ID appears only when that parent is explicitly selected. |
| PortfolioProjects | id, portfolioId, projectId | Distinct selected-portfolio membership, including projects in nested portfolios. |
| Goals | id, title, kind, mode, unit, progressPercent, state, observedAt | Explicit nonpersonal goals. Progress and unknown or stale states match the native goal calculation. Progress is a percent; observedAt is epoch milliseconds UTC. |
| GoalLinks | id, goalId, sourceType, sourceId, weight | Reviewed goal dependencies. A linked goal must also be explicitly selected. Sources cannot exceed reviewed work. |
| Requests | id, taskId, projectId, createdAt, status | Native project form submissions, once per request identity, related to the resulting task. Created time is epoch milliseconds UTC; status is the current task status. Access requests and private submission fingerprints are excluded. |
| Approvals | id, taskId, kind, subjectId, version, state | One current task approval or proof approval, with distinct kind-prefixed stable identities. State uses the native independent decision or current route, including pending, stale, withdrawn and reopened outcomes. Proofs require a file in a reviewed project. No decisions, names, reasons, links or file bytes are exported. |
| TimeEntries | id, taskId, projectId, sheetId, seconds, adjustmentOf | Approved, available, nonwithdrawn time only, with integer seconds and signed approved corrections. Draft time, running timers, notes and personal work are excluded. |

The key's `fields` object selects properties for each entity set. `id` is always
included. No custom fields, internal notes, descriptions, person profiles or
provider context are selectable. Unselected object scopes produce no object rows; selecting a dataset never
authorizes an additional portfolio, goal or project. Service metadata describes
only selected fields. The service remains a limited OData subset.

A GET of an entity set captures all selected datasets at one guarded source
revision. The result names `@pegboard.snapshot`, `@pegboard.capturedAt`,
`@pegboard.sourceRevision` and `@pegboard.stale`. Pass `snapshot=<id>` on other
entity-set requests to read that same snapshot. It remains fixed across ordinary
edits, and staleness tells the analyst that the source has since changed.
Use that snapshot when comparing counts and durations across datasets.

Follow each `@odata.nextLink` until `@odata.deltaLink` is returned. The server
pages at 100 rows; `Prefer: odata.maxpagesize=2` requests smaller pages.
`$select` may further narrow allowed fields and `$count=true` adds the row count.
Unsupported query operations return a named error; filtering, expansion,
ordering, arbitrary SQL and writes are not implemented. Never assume that an
unsupported filter was applied.

Save the final delta link. A refresh returns changed or added rows and OData 4.0
deleted-entity records for removals. Their `id` is the entity URL and their
`reason` is `deleted`. Apply those removals before replacing the watermark.
A membership leaving the key's scope also produces a removal. Repeated refresh
without a source change returns no rows. Delta pages keep the same new snapshot.

Every fetch rechecks key authority and current scope, including metadata and old
pagination links. Erasure strips cached dependent payloads, including aggregate report rows, immediately; an old page
then returns 410 and requires a fresh snapshot or delta refresh. Snapshot fetches
expire after 24 hours, or earlier with the key. Expired caches are pruned on the
next snapshot capture. A missing or expired delta baseline requires a full
refresh. Credentials, their hashes, schedules, run receipts and cached snapshots are excluded from native
archives; restored installations require fresh analyst authorization.

Downloaded copies already held by a BI client cannot be recalled. Revocation
refuses new fetches, including fetches through previously saved links.

## Local report reconciliation

In **Settings → Analyst access**, expand **Local reports** on your own active key.
**Capture report** opens a frozen report and offers one CSV download per selected
dataset. Daily and weekly schedules require separate explicit consent; the first
capture is due immediately, then the next interval is measured from successful
capture. **Capture due reports** uses the same executor as the Worker's cron.
**Stop schedule** stops later captures. Nothing is emailed or sent to a BI tool.

The native API uses `POST /api/v1/analytics/keys/{id}/reports` to capture and
`GET /api/v1/analytics/keys/{id}/reports?snapshot={snapshot}` to reopen. Add
`dataset=Tasks` (or another selected dataset) to download its CSV. The report
names its definition, capture time, source revision, staleness and expiry. It
counts each selected dataset's rows and totals estimate hours and approved time
seconds only when those fields were consented to; unselected totals are unknown.
Portfolio totals exclude milestones, while Tasks retains them as ordinary work
identities. Task placements never multiply task or time totals.

`POST /api/v1/analytics/keys/{id}/schedule` accepts `hours` of 24 or 168 and
`consent: true`. The schedule remains bound to that exact credential. Its native
list and report routes require the same authorizing administrator; another
administrator cannot run, inspect or export it. `POST /api/v1/analytics/reports/run-due`
processes the caller's due schedules only. Successful intervals have durable,
unique receipts across restart. The cron uses the same executor for all due keys.
No report activity changes tasks, approvals or source datasets.

Every capture and reopened result checks current issuer, key, project and object
authority. Expiry and revocation deny saved result and CSV links; the next due
executor stops an ended credential instead of capturing. Results inherit the
snapshot's maximum 24-hour lifetime. Erasing source work invalidates old aggregate
reports, while a fresh capture and incremental dataset refresh omit erased work.
No schedule or credential travels into a restored installation. PEG-018's real
mailbox delivery and PEG-084's authenticated sender remain separate unproved work.

## Client setup still to qualify

In Tableau, choose its OData connection and the returned service URL, then use
Basic credentials. In Power BI, choose OData Feed with the same URL and Basic
credentials. These are the intended supported client entry points, not evidence
that either client has completed PEG-044. Verify metadata negotiation, all pages,
shared-snapshot selection, incremental removal handling and workbook refresh in
each real client before marking that acceptance point complete.

CT-approved under RL-103 (28 October 2026), retaining the 23 October riders: owner or administrator self-custody; explicit audited
consent to project and field scope; deny by default; finite key and snapshot fetch
lifetimes; no automatic outbound or product write authority. PEG-018 and PEG-027
inherit these dataset definitions and current-access checks when their report and
public integration doors adopt this service. This states implementation semantics
and adds no acceptance requirement.
