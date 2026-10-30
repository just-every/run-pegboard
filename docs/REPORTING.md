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
began. Estimate and deadline edits do not restart the doing interval; completion
counts once even when its deadline changes in the same edit. Missing duration or deadline history produces Unknown rather than a
fabricated total.

Business measures freeze the same authorized snapshot with their native source
records. They describe current business state, rather than inventing earlier
planning or approval states:

- Approved hours include only currently approved timesheet entries that the
  reader may open through the native timesheet door, with signed approved
  adjustments and the selected project. Recorded work dates stay calendar dates;
  a report timezone never moves an entry into another work day. Draft or returned
  entries, notes and adjustment reasons are excluded.
- Committed hours are current scheduled participant effort, spread with the same
  working calendars as Workload. Reviewed Split, Sum and per-person allocations
  are retained; shared tasks count once. Undated participant effort is available
  separately as Unscheduled hours, with no invented daily bucket.
- Available hours count each distinct participant assigned to selected open work
  once per local calendar day, including their native leave and working hours.
  Overload hours compare selected scheduled demand with each person's daily
  availability before summing. Hidden and unselected commitments never enter
  these totals. Unknown native availability stays Unknown. These are current
  plans for the selected days; no historical availability claim is made.
- Requests count deduplicated native project intake created during the selected
  local-day window. The source task's current status supplies the grouping.
  Membership access requests are not work intake.
- Pending and approved reviews include task and proof reviews created during the
  selected local days, using their current native decision state. Pending includes
  reopened, stale and changes-requested reviews; rejected and withdrawn reviews
  are excluded. An unselected proof attachment cannot contribute a count.

Each business value links to its frozen source records and permitted native task,
timesheet or proof context. A new capture reflects changed work; existing snapshots
retain their captured values. Downloads recheck timesheet, proof, capacity and
current selected-project authority as well as task export rights. Becoming an
ordinary member cannot retain someone else's timesheet download through a saved
report. Availability and overload use a daily line, source table or single number;
burn charts retain their explicit task count or effort definitions.

Membership changes outside the selected project scope disclose neither a source
event nor its timestamp. Upgrading this privacy correction expires prior cached
snapshots; saved dashboards and source history are retained for fresh capture.

Every displayed value links to its source task rows and event references. CSV,
real XLSX and paginated US Letter PDF contain the same snapshot definition,
values, source rows and source events; there is no hidden row limit. The workbook
uses literal string cells, never formulas. CSV neutralizes formula-like text
with an apostrophe. PDF preserves its built-in font’s Western punctuation and Latin characters;
other characters are represented as explicit Unicode code points. A plus at the
start of a wrapped field line marks continuation, preserving spaces at the wrap. Downloads are private, are available for at most
24 hours and recheck current access; losing a selected project or source task
refuses a saved download. Erasure removes cached payloads and event references.
Already downloaded external copies cannot be recalled. Cached snapshots and read
guards are excluded from portable installation archives.

This is included native reporting. It sends no email and makes no client or
executive publication. Scheduled email, authenticated-sender suppression,
provider acceptance, controlled mailbox receipt within 15 minutes and overdue
recovery remain unqualified under PEG-018 and PEG-084. Qualified BI clients remain
PEG-044's obligation.
