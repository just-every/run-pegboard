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

The packet is **not sent**. It contains no credentials and performs no provider
request. Provider setup, exact send review, durable delivery, receiver
acknowledgments and correction application remain unimplemented under PEG-042.
Do not submit the POST instructions repeatedly: neither provider promises
idempotency for those requests. First reconcile existing entries by Pegboard ID.
A repeated local download does not create entries anywhere.

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

Attributed adjustments stay pending for reviewed provider correction; they never
become negative create requests or rewrite an approved original. Gauge transfer
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
