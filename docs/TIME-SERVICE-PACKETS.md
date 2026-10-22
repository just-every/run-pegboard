# Review approved time against a service

On an approved timesheet, **Download time service packet** prepares Harvest or
QuickBooks Time request JSON and a source reconciliation manifest. Download the
approved CSV first to find Pegboard person, project and task IDs. Map these to
existing provider IDs; the packet creates no people, projects or job codes.

```json
{"people":{"<Pegboard person ID>":101},"projects":{"<Pegboard project ID>":201},"tasks":{"<Pegboard task ID>":301},"jobcodes":{"<Pegboard project ID>/<Pegboard task ID>":401}}
```

Harvest uses people/projects/tasks; QuickBooks Time uses people and a job code for
each project/task pair. Positive integer IDs are required. Missing mappings stay
in `pending` with their original IDs and seconds; repair the mapping and download
again. A packet contains exact approved seconds, approval provenance and stable
Pegboard entry IDs. Current access to every recorded task/project is required,
just as for approved CSV. Draft/submitted sheets never export.

A downloaded packet is **not sent**. It contains no credentials and performs no
provider request. Do not submit its POST instructions yourself repeatedly:
neither provider promises idempotency for those requests. First reconcile
existing entries by Pegboard ID, or use [Send reviewed time](#send-reviewed-time),
which keeps a durable ledger. A repeated local download does not create entries
anywhere.

## Official schemas and duration limits

- [Harvest time entries](https://help.getharvest.com/api-v2/timesheets-api/timesheets/time-entries/):
  duration-mode `POST /v2/time_entries`, `user_id`, `project_id`, `task_id`,
  `spent_date`, `hours`, notes and `external_reference` (`id` and `group_id`).
  Hours derive from exact seconds; reconciliation compares unrounded `hours`,
  never `rounded_hours`, to the original seconds. Account duration mode and
  assignment authorization must be qualified before any actual submission.
- [QuickBooks Time official API](https://github.com/TSheetsTeam/api_docs/blob/master/source/includes/APIReference/Timesheets/_create.md.erb):
  `POST /api/v1/timesheets`, `data` arrays of at most 50 manual timesheets with
  `user_id`, `jobcode_id`, `date`, `duration` and notes. Manual duration rounds to
  hundredths of an hour. Only multiples of 36 seconds can preserve exact time;
  other durations stay pending. No invented start/end interval substitutes for
  a manual entry. A `[Pegboard:<entry ID>] ` notes prefix preserves identity;
  do not strip it from readbacks. Provider account settings still need live
  qualification.

Attributed adjustments stay pending in a packet; they never become negative
create requests or rewrite an approved original. A reviewed send applies them as
corrections of the acknowledged entry (below). Gauge transfer
also remains unavailable: its bearer door currently reads aggregate state only,
and its import target refuses imported approval. No invoice, rates, payroll or
monetary budget action exists in these packets.

## Compare a complete provider readback

The same signed-in API prepares a packet with
`POST /api/v1/timesheets/:id/provider-packet` and `{service,mapping}`.
`service` is `harvest` or `quickbooks-time`. Submit that packet's `revision`, the
same service/mapping and a `response` to
`POST /api/v1/timesheets/:id/provider-reconciliation`. It accepts a complete
Harvest `time_entries` list (`next_page:null`) or QuickBooks Time
`results.timesheets` readback (`more:false`). Paginated/incomplete readbacks are
refused; narrow the provider query to this sheet's entries.

Reconciliation checks entry identity, unique provider IDs, person, mapped
project/task or job code, date and exact unrounded duration. Missing, duplicate,
changed, extra and unsupported rows prevent `reconciled:true`. QuickBooks Time
write-result errors cannot match. No local or remote time record changes.
Reconciliation is repeatable; loss of current work access refuses a repeat.

A supplied response is **user-supplied, unverified evidence**, including when all
fields reconcile. `delivery:not_sent` and
`receiptAuthority:user_supplied_unverified` always remain present. This is a
read-only comparison tool, not an authenticated provider receipt or proof that
PEG-017/042's service acceptance is complete. Tests use official-schema fixtures;
no live or sandbox provider qualification is claimed.

## Send reviewed time

A workspace owner or administrator who can open every entry sends an approved
sheet from **Time service delivery** on its timesheet page, or with
`POST /api/v1/timesheets/:id/provider-delivery` and
`{service,mapping,revision,confirm:"reviewed-exact-packet",credential,account}`.
`revision` is the sheet's current review token, so a change to the sheet or to
anyone's authority over it refuses the send (409). `account` is the Harvest
account ID. QuickBooks Time's receiver is the company the token opens
(`client_url` from `GET /api/v1/current_user`). The person who logged the time,
other reviewers, analysts and agents can download packets but cannot send.

The access token (a Harvest personal access or OAuth token, or a QuickBooks Time
OAuth token) is used only for that send's provider calls. Pegboard never
stores, logs, audits or returns it. A refused token writes nothing (400
`time_service_credential_refused`). Stored per-installation connections are not
built.

Each approved entry has one ledger row per service and receiver account:

- **Acknowledged** rows carry the provider's entry ID and the duration the
  provider reports. They are never sent again, so replaying a send changes
  nothing. An acknowledgment reconciles only when the provider's own record
  carries the reviewed person, project/task or job code, date, Pegboard ID and
  exact duration. Otherwise it is flagged `provider_fields_differ` and stays
  unreconciled; it is still never resent.
- **Rejected** rows carry the provider's status and reason, such as QuickBooks
  Time's `417 Expectation Failed: Invalid jobcode_id` or a Harvest 422. Repair
  the mapping and send again: only those rows are resent.
- **Uncertain** rows got no definite answer (a lost response, timeout, 429 or
  5xx). The next send first reads the entry back by its Pegboard ID: Harvest
  `external_reference_id`, or QuickBooks Time's `[Pegboard:<entry ID>]` notes
  prefix for that date, person and job code. It acknowledges an entry that
  exists instead of creating another. A claim left by a stopped process is read
  back the same way after two minutes.
- Pending rows (missing mappings, durations QuickBooks Time would round) are
  never sent.

An approved adjustment on a later sheet corrects its original's acknowledged
entry with Harvest `PATCH /v2/time_entries/{id}` (new `hours`) or QuickBooks
Time `PUT /api/v1/timesheets` (new `duration`). Pegboard reads the provider
entry first, and it must still hold the exact prior total (the original plus
earlier acknowledged corrections). If it does not, the correction is rejected
as `provider_value_changed` and nothing is overwritten. Only one correction per
entry runs at a time. A correction never deletes, duplicates or negates a
provider entry. A total that would reach zero, or that QuickBooks Time would
round, stays pending. Each correction row names the adjustment, its original,
the provider entry and the new total, and the adjustment keeps its reason and
author in Pegboard.

Each send makes at most 40 provider calls. Anything left is listed in
`remaining` for the next send. `GET /api/v1/timesheets/:id/provider-deliveries`
lists the ledger for the entries the reader can open. Every send writes one
attributed sheet-history entry and one audit entry, each with counts only.
Delivery calls only identity and time-entry endpoints: no invoice, rate,
payroll, approval or budget action. The provider's response is the
acknowledgment; Pegboard never marks provider-side approval.

Tests use network-edge fakes built from these official schemas
(`tests/support/time-services.mjs`). No live Harvest or QuickBooks Time account
has been qualified. Gauge delivery remains unavailable because Gauge has no
approved-time import door.
