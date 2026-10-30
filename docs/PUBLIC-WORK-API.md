# Scoped public work API

The machine-readable contract is `GET /api/v1/public/openapi.json`. The MCP
Streamable HTTP endpoint is `POST /api/v1/public/mcp`. These native doors share
the task, project, report, comment and privacy services used by the app.

Sign in to authorize a credential with `POST /api/v1/api-keys`:

```json
{
  "name": "Planning assistant",
  "projects": ["PROJECT_ID"],
  "personal": false,
  "writable": true,
  "expiresAt": 1794000000000,
  "consent": true
}
```

Choose a future expiry within 30 days. The example timestamp is illustrative;
use a future timestamp when authorizing. The returned `secret` is shown once.
Keep it in the client's private credential store and send it as a Bearer
authorization header. Never put it in a URL. List your own credential metadata
with `GET /api/v1/api-keys`; revoke one with `DELETE /api/v1/api-keys/{id}`.
Another person cannot list or revoke your credential. An agent cannot issue
one. Credential authorization is explicit audited delegation, and confers no
human identity or decision authority on its holder.

A credential reaches the intersection of its selected projects and its active
person's current permissions. A project grant disappearing takes effect on the
next request. Account deactivation, an identity revision, expiry, revocation or
disabled integrations refuses the credential. Project fields, comments,
history and files are filtered before serialization, including when the person
has broader access in the app. `personal: true` reaches only that person's
no-project tasks. Personal list reads compute current date groups from saved
layout without applying section rules or recording moves, for both read-only
and writable credentials. Native My Tasks retains its saved-rule evaluation.
An installation administrator's key cannot read another
person's private task. Private personal tags attached to shared work also
require personal scope in addition to that work's project scope. A project-only
key never receives those tag names. `writable: false` permits reads only.

Use the published `task_create`, `task_update`, `task_comment`, `task_read`,
`project_tasks`, `project_report` and `personal_tasks` operations. Task IDs and
current or historical human references use the same permission checks. A
mutation requires a unique `intent` string. Repeating an identical intent
returns the stored result; changing its operation or input refuses it.
Concurrent or interrupted executions remain fenced instead of being repeated.
Refresh the task's `revision` before updating it; a stale review changes no
work. Task creation queues the same currently activated project rules as
native creation, in the task transaction. Replaying its intent never queues a
second effect. Template-rule processing uses the native processor;
workflow-bundle jobs keep their existing processing door.

Scope and permission checks run again before replaying a saved result.
The common editor commits its revision fence and changes atomically.

Project pagination returns at most `limit` tasks in stable ID order and the
last returned ID as `next`, or null. Supply it as the next `cursor`. Each page
rechecks current access. This is a live traversal, not a retained snapshot;
concurrent creation can precede a cursor. Project reports count only permitted
work and compute effort through the app's existing deduplicating rollup.

Every bearer credential represents external execution, including when its
sponsor is the installation owner. `task_approve` always refuses with
`human_approval_required`. Setting an approval task to done through the editor
also refuses. Finish an approval through the app's authenticated human decision
door, under its existing independence and current-authority checks.

## Personal sections and layout

`personal_sections` (`GET /api/v1/public/personal-sections`) lists only the
credential owner's sections and an opaque edit revision. A key without
personal scope cannot use it. A writable personal key uses that revision and a
unique intent with `personal_section_save` (`POST /api/v1/public/personal-sections`)
to create a section, or supplies its own section ID to rename or rank it.
`personal_task_place` (`PATCH /api/v1/public/personal-tasks/{taskId}/layout`)
sets a personal task's section, rank and optional Today flag. An empty section
ID clears the section; omitted fields retain their saved values.

These operations call the native personal services. Another person's section
or task remains unavailable even to an administrator's credential. Every edit
checks its current credential and revision in the same transaction as its
writes. Native section and layout edits invalidate external reviews too.
Replaying an identical intent returns its prior result without moving work
again. Section deletion and section-rule configuration remain outside this
public surface.

## MCP connections

