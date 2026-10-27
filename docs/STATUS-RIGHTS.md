# Status snapshot rights requests

PEG-015 remains partial. The native API tracks custody review; it cannot erase
retained status snapshots or certify compliance. The recorded CT ruling is in
[RULINGS.md](../RULINGS.md). The normal erasure preview still reports the explicit
retained-snapshot custody blocker, and request responses always report
`erasureOutcome: not_erased`.

## Intake and responsibility

An installation owner records a verified request using
`POST /api/v1/status-rights-requests`, supplying:

- `type`: `task`, `project` or `person`, and `targetId` in this workspace.
- `receivedAt`: the actual receipt instant, including historical intake dates.
- `handlerId`: an active named internal human, and `handlerUntil`: a definite
  custody delegation expiry within 90 days of assignment.
- Optional `applicableDeadline`: an earlier response deadline where the applicable
  rule requires it. The default is 45 calendar days from receipt.

This is owner-recorded intake, not a public request portal or verification of
identity or legal applicability. The acknowledgment deadline counts ten working
days after receipt, excluding weekends and observed US federal holidays. A more
restrictive local rule must be recorded and handled by the responsible human.

`GET /api/v1/status-rights-requests` lists the caller's authorized requests.
The owner sees the workspace register; each handler sees only their unexpired
assignments. `GET /api/v1/status-rights-requests/:id` exposes receipt, handler, deadlines,
structured native copy identifiers, dispositions and attributed action history.
The owner and that request's current, unexpired handler may read it. Delegation
creates no project grant, personal-task permission or general privacy role. It
exposes no snapshot text. Other requests and unrelated work remain inaccessible.
Restored archives invalidate delegated custody authority; an owner must appoint
a handler again. Native custody tracking travels with the archive.

The inventory covers matching cited tasks, project placements, draft creators,
publication reviewers, reviewed recipients, comment authors and rejection actors.
It is a starting inventory, not proof that arbitrary free text, downloaded copies,
installation archives or processor copies have been found. Snapshot reuse is
restricted once inventoried, including ordinary draft and revision reads and
new snapshots of disputed work. This restriction is not a lawful retention basis.

## Acknowledgment, response and escalation

Post actions to `POST /api/v1/status-rights-requests/:id/actions`, with the current
`version`. Concurrent or stale actions refuse. The actor and actual server time
are recorded; callers cannot backdate a notice.

- `acknowledge`: supply `notice`, recording an acknowledgment actually made
  through the verified request channel. This API sends no mail.
- `extend`: only before the original response deadline, after acknowledgment.
  Supply `permitted: true`, the applicable `rule`, permitted `reason`, actual
  `notice`, `finalDate` and `permittedUntil`. The extension cannot exceed that
  recorded rule limit, run indefinitely or cite missing software as justification.
  Applicability is the named human's responsibility, not an automated legal finding.
- `disposition`: supply a reasoned response and either
  `controlled_resolution_pending` or `justified_retention`. Neither means erased.
  Pending controlled resolution requires `reviewAt` within seven days, an explicit
  next review rather than an indefinite engineering hold. Justified retention
  requires `basisType` (`lawful_hold` or `applicable_retention_rule`), specific
  `basis`, `authority` and future `reviewAt`; missing software is refused.
- `delegate`: owner only; supply the replacement `handlerId` and `handlerUntil`.
  The previous handler immediately loses request access and cannot redelegate.

Reads return acknowledgment, response, controlled-resolution, retention-review and
handler-expiry escalation reasons, addressed to the installation owner. An `at`
query evaluates deadlines at a chosen instant for planning and reproducible tests;
it never changes action timestamps or permits a late extension. Late acknowledgments
remain visibly late by their recorded time. There is no automatic scheduler or
outbound escalation notification yet; the owner must inspect the request register.

## Controlled manual resolution procedure

The owner and designated handler must use this procedure while reviewed product
erasure is unfinished. Do not treat a blocked API request as a disposition.

1. Verify identity, applicable rights and deadlines outside ordinary project
   browsing. Record receipt and a named handler immediately; acknowledge through
   the verified channel. Maintain a separate controlled case file for legal
   documents and sensitive explanations; request action notes should contain
   minimal references rather than personal content.
2. Review the native identifiers and reconcile draft content, original and corrected
   published revisions, source text, recipients, comments, rejection notes, notices,
   activity, indexes, processor copies, exports and every retained installation
   archive. Restrict access and reuse; do not broaden a handler's browsing grants.
3. Separate eligible content from material actually covered by a documented legal
   hold or retention rule. For held material record the specific scope, basis,
   responsible authority and finite expiry or review date. Record a reasoned
   response; technical inability is not a legal basis or permitted extension.
4. For eligible content, have an authorized installation maintainer prepare a
   narrowly scoped forward migration or verified deidentification, reviewed by the
   owner and handler. Suspend affected publication and export activity during the
   controlled maintenance window. Preserve opaque nonpersonal audit continuity;
   do not disable immutable-history guards ad hoc or run an unreviewed deletion.
5. Before execution, validate that exact maintenance plan in an isolated copy,
   reconcile every affected store and independently verify absence of the selected
   personal content. Reconcile every older archive with an erasure journal so a
   restore refuses or removes the erased content. Record restricted integrity
   receipts without re-embedding personal content in evidence. If this proof is
   unavailable, escalate to the owner before the applicable deadline; the case
   remains unresolved and no deleted outcome may be recorded.
6. Execute only the exact approved plan, re-run reconciliation and archive-restore
   probes, remove temporary copies under controlled custody and give a reasoned
   response through the verified request channel. Contact responsible recipients
   and processors separately; report outstanding copies without implying confirmed
   external deletion. Use a permitted extension only with timely notice and an
   actual lawful reason. Record a near-term follow-up while unresolved.

This procedure documents the manual route and its safety requirements. No eligible
snapshot-erasure migration, verified deidentification, comprehensive inventory or
older-archive reconciliation has yet been qualified. The API deliberately has no
`erased` or `complete` action. Product erasure and end-to-end manual-resolution
proof remain required, as do browser controls and automatic deadline notifications.
