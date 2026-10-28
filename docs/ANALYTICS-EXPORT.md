# Scoped analyst exports

PEG-044 is partial. The first export service provides an OData 4.0 read subset
for projects, tasks, task placements and approved time. Native Tableau and
Power BI connector qualification, portfolios,
goals, requests, approvals and scheduled-report reconciliation remain unproved.
No connected BI client or live provider qualification is claimed.

## Authorize a key

Open **Work settings → Analyst access** from Administration to manage your own
keys. Select projects, dataset fields and a lifetime of 1, 7 or 30 days, then
explicitly consent to the recorded scope. No project, field or consent checkbox
is selected by default. The issued credential appears only in the current page;
dismissal, reload and navigation clear it. The list shows scope, expiry and
revocation state without a recoverable secret. Revoke from that list to refuse
all new fetches, including saved pagination and refresh links.

The same native API is available: an authenticated owner or administrator calls `POST /api/v1/analytics/keys` with
`name`, an explicit `projects` array, a `fields` object, a millisecond `expiresAt`
and `consent: true`. Every selected project must currently permit export.
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
fields and expiry. It lets an administrator reconcile the selected scope with
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
| TimeEntries | id, taskId, projectId, sheetId, seconds, adjustmentOf | Approved, available, nonwithdrawn time only, with integer seconds and signed approved corrections. Draft time, running timers, notes and personal work are excluded. |

The key's `fields` object selects properties for each entity set. `id` is always
included. No custom fields, internal notes, descriptions, person profiles or
provider context are selectable. These are deliberately limited initial datasets;
the remaining contract datasets are not represented by empty substitutes.

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
pagination links. Erasure strips cached task payloads immediately; an old page
then returns 410 and requires a fresh snapshot or delta refresh. Snapshot fetches
expire after 24 hours, or earlier with the key. Expired caches are pruned on the
next snapshot capture. A missing or expired delta baseline requires a full
refresh. Credentials, their hashes and cached snapshots are excluded from native
archives; restored installations require fresh analyst authorization.

Downloaded copies already held by a BI client cannot be recalled. Revocation
refuses new fetches, including fetches through previously saved links.

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
