# Native reporting

Open Reports, then Report settings. Save a name, explicit project scope, inclusive
local-day window, IANA timezone, status filter and each widget's measure. The saved
configuration grants no access. Each capture uses the signed-in person's current
project and task export authority, including the workspace export minimum.
Dashboards and snapshots belong to their creator; they are not publication or
subscription authority. Capture again to include subsequent changes.

The horizontal bar, vertical column and donut group by recorded task status at
the selected window's close. The single number totals that same population and
the table shows its individual tasks. Line charts use each local day's closing
state. Burn-up shows completed work and burn-down shows remaining work, with the
contemporaneous scope drawn separately. Count and estimate hours are explicit
alternatives. A task shared between selected projects counts once, including
inherited subtask placements. A removed task contributes to earlier points only
while it was in the selected scope and remains readable today.

Completion means the native done status. Reopening restores remaining work.
Scope, effort, status and deadline changes are recorded at their database event
instant; a later edit cannot rewrite earlier points. Installation baselines mean
that prior history is unknown. Unknown points and future points are not plotted
as zero or joined across gaps. The date window includes both selected days;
local midnight boundaries make DST days shorter or longer without changing their
calendar labels.

Completed and overdue measures count tasks. An all-day deadline is overdue after
its local calendar day; an instant deadline is overdue at that instant.
Throughput counts completion transitions in the selected period while the task
was in scope, including subsequent reopening or removal. Cycle hours sum elapsed
hours from the most recent recorded doing transition to the recorded completion
of currently completed work. Status age sums hours since each current status
began. Missing duration or deadline history produces Unknown rather than a
fabricated total. The current slice does not report approved time, capacity,
requests or approvals.

Every displayed value links to its source task rows and event references. CSV,
real XLSX and paginated US Letter PDF contain the same snapshot definition,
values, source rows and source events; there is no hidden row limit. The workbook
uses literal string cells, never formulas. CSV neutralizes formula-like text
with an apostrophe. PDF represents characters outside its built-in font as
explicit Unicode code points. Downloads are private, are available for at most
24 hours and recheck current access; losing a selected project or source task
refuses a saved download. Erasure removes cached payloads and event references.
Already downloaded external copies cannot be recalled. Cached snapshots and read
guards are excluded from portable installation archives.

This is included native reporting. It sends no email and makes no client or
executive publication. Scheduled email, authenticated-sender suppression,
provider acceptance, controlled mailbox receipt within 15 minutes and overdue
recovery remain unqualified under PEG-018 and PEG-084. Qualified BI clients remain
PEG-044's obligation.
