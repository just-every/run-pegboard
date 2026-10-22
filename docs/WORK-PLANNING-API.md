# Work planning API foundations

Recurrence, approval-task decisions and goals currently have authenticated JSON API
workflows. Their browser workflows are not complete; PEG-005 and PEG-014 remain
partial. All writes require a native session and the same-origin request checks
used by the other `/api/v1` doors.

## Recurring work

1. Create ordinary work through `/api/v1/tasks` or `/api/v1/projects`. A task may
   use `kind: "approval"`; milestones continue to use `kind: "milestone"`.
2. POST `/api/v1/recurrences/preview` with `sourceType` (`task` or `project`),
   `sourceId`, `mode` (`calendar` or `completion`), `unit` (`day`, `week`, `month`),
   `interval`, IANA `timezone`, ISO local `start`, optional local `end`, `count`
   and an array of exception dates. The response contains the exact source
   snapshot, assignments, configuration, occurrence preview and `token`.
3. Review that snapshot, then POST the same body plus `revision: token` to
   `/api/v1/recurrences`. An intervening work or authority change refuses it.
4. GET `/api/v1/recurrences/:id` for the pinned template, next dates and durable
   occurrence ledger. POST its `/run` door to process due work or `/stop` to
   deactivate it. The Worker's fifteen-minute scheduled handler processes the
   same persisted jobs. A unique schedule/local-date record and the work it
   creates commit in one transaction; an uncertain response can be retried.

Calendar dates are interpreted in the chosen timezone. Completion schedules wait
for the previous task or project to complete, then advance from its local
completion date. Month schedules clamp to the last valid day while retaining the
calendar schedule's original day anchor. Exception dates are skipped. The count
limits generated occurrences, not attempts.

Snapshots retain native task attributes, task/subtask structure, sections and
field definitions/values. Task recurrence preserves its reviewed project
memberships; new project occurrences are private to the activating owner.
Comments, files, recorded time, grants and historical decisions are not copied.
Fresh approval tasks have no decision. Source references and the immutable
version-one template identity remain in the occurrence ledger and task history.
Current source access, template/field authority and active task owners are
rechecked at generation. A changed field definition on a task's existing project
refuses generation until a fresh template is reviewed. The preview accepts at
most 500 tasks. This foundation does not complete PEG-006's template gallery or
selective template upgrades.

## Human decisions

GET `/api/v1/tasks/:id/decision-preview`, review the task and returned revision,
then POST `/api/v1/tasks/:id/decision` with that `revision`, an `action` of
`approve`, `changes` or `reject`, and a nonempty `reason`. Decisions retain actor,
time and reviewed revision. Approval completes the task through a guarded
transaction. Ordinary completion cannot replace sign-off. Later work changes
reopen approved work; historical decisions remain attributed.

Pending contract-policy approval, only a different workspace owner/admin may
decide non-personal approval tasks. Agents and the task's owner cannot decide.
No notification or external action is part of this door.

## Goals

POST `/api/v1/goals` with `title`, `scope` (`company`, `team`, `personal`),
`teamId` for team scope, `kind` (`objective`, `key_result`), `periodStart`,
`periodEnd`, `mode` (`manual`, `work`, `numeric`), `unit`, `baseline`, `target`
and `staleAfterSeconds`. The goal retains its owner and period. Personal goals
are owner-only. Pending contract-policy approval, company/team goals are
restricted to workspace owners/admins; agents cannot create or update goals.

POST `/api/v1/goals/:id/links` with `sourceType` (`task`, `project`, `goal`),
`sourceId` and positive `weight`. Cycles refuse. Work rollups deduplicate tasks
across direct links, projects and subgoals, using the highest linked weight for
a repeated task. Current source access is checked on every read. Missing,
stale or restricted inputs produce explicit states and a null progress result.

POST `/api/v1/goals/:id/numeric-events` with a stable `key`, numeric `value` and
millisecond `observedAt`. Only the goal's authorized human can publish these
observations. Identical replay preserves the original observation; changed reuse
refuses. The latest observation time wins over arrival order. No external
provider adapter is implied.

GET `/api/v1/goals/:id` returns progress, units, calculation, freshness, visible
links, observations, check-ins and a revision `token`. POST `/checkins` with that
`revision` and a `note`; optional `percent` records manual progress or an explicit
attributed override, and `clearOverride: true` removes an override. Overrides do
not turn missing, stale or restricted inputs into success. A changed preview
refuses the check-in. GET `/api/v1/goals` lists only goals the caller may read.
