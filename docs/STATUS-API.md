# Reviewed status drafts and history

The signed-in native API supports manually composed project and portfolio status
updates. This is a partial PEG-015 foundation. AI drafting, provider connectors,
authenticated inbound replies and browser drafting remain unimplemented. The existing immediate human summary door remains available
for PEG-013; it does not imply a recipient-reviewed client publication.

Create a draft with `POST /api/v1/status-drafts`. Supply `subjectType` (`project`
or `portfolio`), `subjectId`, `health`, `summary`, `highlights`, `risks`,
`decisions`, `nextSteps`, ISO date-only `from` and `to`, `sourceIds` naming readable
tasks in the subject's projects, and `recipients`, an array of objects with an
`id` and `channels`. Supported channel names are `in_app`, `slack`, `teams`,
`nook` and `email`. A recipient list is exact for this publication; it is not a
permission grant. Draft creation never sends anything.

Internal members can read or change their own subscription through `GET` or
`POST /api/v1/status-subscriptions/:type/:id`. A write supplies boolean `enabled`
and a nonempty `channels` array. Guests and agents cannot opt into internal
publication policy. Supply `includeSubscribers: true` when saving a draft to
snapshot active internal subscribers and their channels beside explicit
recipients. The human reviews the complete resulting audience once. Changing
subscription intent requires saving the draft and reviewing again; access is
rechecked before publication. A subscription never publishes a client version,
grants access or sends an unreviewed draft.

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
API read and in the recipient's native Inbox; it does not claim a human read. Every external
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
does not claim external channel delivery or human read. `GET /api/v1/status-inbox`
and `GET /api/v1/status-digest` return the same permission-filtered publication
and discussion content. They recheck access, hidden replies and preferences
instead of retaining a second copy of message bodies. The digest is an
authenticated native read, not an outbound email job. The existing Inbox shows
reviewed revisions and their source links, member and guest replies, attributed
thread history, author-only reply edit and delete forms, correction links and discussion follow and mute forms. Each form uses the same
authorized API door. Queued channel notifications, outbound digests,
authenticated inbound replies, mention controls and portfolio guest discussion are still
outstanding acceptance work.

The existing owner erasure preview reports
`review_status_snapshot_custody_before_erasure` when cited task or project work,
or an attributed actor, is still held in a status snapshot. The reviewed erasure
request returns a retained outcome with no deleted rows. This conservative hold
prevents a false claim of erasure while status copies remain. A reviewed snapshot
erasure path remains outstanding; this foundation claims no legal retention or
provider deletion qualification.

Subscription intent is disabled in installation archives. Reviewed erasure
includes subscription settings for the selected project or person; a change to
those settings invalidates an earlier erasure preview. Retained status snapshots
continue to use the explicit custody hold described above.