Configure the installation's HTTPS MCP URL and the Bearer credential in your
client's private connection settings. The server supports JSON-RPC initialize,
initialized notification, ping, tool listing and tool calls, with protocol
versions `2024-11-05`, `2025-03-26` and `2025-06-18`. Initialize returns the
negotiated protocol, tool capability and human-approval instructions. Tool
schemas declare required inputs; the server validates work and permissions
through the common services. A failed tool call returns `isError: true` and a
structured status and error in its text content. Unknown methods and tools
return JSON-RPC errors. No request parameter can select a different actor.

Claude, ChatGPT, Gemini and Cursor are covered by named MCP initialize and tool
schema-edge requests in `tests/scenarios/public-api.mjs`. These results are
**schema-fake**; no live vendor account or installed client is qualified. Other
compatible clients use the same protocol. Client-specific authentication and
installed-client qualification remain outside these receipts.

## Signed events and reviewed webhook delivery

`events_list` returns currently permitted task identifiers, event IDs, kind,
time and credential audience with an HMAC-SHA256 signature. Event IDs and page cursors are opaque; pages contain only currently permitted events. The signing key is
the hexadecimal SHA256 digest of the JSON-encoded Bearer credential. Verify the
signature over the exact JSON envelope bytes. `event_receive` verifies the
signature and current scope and records the event once per credential; its
`applied` result is true for the first receipt only, including across restart.
This receipt does not run an external business operation. Consumers must apply
their own work and deduplication together in their own transaction.

The signed stream and webhook delivery have different audiences and signing
keys. Register a subscription through `POST /api/v1/webhooks`, selecting its
project, HTTPS destination and task event kinds. Save its once-shown `secret`.
Only its creator with current integration administration can inspect or send
its events. Personal work never enters a webhook delivery.

Read `GET /api/v1/webhooks/{id}/event-preview?eventId=EVENT_ID` and review the
exact destination and identifier-only envelope. Send it with
`POST /api/v1/webhooks/{id}/deliver`, supplying `eventId`, the preview `token` as
`revision`, explicit `consent: true` and the subscription `secret`. That secret
lives for one send and is never stored or logged. The receiver gets the exact
JSON envelope, `x-pegboard-event-id` and `x-pegboard-signature`, an HMAC-SHA256
signature using that secret. A receiver should verify before applying an event
and persist the event ID with its effect. Refuse altered or unsigned payloads.

Delivery claims are durable before the network call. A repeated send returns
the existing receipt and makes no second outbound request. A lost response is
uncertain and is never automatically retried. Redirects are not followed.
`GET /api/v1/webhooks/{id}/deliveries` returns response status and acknowledged,
rejected or uncertain states, with no response bodies or secrets.
`DELETE /api/v1/webhooks/{id}` revokes the subscription. This is reviewed,
on-demand delivery; automatic subscription dispatch, retry and redelivery
controls remain unimplemented.

Credentials, intent results, event receipts and webhook delivery state are
excluded from native installation archives. They must be authorized again on
the destination. Departure permanently revokes public API credentials.

## Remaining contract work

PEG-027 remains partial. These doors cover task creation and editing, project
pagination and reporting, personal tasks, comments, signed event receipts and
reviewed webhook delivery. They do not yet expose the complete view and search,
portfolio and goal report, time, human approval, import and export, automation,
personal-section deletion and rule configuration, tag, announcement-thread, duplicate-merge or custom-agent
resource surface. No missing resource silently falls back to a broader app
route. Bounded idempotency recovery and
retention, complete event-kind coverage, and automatic webhook dispatch and retries remain required.

Default adopted pending ct: a current human explicitly authorizes only their
own finite project or personal credential, with no authority expansion; every
external credential is unable to approve; outbound webhook delivery requires a
current creator's exact audited review and a one-use secret. PEG-062 inherits
the nonhuman approval boundary and PEG-032 inherits credential cancellation.
The clause's acceptance text is unchanged.

## Shared agent-door source

`base-copies.json` records the shared agent-door, Business settings and native
operator-auth runtime source at Base commit
`d555e789cffb744a9f83d76ebe42a2e3bdd7a055`. Additive migrations retain the
existing installation's applied schema history. Runtime source custody and the
published `@runeditrun/rer` CLI pin are separate.

The recorded modules are not mounted in the production Worker yet. The existing
REST and MCP surface described above remains the supported interface; company
policy adoption, shared approval pages and Business-bound agent credentials are
not currently available in Pegboard. No additional agent capability, provider,
spend enforcement or native authority is implied by the source copies.
