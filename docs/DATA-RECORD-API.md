# Native custody records

These signed-in `/api/v1` doors use current task/project grants. Writes require the
same origin. Proofs and outputs are native stored records; these APIs do not call
a model or substitute a provider.

| Door | Behavior |
| --- | --- |
| `GET /search?q=TEXT&after=ID` | Returns only currently readable tasks with matching indexed title/description, current visible titles and an authorized-row cursor; no hidden counts. |
| `POST /tasks/:id/proofs` | An internal editor pins an existing attachment using `attachmentId`; returns a proof/version ID and SHA-256 of the actual bytes. Personal/guest/agent proof creation is denied pending their complete review doors. |
| `GET /proofs/:id` | Current readable version history and immutable decisions; an inaccessible current file hides the proof. |
| `POST /proofs/:id/versions` | Pins another actual attachment with `attachmentId` and the reviewed `currentVersion`; prior decisions do not approve the new version. |
| `GET /proofs/:id/decision-preview` | Returns the current version, exact preview token and independent-human administrator eligibility. |
| `POST /proofs/:id/decisions` | Takes `versionId`, `token`, `action` (`approve`, `changes`, `reject`) and `reason`. Stale, self/agent and unauthorized decisions are denied. It approves only that version, never the task automatically. |
| `POST /tasks/:id/agent-outputs` | An active scoped agent supplies `projectId`, approved declared `processor`, `body` and an idempotent `key`. The current policy is checked; changed-key replays and erased keys are denied. |
| `GET /agent-outputs/:id` | Returns the submitted body only within its current project/task grants. |
| `GET /agent-outputs/:id/retrieval` | Reads the actual derived retrieval copy under the same grants and current processor policy. |

Proof additions and agent outputs reopen an existing task sign-off with the
writer and cause recorded. Removing reviewed content through Data settings does
the same where fresh review is needed. Full proof viewers/annotations, external
approval capabilities, sponsored model execution, prompt storage, search scale
qualification and R2/resumable upload qualification remain with their owning
clauses; their completion is not claimed here.

The current ordinary attachment door retains its existing 524,288-byte database
limit. PEG-082’s larger guarantees require its complete registered R2 upload
implementation; these custody APIs do not lower that contractual requirement.

## Local rule audit

Authorized administrators use `GET /api/v1/admin/audit` and its `export` door.
Exact query filters `rule`, `run`, `activation`, `operation` and `event` select opaque
identities without expanding the existing workspace or personal scope. The browser
audit search offers rule and run IDs alongside action, actor and subject filters.
Run receipts display their task, triggering event and work-action count for direct
correlation with the scoped operation.

Local configuration emits `rule.created`, `rule.edited`, `rule.activated` and
`rule.deactivated`. Matching native triggers emit `rule.run_queued` or an inactive
`rule.run_blocked`; processing emits `rule.run_applied`, `rule.run_noop` or
`rule.run_blocked`. Receipts bind version and activation, trigger and activating
actors, run and task identities, closed outcome codes and the operation ID when
work changes. Dates, descriptions, names, rule action text and credentials remain
outside permanent metadata. The operation identifies the exact scoped work
result; it grants no additional read authority.

A rule that evaluates already-current values records `rule.run_noop` with
`no_changes` and no operation identity. Its existing native run still finishes
as applied; the audit describes the actual work result without changing rule
execution semantics.

Deactivation or editing never rewrites earlier receipts. Restored rules remain
inactive, erased actors retain anonymized attribution, and existing run receipts
survive native archive restore. Queue and terminal receipts share the original
trigger event ID. A queued run fenced by native restore appends `rule.run_blocked`
with `restored_inactive`, preserving its original activation and actor without
restoring execution authority. These records do not expand PEG-012 rule behavior
or qualify product imports, autonomous agent execution or future integration doors.

## Existing template and bundle rule audit

The same exact rule, run, activation and operation audit filters apply to native
template and workflow bundle receipts. Template actions begin with
`template_rule.`; bundle actions begin with `bundle_rule.`. Configuration events
name the version and activation being reviewed or retired. Queue and outcome
events bind the native run and triggering task to their actor and activation.
An edited template definition names its retired activation and prior version
separately from the new inactive version. A local bundle override records an edit
only for its changed component and records the renewed adoption epoch for each
installed rule; subsequent run receipts identify that exact activation.
Bundle rule and activation identities are opaque digests, with numeric adoption
epochs retained separately. Copy a receipt's `metadata.ruleId` into Rule ID on
Permanent audit to inspect its complete history. Activation ID, Operation ID and
Triggering event ID narrow the same exact correlation on screen and in its export. No raw component key is retained.
A bundle no-op has result `noop` even though the existing native job is finalized
as applied; the audit distinguishes an evaluated rule from a work mutation.
Native archive recovery retains the original receipts and records blocked queued
work without reactivating its source installation's authority.
