# Company agents in Pegboard

Pegboard uses one Base agent door for the work-coordination specialist. The
copied agent-door and Business-settings runtime comes from released rer 0.2.91,
Base `2135c394939f4a737adabdc8003b0e667b31ac5a`. The CLI is pinned separately to
`@runeditrun/rer` 0.2.91. Exact copy custody lives in `base-copies.json`.

The declared capabilities are tools, policy, pause, audit and idempotency.
Resources, prompts, events and subscriptions are withheld with typed
`capability_not_declared` refusals. No resource link or specialist prompt is
advertised. Native record text is untrusted data. Optional capabilities and
unscoped multi-sponsor, timed, queued and hosted-edge families are not acceptance
claims of this core declaration.

| Tool | Native action | Possible classes | Clauses |
| --- | --- | --- | --- |
| `pegboard.task.create` | Prepare and persist one task, including native activated-rule queues | standard, external | PEG-001, PEG-027, PEG-062 |
| `pegboard.task.read` | Current permission-filtered task view | sensitive | PEG-001, PEG-027, PEG-062 |
| `pegboard.task.update` | Native editor at the current task revision | standard, external | PEG-001, PEG-027, PEG-062 |
| `pegboard.task.comment` | Current native commenting grant | standard, external | PEG-001, PEG-027, PEG-062 |
| `pegboard.project.tasks` | Native readable task page | sensitive | PEG-001, PEG-027, PEG-062 |
| `pegboard.project.report` | Native permission-filtered project rollup | sensitive | PEG-001, PEG-027, PEG-062 |
| `pegboard.personal.tasks` | Sponsor's private no-project tasks | sensitive | PEG-027, PEG-062, PEG-073 |
| `pegboard.personal.sections` | Sponsor's saved sections and edit revision | sensitive | PEG-027, PEG-062, PEG-073 |
| `pegboard.personal.section_save` | Native section creation, rename and rank | standard | PEG-027, PEG-062, PEG-073 |
| `pegboard.personal.task_place` | Native private layout at its current revision | standard | PEG-027, PEG-062, PEG-073 |
| `pegboard.work.snapshot` | Content-free digest of currently readable work and permitted personal layout | standard | PEG-027 |

The current native people store is `oa_operators`. Signed Business owner IDs bind
to the installation's native owner. Signed team IDs bind through `bs_team` to
native operator IDs; an address never chooses another account. Business admin
maps to native admin and policy editor; Business member maps to native member
with no policy-editing role. Existing native workspace, project, task, guest and
field grants remain authoritative. A locally promoted admin does not acquire a
Business editor binding. Changed email invalidates an older token without moving
its sponsor, approvals or audit.

Local API credentials retain their actual key ID, sponsor, project/personal
scope, expiry, writable flag, owner version and integration setting. Current
scopes and native grants are checked again on calls, approval execution and
completed replay. A recognizable invalid Business credential never falls
through to a local key. A completed creation replay also reopens its native
created record through the current reader; a newly hidden task yields no receipt.

Mutations derive outside exposure from current native guest visibility. The
server supplies the target and exact proposed items for review; imported text or
caller classification flags cannot lower a class. Native history and comments
show the agent for the sponsoring person. Original operation and idempotency
identities remain in creation history. Native deterministic rules retain their
separate, already reviewed activating person's authority; they are not a new
agent execution credential. No delegated background execution tool is offered.

Human work approval, provider connections and webhook delivery, import review,
installation setup and device work keep their existing screen, connector,
import, installation and device doors. The core registry does not claim every
remaining native product verb, a model-powered teammate, spend, provider cost,
Undo without a native reversal, public resources or live vendor qualification.
The broader PEG-027 and PEG-062 obligations remain partial.

After door decisions have been retained, native erasure reports
`review_agent_door_custody_before_erasure` and retains the records. Capturing a
new decision invalidates an older erasure preview in the native transaction.
A native deletion never claims to erase retained door arguments, receipts or
review evidence. Agent-door and signed Business stores are excluded from native
transfer archives; source-installation policy and pending authority do not move.

Verification uses the native setup-token owner claim, completes `/setup`, then
admits Casey Client through a real invitation and confirmation using the isolated
paid mail edge. No direct database writes or production fixture route are used.
Declared work tools reach no outbound provider beyond Base's built-in mail
adapters, so no additional network module is declared.

The 0.2.91 additional-sponsor initializer still receives only the owner's captured
mail reader. A newly Business-invited member's own invitation is unavailable there,
and `agent_sponsor_bootstrap` refuses the additional native lifecycle. The separate
reviewer initializer can consume its own mail, which proves guest exposure and
native confirmation but does not prove a second Business sponsor. Multi-sponsor,
inactive/excluded Business-subject probes and their role matrix remain unproved;
they are not counted as passing checks. Contract clauses stay partial.
