# Reviewed calendar work blocks

Open a project's Calendar, then use Calendar connection settings to connect your
own Google Calendar or Microsoft Outlook calendar. The current slice is available
only to the current installation owner. It requires explicit consent to the exact
exported fields and a write-capable calendar. A credential is supplied for each
action, used only during that invocation, and never saved or returned. Current
owner authority, account version and task edit permission are checked again.
Scoped delegation, durable OAuth custody and provider registration remain PEG-080
work; this owner-only floor is the standing conservative policy default, not
qualification of those broader connections.

Find free time for a task and a selected local work date. The preview subtracts
opaque provider meetings from the task owner's working hours, observed US federal
holidays and available time after leave. It uses the owner's configured IANA zone;
9 AM stays 9 AM across DST. The exact interval is reviewed before writing. A
second availability read refuses a slot that became busy. A work block is a
separate effort reservation: neither a local move nor a provider edit writes the
task's start or deadline. An all-day deadline includes its local day.

The provider receives only a private event titled **Reserved work**, its interval
and the provider's stable retry identity. No task title, person, notes, fields,
attendees, deadline or invitation is sent. The Calendar displays the local task,
provider, interval, timezone and reconciliation state. Native task deadlines stay
visible in the dated-work cards beside these reservations.

Google uses Calendar v3 CalendarList access roles, FreeBusy and Events. Microsoft
uses Graph v1.0 calendar edit permission, calendarView and Events. Their official
schema references are:

- <https://developers.google.com/calendar/api/v3/reference/calendarList/get>
- <https://developers.google.com/calendar/api/v3/reference/freebusy/query>
- <https://developers.google.com/calendar/api/v3/reference/events>
- <https://learn.microsoft.com/en-us/graph/api/resources/calendar?view=graph-rest-1.0>
- <https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0>
- <https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0>

A durable local intent is claimed before a write. Google receives a deterministic
event ID; Microsoft receives a stable transactionId. A lost create response stays
uncertain. Explicit readback finds that identity before accepting its exact
interval; it never blindly sends another event. Replaying a completed intent
returns the same mapping, including its cancellation tombstone. Reconnecting the
same provider and calendar retains mappings and never automatically writes.
Microsoft readback is bounded and refuses incomplete pagination rather than
assuming an event is absent.

Moves and deletes use the observed event ETag. A changed ETag, recurring instance,
busy interval, changed task or provider outcome that differs from the reviewed
interval stays in visible conflict. Provider readback updates only the separate
reservation when the task is still unchanged and the interval remains valid.
A new free-time preview is the human resolution door after a task change. Delete
removes only the mapped event and retains a local cancellation tombstone.
Disconnect prevents further native reads and writes; provider events remain until
explicitly deleted. Permission refusal ends the connection until reviewed
reconnection. Task erasure cascades local mappings and previews, fencing old
intent replay; it does not claim to delete external events.

Connection records, previews and mappings are excluded from installation archives:
restoring a task cannot restore calendar authority or replay an old outbound
intent. No credential is stored in any table or operational audit. Mapping loss
on archive restore requires owner reconciliation with existing provider events,
not automatic event creation. Provider account identities and retained external
events remain within the explicitly unresolved external-custody boundary.

The public-door scenarios in `tests/scenarios/calendar-blocks.mjs` run through the
real authenticated Worker and durable database. Their Google and Microsoft HTTP
results are **official-schema fakes**; no live provider qualification is claimed.
`tests/journeys/calendar-blocks.mjs` drives the real Settings and Calendar forms,
with assertions at 1440 and release screenshots at 1440 and 390. Both are wired
into push Verify through the existing work graph registrations.

PEG-025 remains partial. Apple Calendar and a second ICS client, stable feed UIDs,
date-only updates and cancellations, feed and share revocation, hidden-field
exclusion across feed readers, raw feed-capability exclusion from logs and
archives, and disclosure of previously cached client copies are still required.
Recurring provider exceptions beyond safe refusal, automatic two-way delivery,
scoped delegation and provider custody remain unfinished. PEG-080's owner or
delegated administrator registration, consent, timed guides and live qualification
remain unchanged obligations.
