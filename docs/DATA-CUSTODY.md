# Data custody

Owners open Administration → Data settings to review retention, holds and
irreversible removal. Owners and administrators open Administration → Permanent
audit to search and export immutable events. Workspace administrators see that
workspace’s events and their own personal audit. Installation-wide authentication
and archive events are owner-only. Other people’s personal tasks, goals and draft
timesheets do not become visible through the workspace audit.

## Permanent audit

The permanent audit is separate from editable work history and older access
activity. Database triggers reject updates and deletes. Historical access events
are copied additively with opaque identifiers and no free-text metadata; their
original activity is preserved. Current access, work-history, rule-effect,
recurrence and provider outcomes append permanent records. API writes also record
started and success/failure outcomes with an opaque correlation ID. A started
record alone does not establish completion.

Native admission, refused challenges, account changes and sign-out are recorded
without challenge, cookie, token or secret values. Native account role/status
changes move the same authority epoch as Pegboard’s account doors. Proof
versions/decisions and signed agent-output submissions use this audit too.
Authorized search/export is paginated by event ID with exact action, actor and
subject filters.

Metadata accepts only a closed vocabulary of enums, numbers, booleans and opaque
IDs. It does not copy request bodies, comments, file names or bodies, provider
responses, addresses or credentials. An erased profile displays as **Erased
actor** while preserving its opaque actor ID and historical action chain.

PEG-011/036’s complete proof/guest journeys, PEG-012’s complete rules,
PEG-024/046–054’s product imports, PEG-027’s API/MCP/webhooks, PEG-062/074/075’s
agent execution and PEG-086 recovery must use the same permanent audit as their
remaining doors are built. Current native record APIs are documented in
`docs/DATA-RECORD-API.md`; they do not establish those clauses’ completion.

## Retention and holds

Separate periods cover product history, trash, attachments/proofs, import
originals, agent prompts/outputs, provider logs and transient credentials/sessions.
The default keeps records until an owner reviews removal. Changing a period
previews its old/new value, held records and current eligible-record impact; it
starts no automatic destructive job. Expiry has its own exact-scope review with
a frozen cutoff.

Current expiry covers work history, attachment/proof bytes and version/decision
records, agent outputs/retrieval copies and expired local sessions/tokens.
Provider delivery logs remain immutable and retained; their expiry door is
unavailable and its class preview discloses that limitation. A proof expires as a coherent group after every version is
eligible and unheld. Otherwise the preview discloses retained dependencies.
Trash/import-original and agent-prompt stores are not built; no cleanup of those
stores is claimed. PEG-024/054/064 and PEG-062/074/075 inherit the retention classes
when they add that storage.

Holds record scope, authority, creator and expiry. Workspace, project, task,
attachment, proof and person holds prevent conflicting removal, including linked
custody. Release needs explicit owner confirmation. Existing time records,
recurring snapshots and shared field authority remain retained for separate
custody review. Shared tasks remain in their other projects. When removal changes
a retained human-approved task’s context, its sign-off reopens with the writer
and cause recorded, after the preview names that consequence.

Incoming signed agent outputs require current project edit scope and an approved
declared processor. Policy revocation fences subsequent agent reads/submissions.
The selected sharing/training choices are retained as provenance; no model is
invoked or content sent to a processor by this storage door. Agent runtime
execution must enforce those choices under PEG-062/074/075.

Removing an output queues a redacted **needs owner action** follow-up for its
declared processor copy. The preview, partial receipt and Data settings disclose
it. No request is sent automatically and no external deletion is called
confirmed. The unresolved ledger survives archives. Unlisted processors,
sharing and training remain denied until separate owner consent.

## Reviewed erasure

Previews enumerate dependent rows before project, task, attachment or proof
removal. Proof versions pin the actual uploaded PDF/file bytes by digest. Search
rows and agent retrieval copies are real database records and are removed with
their parent work. A revision/authority guard in the deletion transaction rejects
stale reviews. Stable IDs and agent-operation keys are fenced against later writes
or replay. Receipts are immutable and retrievable by ID.

Current attachment/proof originals and indexed/retrieval copies use the
installation’s database. R2 originals, derivatives and incomplete upload parts
remain PEG-058/082 work; their cleanup is not claimed. A shared proof needs its own
explicit proof review before its project can be removed. Its all-version scope
and any reopened task sign-off are disclosed.

Members/guests must be deactivated and owned work transferred first. Current
person removal anonymizes the inactive profile and permanent-audit presentation
and removes reviewed work dependents. Local authentication material and legacy
access activity stay retained, so the identity receipt is partial. Other scopes
with retained historical activity or unconfirmed processor copies also get
partial receipts. The last owner requires installation reset or replacement.

## Archives and external limits

Native `rer export` / `rer import` and `/api/portability` share one seed-owned Base
policy. An eligible empty destination is required. Restored recurrences stay
inactive, grants revoked, metric credentials absent, webhooks excluded and
processor policies denied pending fresh owner consent. Actual database bytes,
proof links/decisions, audit, receipts and erasure/follow-up journals travel.

Erasure invalidates archive snapshots/staging, records Base tombstones and moves
a redaction checkpoint. Supply a later complete archive with
`rer import --input exports/old.rer --journal exports/later.rer --yes` to fence an
older offline copy. The current JSON journal endpoint is for inspection; the
CLI’s `--journal` takes the later archive. An offline copy without the later
journal cannot know about subsequent erasure.

Downloaded files, outside messages and declared processor copies need those
systems’ deletion process. No provider-confirmed deletion or recall is claimed
without a real receipt. Whole-workspace erasure, complete identity cleanup,
product intake/import replay, live R2 qualification and autonomous agent execution
remain explicit acceptance gaps. PEG-057/059/065 stay partial while the adopted
owner-only review, hold precedence, retained-history and processor defaults await
CT disposition.

### Current database archive coverage

[Archive store inventory](./ARCHIVE-STORES.md) names every current migrated store,
its retained data, inactive transformation or explicit exclusion. The archive
manifest independently declares its actual table counts and source identity.
Owner-only Data settings can create an archive, resume it after restart, inspect
progress and content digest, download completed data or discard transfer staging.
These downloads include private personal work; keep them private.

Calendar connection and task-event mappings now travel without credentials.
Connections restore inactive and every restored block remains historical even
following fresh connection consent. Old preview, sync and delete operations
cannot resume provider writes. A new reservation uses a new reviewed operation;
no existing provider event is automatically adopted or removed. Login tokens
are excluded, pending access requests become stale, and pending bundle jobs are
cancelled. Human decisions and notification receipts remain historical records.
Personal section rules also restore inactive: merely opening My tasks cannot move
work. Their own person reviews the displayed group and destination and chooses
**Activate rule** to resume that local routing. Other people, including installation
owners, cannot activate someone else's personal rule.

Restore preserves the original owner identity. An already claimed installation
is not an eligible empty destination; use native CLI restore before owner claim
and establish fresh native sign-in configuration. The HTTP archive API uses the
same policy and refuses an occupied destination rather than replacing its owner.
The database journey covers retained PDF originals and two proof-version links;
it does not establish PEG-082's R2, exact-limit or migrated byte-custody claims.
PEG-084's suppression, authenticated-sender and explicit send reauthorization
qualification remain pending under its account dependencies. Future product
import, agent and connector stores inherit the same archive obligation.
