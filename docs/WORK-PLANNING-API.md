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

Interim authority (ct-ruled 22 Oct 2026): a workspace owner or administrator who
does not own the task, and has not owned it since its previous decision, decides
non-personal approval tasks. Its requester may decide. Agents and approve-scoped
grants cannot decide yet (named approvers and stages are PEG-036). The preview
returns `canDecide` and, when false, a `waiting` reason that names no one:
`personal_share_required` (a personal approval task waits for a reviewed share),
`you_own_or_owned_this`, `another_decider_needed` or `administrator_required`;
`anotherDeciderNeeded` is true when no eligible administrator exists, so the task
stays pending. Nothing approves automatically. No notification or external
action is part of this door.

## Goals

POST `/api/v1/goals` with `title`, `scope` (`company`, `team`, `personal`),
`teamId` for team scope, `kind` (`objective`, `key_result`), `periodStart`,
`periodEnd`, `mode` (`manual`, `work`, `numeric`), `unit`, `baseline`, `target`
and `staleAfterSeconds`. The goal retains its owner and period. Personal goals
are owner-only. Interim access (ct-ruled 22 Oct 2026): company/team goals are
created, linked and managed by workspace owners/admins; their named `ownerId`
must be an active internal human (owner, administrator, manager or member, never
an agent, guest or analyst) and may read the goal, check in and record numeric
observations. Agents and guests cannot read, create or update goals.

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


## Reviewed recurring audiences

`POST /api/v1/recurrences/preview` accepts `grantIds` from the source project's current internal grants. The response names the standing team/workspace default levels, chosen internal grants, and assignees who cannot open their work. Repeat those inputs and the returned `revision` token at `POST /api/v1/recurrences`. Activation records this standing share for later occurrences. Guest, approve-only and external shares always require a fresh reviewed share on each occurrence. Assignment never grants access.

Each run rechecks current source and pinned-target authority, delegation levels, grantee standing and the recorded audience revision before its single occurrence transaction. A changed audience or lost authority holds the schedule with `last_error` and its accountable activator; held schedules leave automatic retries until re-reviewed. Existing project schedules without a recorded audience also require review. `/app/recurrences` provides the preview, activation, occurrences and oversight screens. Workspace administrators and project Admins may see and stop schedules on their targets even when they did not activate them. A former activator can see the held cause without receiving newly restricted source content.

Re-review through `POST /api/v1/recurrences/:id/audience-preview`, then repeat the chosen `grantIds` and returned token at `POST /api/v1/recurrences/:id/audience`. Stop through `POST /api/v1/recurrences/:id/stop`. Only the activator runs or re-reviews; administrators may stop. Automatic scheduling rotates waiting work behind unattempted work.


## Goal visibility and accountable owners

`/app/goals` offers company, team and personal goals, permitted links, observations, check-ins and reviewed ownership/sharing. New company goals default to active internal workspace readers; team goals use current team read access. Existing goals retain their ct-approved restricted audience until a manager reviews a change. Personal goals remain private until their owner previews and confirms a named internal audience. Workspace administrators have no ordinary read of personal goals.

Company goals are managed by workspace owners/administrators. Team Admins and the existing workspace manager role (which covers all teams in its workspace) also manage team goals. Personal owners manage their own goals. Management does not itself grant check-in or observation authority: the accountable owner and named editors contribute. Company/team owners must be active internal humans other than agents, guests and analysts. Membership, role and account changes cannot abandon an owned goal; reviewed owner transfer is required first. PEG-032 inherits this invariant when it adds offboarding doors. Guests and agents receive no goal access through these internal sharing doors; future PEG-019/062 doors must retain their reviewed scopes and never grant contribution authority.

`POST /api/v1/goals/:id/audience-preview` accepts a replacement `{ownerId, visibility, people, teams, editors}` plan (`visibility` is `default` or `restricted`; personal goals stay `restricted`). Its preview lists new readers, check-in notes and linked titles they could newly read. Confirm the exact plan and returned `revision` at `POST /api/v1/goals/:id/audience`. Omitting audience lists clears them. `GET /api/v1/goals/:id/audience` is manager-only. Source reads remain independently authorized for each reader; a restricted input yields null progress, source count and freshness, hides its title/owner, and invalidates a check-in opened before revocation. Numeric observations still come from native signed-in humans; external numeric sources remain PEG-014's gap.
