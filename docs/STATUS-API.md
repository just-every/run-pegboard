# Reviewed status drafts and history

The signed-in native API supports manually composed project and portfolio status
updates and date-bounded model drafts. This is a partial PEG-015 implementation.
External channel connectors, authenticated inbound replies, announcement history
and complete retained-copy erasure remain unimplemented. The existing immediate human summary door remains available
for PEG-013; it does not imply a recipient-reviewed client publication.

Create a draft with `POST /api/v1/status-drafts`. Supply `subjectType` (`project`
or `portfolio`), `subjectId`, `health`, `summary`, `highlights`, `risks`,
`decisions`, `nextSteps`, ISO date-only `from` and `to`, `sourceIds` naming readable
tasks in the subject's projects, and `recipients`, an array of objects with an
`id` and `channels`. Supported channel names are `in_app`, `slack`, `teams`,
`nook` and `email`. A recipient list is exact for this publication; it is not a
standing subscription or a permission grant. Draft creation never sends anything.

The publisher must be an active internal human with current project settings
management or portfolio administration. Agents, guests, analysts and weaker
project roles cannot publish through this door. `GET /api/v1/status-drafts/:id`
and `PATCH /api/v1/status-drafts/:id` use that same authority. A patch supplies
the current `version` and the complete replacement content, sources and recipients;
old versions refuse instead of overwriting a concurrent edit.

`POST /api/v1/status-drafts/:id/review` returns the exact content, source snapshots,
recipients, reviewer and review token. Every recipient must currently read the
subject and every cited source. A private source is refused for a guest. A client
version is a separate draft that omits internal material and cites only that
client's readable work; source access alone never approves publication. A changed
source requires refreshing the draft and a fresh human review.

Reject with `POST /api/v1/status-drafts/:id/reject`, supplying the current
`version` and a nonempty `reason`. The human and reason remain visible on that
version, which cannot be reviewed or published. An explicit edit creates a new
version for a fresh review; an earlier review never resumes. A published decision
cannot be rejected through the draft door, including a race with publication.

Publish with `POST /api/v1/status-drafts/:id/publish` and the returned `token`.
The review binds the acting human, draft version, exact content, sources,
recipients and current permission epoch. The transaction fences concurrent draft,
source and permission changes. A retry or concurrent submission produces one
publication and one set of receipts. Publication remains a named human decision.

`GET /api/v1/status-revisions/:id` returns immutable content, source links,
reviewer and receipt outcomes. `in_app` is **available** through this authorized
API read; it does not claim an Inbox notification or a human read. Every external
channel is **blocked**, with reason `connector_not_implemented`; no provider
request or acknowledgment is fabricated. Current revocation is reflected as a
revoked receipt on subsequent authorized inspection. Recipients can inspect only
their own receipts. Unreviewed readers cannot obtain the revision through history
or portfolio rollups. Current source access is checked again on every read.

`GET /api/v1/status-history/:type/:id` returns only the caller's readable revisions.
A correction is a new draft with `correctsId` naming a published status of the same
subject. Publishing it adds history without replacing the original content or
moving its discussion. A correction does not silently copy an earlier audience.

Revision comments use `GET` and `POST /api/v1/status-revisions/:id/comments`.
Posting requires comment authority and current publication and source access.
Supply `body`, an optional same-revision `parentId`, and optionally `internalOnly`.
A reply to an internal comment remains internal. Guests cannot read internal
parents, create internal comments or use a revoked share. Viewers cannot comment.
Commenting does not publish, change recipients or create another decision.

`PATCH /api/v1/status-revisions/:id/comments/:comment` accepts `body` or `delete:
true`, plus `version` equal to the last `edited_at` or initial `created_at`.
Only the author with current comment authority can edit or delete; stale edits
refuse. Author and timestamps remain attributed, a deletion retains a tombstone,
and edit and delete actions are audited. A reply stays attached to its exact
publication revision.

`GET` and `POST /api/v1/status-revisions/:id/preferences` read or save the caller's
boolean `following` and `muted` choices. `GET /api/v1/status-notices` reads durable
native discussion notices, rechecking current revision and source access, comment
visibility and preferences. The reply can supply `mentions`, an array of recipient
IDs already included in the reviewed audience. A mention never grants access or
adds a new recipient. Muting suppresses all discussion notices; an explicit mention
can notify an unfollowed recipient who has not muted the revision. Notices retain
the exact revision and comment link, omit internal comments for guests, disappear
from the recipient's feed after revocation and omit deleted comments. Editing a
comment does not leave stale body text in a notice. Native notice availability
does not claim an Inbox screen, digest, external channel delivery or human read.
Those screens, queued channel notifications, digests and authenticated inbound
replies remain outstanding acceptance work.

The existing owner erasure preview reports
`review_status_snapshot_custody_before_erasure` when cited task or project work,
or an attributed actor, is still held in a status snapshot. The reviewed erasure
request returns a retained outcome with no deleted rows. This conservative hold
prevents a false claim of erasure while status copies remain. A reviewed snapshot
erasure path remains outstanding; this foundation claims no legal retention or
provider deletion qualification.

Tracked requests, scoped privacy handlers, deadline escalation and the controlled
manual-resolution procedure are documented in [Status rights](./STATUS-RIGHTS.md).
This request register does not turn a retained-copy outcome into erasure.

## Browser drafting and native subscriptions

Open a project's or portfolio's status page from its existing publishing area.
Compose a draft, select its cited work, exact recipients and channels, then save.
Reject with an attributed reason, or edit and review the complete replacement.
The review shows exact content, cited records and recipients before publication.
A changed source or audience invalidates an earlier review. A correction starts a
new draft linked to the immutable original; conversations remain on their revision.

Internal members choose their own subscription under the status page's Settings.
An explicit draft choice snapshots opted-in recipients and channels for the human's
one exact review. Changed subscription intent requires saving and reviewing again.
Guests cannot opt into internal policy, and a subscription grants no work access.
The native Inbox and authenticated digest recheck current access and comment
visibility. External channels remain blocked without a connector submission.

## Requested model drafts

`POST /api/v1/status-drafts/generate` accepts the subject, ISO date window,
`sourceIds` and `modelConsent: true`. A current internal human with subject
management authority must select sources and consent. The configured processor
must have owner-approved sharing and training must be off. Every source must be
readable, inside the subject and updated within the inclusive requested window.
Known disputed sources refuse before inference. Authority, sources and processor
consent are checked again after inference; a changed set is refused.

The installation operator configures `AI_ENABLED`, `AI_MODEL`, `AI_PROCESSOR` and
one Base AI transport: direct `AI_API_KEY` and optional `AI_BASE_URL`, or the linked
`RER_MODELS_SERVICE` and `RER_MODELS_KEY`. Secrets belong in private runtime
configuration. They never enter a draft, receipt, archive or error. There is one
bounded provider attempt, no substitute model and no automatic retry.

Structured output must cite selected source IDs on every assertion. The result is
a private draft with no recipients, with original model, source assertions and
bounded numerical usage retained as provenance. Reject or edit through the same
draft door, then review and publish as a human. The model cannot approve its output,
select recipients or publish a client version. No connection produces the named
no-model response; unavailable credentials produce a recoverable typed cause.
The complete shared connection and recovery experience remains PEG-055 and PEG-074.

`tests/support/status-model.mjs` is an OpenAI Chat Completions schema-fake, not an
actual-model receipt. The explicit qualification command is
`node tests/journeys/status-model-qualification.mjs`, with held credentials injected
privately and an exact model configured. Its output records only synthetic source
facts, generated assertions, usage and observed human publication outcomes.
