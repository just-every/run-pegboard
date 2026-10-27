# Reviewed status drafts and history

The signed-in native API supports manually composed project and portfolio status
updates. This is a partial PEG-015 foundation. AI drafting, subscriptions,
provider connectors, authenticated inbound replies and the status browser flow
remain unimplemented. The existing immediate human summary door remains available
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
publication revision. Mentions, follow and mute, ordinary comment notifications,
digests and authenticated inbound replies remain outstanding acceptance work.
