# Workload and availability

Open **Workload** to compare dated commitments with each person's working capacity. Choose a day, week or two weeks. Work shared by several projects is still one task. Hidden commitments contribute hours without their titles or identifiers. Visible task counts, task estimates and participant-hours have separate totals. Undated work is listed separately rather than assigned an invented date.

Commitments are distributed over their scheduled working intervals before absence is removed. Declaring an absence reduces capacity; it does not silently move the work. Hours describe effort, not utilization economics or billing.

## Declare your availability

In **Account → Availability**, set your IANA timezone, working hours and skills. Declare full days, with the last day included, or a partial interval in your local time. No integration is needed. Declarations are labelled self-declared, distinct from approved HR leave. Assignment and mention choices warn about absence during the task's planned dates. The capacity-planning API excludes unavailable and unknown capacity.

An optional delegate is a contact only. It grants no permissions and sends no message. No private reason is collected. Extend or cancel your own declaration; the history records who acted and when. Existing working-calendar settings remain under Settings.

## Review a staffing scenario

Drag a readable task to a person's capacity card, or use **Compare staffing**. Both open the same before-and-after comparison. Nothing changes until you apply that exact review. A changed task, capacity profile, leave interval or permission invalidates the review. A Viewer cannot reassign work, and an agent cannot approve its own proposal.

Reassignment transfers the accountable owner's allocation to the selected person while retaining other explicit participants. Assigning work grants no new access. Tentative staffing and unfilled roles are configured under **Settings → Capacity** and remain separate from committed work.

## Read approved leave

An owner or administrator configures an explicit source-person mapping under **Settings → Capacity**. No person is invited or matched by a guessed name. A source credential is used for one requested read and is not stored. Provider reads never write leave entitlements.

The BambooHR adapter reads the official time-off request response from its company API and accepts approved full-day intervals. Aggregate partial leave without a placed interval is held for repair rather than given an invented overlap. The Willow adapter reads the existing versioned calendar, including every cursor page. It keeps only mapped people, approved dates and opaque source references. Private reasons are discarded.

Approved and self-declared intervals are combined as a union. Re-reading a source replaces that source's snapshot and never subtracts the same absence twice. A failed read, revoked source, ended issuer authority, day-old snapshot or date outside the read's coverage is visibly unknown. A known self-declared full-day absence remains known. The provider tests use official-schema fakes at the network edge; they do not establish live-account qualification.

Person erasure removes the selected capacity profile, declarations, history and allocations. Opaque source tombstones prevent later source reads from recreating that person's availability. Restored source configurations are inactive and require a new authorized read.

## Preserve source effort

Use a task's **Review effort allocation** link from Workload. Select every mapped source participant and retain one accountable owner. Source people remain explicit references, with no invitation or additional access.

For a single 10-hour task, Split allocates 5 hours to each of two people. Sum allocates 10 hours to each, producing 20 participant-hours while the task estimate remains 10 hours. An explicit per-person source allocation preserves 3 and 7 hours and reconciles to the same 10-hour task estimate. Multi-homing does not duplicate either allocation.

Missing source semantics stay unresolved until a human reviews a concrete choice. Such a repair is labelled changed semantics and cannot be described as source equivalence. Whole-account source acquisition and cutover remain with PEG-047 and PEG-048; this door preserves the source interpretation the human reviews.

## Human portfolio-capacity scenarios

Open a portfolio, then **Portfolio capacity**. Enter two alternative task and
person pairs, a first date and a bounded period. These are human scenarios:
Pegboard does not generate or rank them as agent output. The review names each
source task, current and proposed owner, transferred participant-hours, unchanged
dates, required skills, preserved locks and current person-day workload across
all committed workspace work. Shared tasks contribute once. Only the accountable
owner's explicit effort allocation moves; other participants keep their hours
and source identities.

Commitment requirements and capacity-plan locks live under **Settings**, reached
from the capacity screen. Locks apply to this scenario door. They do not silently
freeze ordinary authorized task edits or create a new scheduling policy.

The native comparison API is `POST /api/v1/portfolios/:id/capacity/compare`.
Supply `from`, `days` and exactly two `alternatives`, each with `taskId` and
`personId`. The returned review token binds the human, current revision,
portfolio membership, dates, commitments, availability, existing project access
and the exact comparison. Apply one choice through
`POST /api/v1/portfolios/:id/capacity/apply` with the original input, token and
zero-based `choice`. It requires current edit authority in every project home
of the task and existing alternate access to those same homes. It grants no
membership. Guests and agents cannot approve. Changed context requires a new
review; an expired grant is rechecked even without a database write.

A scenario is feasible only for the displayed period and affected people, with
known availability, dated work within that period and no remaining daily
overload. Unqualified or unavailable people and locked commitments are refused.
For timed commitments, spare hours elsewhere in a day cannot cover an absence
inside the unchanged task interval. The review reports effort that cannot fit
that interval separately from daily overload. Review dates must include the
commitment in both affected people's local timezones; a UTC date alone does not
establish complete context.
Hidden project context, hidden affected commitments, unknown availability and
undated work prevent a feasibility claim. Other commitments disclose hours only;
hidden task identities, titles and project names are never returned. If neither
entered option is feasible, the screen reports an explicit staffing shortage
without changing assignments or deadlines. This is a comparison of the entered
alternatives, not an exhaustive search of all possible staffing.

Application persists one attributed operation and survives restart and replay.
The screen verifies current workload after application. **Review undo** makes
another current-authority review: it reverts only the owner and effort transfer,
preserving later text, estimates and dates. A later owner or allocation edit,
including a changed value subsequently restored, prevents undo. Erasure includes
the affected undo snapshots, so they cannot restore an erased participant.
If the reassigned task has since received human approval, undo is refused rather
than silently reopening that sign-off. The current assignment, approval and
history remain intact; ordinary selective undo retains later estimates and dates.

Scoped-agent generation, ranking, schedule alternatives, routed approvals and
autonomous execution remain unimplemented. No model, processor or spending
consent is inferred from a human scenario.
