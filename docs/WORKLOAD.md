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
