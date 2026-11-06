# Exhaustive test and journey mapping

Before: 18 push jobs. After: 8 push jobs, at most 3 concurrent isolated lanes per job.

Selected test leaves: 126 before / 126 after. Browser journey selectors: 35 / 35. Additional executable test files: 3 / 3. Every row occurs exactly once in each full run.

| Test / journey | Before | After |
| --- | --- | --- |
| journey :: access-discovery | journeys-core-access | custody-access/journeys-core-access |
| journey :: access-privacy | journeys-core-access | custody-access/journeys-core-access |
| journey :: analytics | journeys-services-work | extensions-services/journeys-services-work |
| journey :: approval-followup | journeys-core-access | custody-access/journeys-core-access |
| journey :: approval-routing | journeys-core-access | custody-access/journeys-core-access |
| journey :: approvals | journeys-core-work | reporting-work/journeys-core-work |
| journey :: bundles | journeys-planning-work | time-planning/journeys-planning-work |
| journey :: calendar-blocks | journeys-services | custody-recovery/journeys-services |
| journey :: canvas | journeys-planning-capacity | core-capacity/journeys-planning-capacity |
| journey :: capacity | journeys-planning-capacity | core-capacity/journeys-planning-capacity |
| journey :: core | journeys-core-work | reporting-work/journeys-core-work |
| journey :: custody | journeys-services-work | extensions-services/journeys-services-work |
| journey :: departure | journeys-services-work | extensions-services/journeys-services-work |
| journey :: engineering | journeys-services-work | extensions-services/journeys-services-work |
| journey :: goals | journeys-planning-work | time-planning/journeys-planning-work |
| journey :: guests | journeys-core-access | custody-access/journeys-core-access |
| journey :: intake | journeys-core-access | custody-access/journeys-core-access |
| journey :: intake-decisions | journeys-core-access | custody-access/journeys-core-access |
| journey :: intake-erasure | journeys-services | custody-recovery/journeys-services |
| journey :: meetings | journeys-services-work | extensions-services/journeys-services-work |
| journey :: pdf-feedback | journeys-core-work | reporting-work/journeys-core-work |
| journey :: portfolio | journeys-planning-work | time-planning/journeys-planning-work |
| journey :: portfolio-capacity | journeys-planning-capacity | core-capacity/journeys-planning-capacity |
| journey :: provider-log-retention | journeys-services-work | extensions-services/journeys-services-work |
| journey :: public-api | journeys-core-access | custody-access/journeys-core-access |
| journey :: recovery | journeys-services | custody-recovery/journeys-services |
| journey :: recurrence | journeys-core-work | reporting-work/journeys-core-work |
| journey :: register | journeys-planning-work | time-planning/journeys-planning-work |
| journey :: reporting | journeys-services | custody-recovery/journeys-services |
| journey :: retained-pdf-review | journeys-core-work | reporting-work/journeys-core-work |
| journey :: rule-audit | journeys-services | custody-recovery/journeys-services |
| journey :: search-bulk | journeys-services-work | extensions-services/journeys-services-work |
| journey :: time-packets | journeys-core-work | reporting-work/journeys-core-work |
| journey :: timeline | journeys-planning-work | time-planning/journeys-planning-work |
| journey :: work-views | journeys-planning-capacity | core-capacity/journeys-planning-capacity |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle applies a change of permission to an open tab at once and records it | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle decides blind portfolio requests as viewer membership without project authority | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle enforces the role matrix at every door | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle gives one person Viewer on A and Editor on B, and follows a team grant as it is granted and revoked | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle holds workspace policy, scoped grants and file rights at the doors | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle keeps one workspace invisible to another’s people | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle refuses to remove the last owner and never leaks a private field through an aggregate | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-020 roles, grants and the decision lifecycle walks every access-request path to a grant or to nothing, with exact audit rows | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: PEG-032 reviewed departure preserves work and revokes authority requires a current complete review, transfers responsibilities, stops delegated work and preserves human authorship | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: Scoped guest work keeps scoped comments private, exact guest roles limited and old file links revoked | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: Scoped guest work lets a guest Editor assign only shared participants, complete work and submit assigned time | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: Scoped guest work requires fresh guest review after changed content, proposals, expiry or authority, including restart and concurrent confirmation | access-control | runtime-source/access-control |
| tests/access-control.test.mjs :: Scoped guest work reviews initial guest access without granting, commits exact roles once, and retains decisions after revocation | access-control | runtime-source/access-control |
| tests/journeys/conversions.mjs | runtime | runtime-source/runtime |
| tests/journeys/templates.mjs | runtime | runtime-source/runtime |
| tests/portfolios.test.mjs :: Activated rule effect recovery records activated date and assignment effects once and undoes only unchanged fields with current authority | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Capacity across committed work compares a staffing scenario across three projects, retains hidden hours without titles, and applies only an exact current human reassignment | runtime | runtime-source/runtime |
| tests/portfolios.test.mjs :: Capacity across committed work reviews Split, Sum and per-assignee source effort without changing the task estimate or duplicating multi-homed work, and holds missing semantics for repair | runtime | runtime-source/runtime |
| tests/portfolios.test.mjs :: Capacity across committed work uses self-declared full and partial days, unions approved source leave, hides reasons, and refuses unavailable authority or stale feeds | runtime | runtime-source/runtime |
| tests/portfolios.test.mjs :: Conditional local work rules activates form and section date mappings once through restart and preserves a later edit during scoped undo | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Conditional local work rules applies the complete work-action set once, undoes its own effects and refuses approval decisions or expanded audiences | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Conditional local work rules computes event-relative weeks, business days and clamped months across holiday and daylight-saving boundaries | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Conditional local work rules exports rules without active authority and erases source inputs and project suggestions through reviewed custody doors | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Conditional local work rules refuses editor configuration, stale activation, revoked Admins and agent provenance; holds dependency changes and records missing dates | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Delivery register carries an accountable dependency risk through rejected and accepted changes into linked work and the existing portfolio status | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Delivery register refuses stale changes and agents, and filters records against current linked-work access | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Owned rule work action recovery runs all six owned actions once and preserves later work and reintroduced relationships during scoped undo | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: PEG-013 portfolios that roll up truthfully flags each default threshold independently at a pinned clock, explains it with source rows and recalculates when resolved or the policy changes | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: PEG-013 portfolios that roll up truthfully moves rollups when a blocker or completion changes through Tasks, with source drill-down | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: PEG-013 portfolios that roll up truthfully rolls up a two-level portfolio of 20 projects, counts shared tasks once and hides a private project from a stakeholder | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: PEG-013 portfolios that roll up truthfully shows timeline, workload and dashboard tabs for the nested portfolio with saved filters and no leakage | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: PEG-013 portfolios that roll up truthfully treats inherited drill metrics like unknown names for a signed-in member | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Pinned template rules through current Admin review applies activated pinned template dates and assignments before responding, with durable once-only runs and no recursive generation | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Pinned template rules through current Admin review holds a changed template or mapping until exact reactivation and rechecks the activating administrator before execution | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Reusable templates through reviewed public doors captures task and project structures as scoped reusable templates and separately activates retained rules | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reusable templates through reviewed public doors holds an agent-selected template and date for exact human review and refuses changed choices, replay after revocation and unauthorized settings | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reusable templates through reviewed public doors instantiates every gallery family with reviewed working dates, nested work, owners, fields, dependencies, pending approvals and inactive rules | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reusable templates through reviewed public doors requires an explicit missing-role choice and applies a new template version only after review while retaining human edits | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reusable workflow bundles applies all five bundle component types to three projects and runs their real fields, saved view, task template, rule and human approval stages | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reusable workflow bundles previews upgrades, preserves local overrides and unchosen changes, refuses incompatible and stale adoption, and cancels obsolete queued actions on disable | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Reviewed stakeholder status revisions keeps three-project drafts separate, refuses stale sources and changed reviews, and publishes exact content once with honest channel outcomes | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Reviewed stakeholder status revisions requires current human authority and exact client recipients, excludes private sources and keeps a separate client draft unpublished | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Reviewed stakeholder status revisions retains immutable corrections and revision-bound member and guest threads while hiding internal replies and refusing revoked access | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Selective configuration revision recovery compares and restores a retained component without replacing newer configuration, activated rules or dependent work | portfolios | planning-services/portfolios |
| tests/portfolios.test.mjs :: Status rights request custody accepts a departed attributed actor request without reactivating membership or exposing their snapshots | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Status rights request custody escalates acknowledgment and disposition independently at a pinned clock and refuses indefinite or unsupported outcomes | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Status rights request custody records justified finite retention separately, requires timely permitted extension and revokes a former handler | workflow-rules | planning-services/workflow-rules |
| tests/portfolios.test.mjs :: Status rights request custody tracks the exact structured copies and finite delegated custody without granting browsing or false erasure | workflow-rules | planning-services/workflow-rules |
| tests/runtime.mjs | runtime | runtime-source/runtime |
| tests/schedule.test.mjs :: PEG-004 dependencies and believable schedules computes exact branching slack, negative lead and milestone dates and refuses an impossible completed-dependent cascade atomically | source | runtime-source/source |
| tests/schedule.test.mjs :: PEG-004 dependencies and believable schedules holds a set that reaches work the editor cannot see for its approver, without disclosing it or applying part of it | source | runtime-source/source |
| tests/schedule.test.mjs :: PEG-004 dependencies and believable schedules lets a project editor confirm a previewed set once, attributed to them, with undo and no second approval; a viewer and an agent cannot shift anything | source | runtime-source/source |
| tests/schedule.test.mjs :: PEG-004 dependencies and believable schedules previews and applies all four dependency types over the July 4 holiday and a weekend, then a daylight-saving change, with the chain explained | source | runtime-source/source |
| tests/schedule.test.mjs :: PEG-004 dependencies and believable schedules refuses a cycle and a stale plan and leaves every downstream date untouched | source | runtime-source/source |
| tests/work-graph.test.mjs :: Analyst exports denies analyst scope escalation and fences cached work after movement or credential expiry | work-graph-reporting | reporting-work/work-graph-analyst |
| tests/work-graph.test.mjs :: Analyst exports keeps analyst credentials and cached export payloads out of native archives | work-graph-reporting | reporting-work/work-graph-analyst |
| tests/work-graph.test.mjs :: Analyst exports reconciles reviewed portfolio, goal, request and approval datasets with local scheduled reports | work-graph-reporting | reporting-work/work-graph-analyst |
| tests/work-graph.test.mjs :: Analyst exports reconciles scoped analyst snapshots and incremental removals across three projects | work-graph-reporting | reporting-work/work-graph-analyst |
| tests/work-graph.test.mjs :: Approval routing custody refuses routing and sharing proof bytes from an unreadable project context | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Approval routing custody requires quorum on an approval task, refuses current and prior owners and agents, and never lets the old decision door bypass named capability checks | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Approval routing custody routes ordered proof stages with independent named humans, delegates, and binds expiring revoked links to the exact replacement bytes | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Approval routing custody sends a reviewed PDF-v2 reminder once through the mail seam without comments or an implicit approval and respects muted preferences | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Data custody PDF feedback reconciles native archive feedback, exact person erasure, holds and proof-group expiry | work-graph-extensions | extensions-services/work-graph-pdf-custody |
| tests/work-graph.test.mjs :: Data custody anonymizes an erased inactive actor without losing the permanent audit chain | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody cleans expired local authentication separately from held work retention | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody expires only reviewed eligible stores while keeping held content and independent class policies | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody expires proof versions together only after every version is eligible and no proof hold remains | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody fences scoped agent output custody on processor revocation, retention holds and replay after expiry | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody intake erasure reviews exact intake redactions, retains replay witnesses and fences holds, concurrent changes and native archive restoration | work-graph-custody-erasure | custody-access/work-graph-custody-erasure |
| tests/work-graph.test.mjs :: Data custody keeps permanent audit redacted and append-only across public changes, searches and exports | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody pins actual proof bytes and accepts only a current independent human decision | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody preserves permanent audit through native archive restore and refuses an old archive with the later erasure journal | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Data custody provider diagnostics expires exact reviewed superseded diagnostics while preserving delivery witnesses, authority and native recovery | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: Data custody reviews graph erasure, honors holds and stale previews, and retains only disclosed shared work | work-graph-custody-recovery | custody-recovery/work-graph-custody-recovery |
| tests/work-graph.test.mjs :: Direct project duplication through reviewed public doors duplicates only selected work with fresh identities and provenance, concrete original or relative dates, and no copied approvals, private context or active authority | work-graph-extensions | extensions-services/work-graph-extensions |
| tests/work-graph.test.mjs :: Direct project duplication through reviewed public doors preserves approve-only, restricted and assignee memberships when their staged grants are explicitly activated | work-graph-extensions | extensions-services/work-graph-extensions |
| tests/work-graph.test.mjs :: Direct project duplication through reviewed public doors refuses detached children, stale previews and revoked source membership at copy and activation time | work-graph-extensions | extensions-services/work-graph-extensions |
| tests/work-graph.test.mjs :: Engineering handoff denies unapproved source capture, foreign writes, private context and stale reviewed returns | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Engineering handoff reconciles mapped issues at all three official boundaries without satisfying business acceptance | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability authorizes a single-goal numeric integration without a session, fences its sponsor and revocation, and never grants a data read | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability lets a named company-goal owner check in and record observations, refuses agent, guest and analyst owners and never yields progress from an override over a flagged input | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability previews personal goal notes and permitted titles before sharing, revokes ordinary manager access and fences check-ins without hidden source metadata | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability reads company defaults and current team goals, restricts named audiences and gives team Admins and managers only their goal management authority | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability reviews a documented numeric CSV atomically, reconciles keyed replays and changed rows, and preserves stale observation times | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability reviews company goal ownership and editors, permits their observations and check-ins, and refuses invalid or stale authority | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Goal visibility and accountability tracks company, team and personal goals with weighted deduplicated execution, numeric freshness and attributed overrides | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Meeting review imports authorized provider transcript exports and adopts each resolved cited action once | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Meeting review reads all three official provider boundaries and clears revoked source context | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Meeting review requires capture consent and source authority, fences changed exports and keeps context private after restart | work-graph-services | planning-services/work-graph-services |
| tests/work-graph.test.mjs :: Native approval follow-up cancels obsolete follow-up and refuses hidden, revoked, deactivated and muted recipients without reviving old episodes | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Native approval follow-up routes finite internal follow-up through working hours, DND, queued delegation, restart and a real decision | work-graph-time | time-planning/work-graph-decisions |
| tests/work-graph.test.mjs :: Native intake decisions records reviewed human priority and disposition once, refuses unsafe authority and preserves exact custody | work-graph-core | core-capacity/work-graph-intake |
| tests/work-graph.test.mjs :: Native reporting reconciles dashboard history, real downloads and revoked access across three projects | work-graph-reporting | reporting-work/work-graph-reporting |
| tests/work-graph.test.mjs :: Native text intake publishes branching intake, creates one attributable task after replay and restart, and refuses unsafe submissions | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph builds a campaign and a launch project, multi-homes one task and keeps one history | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph creates all typed fields, shared identities and consistent task/report/API calculations | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph enforces Viewer values and tagging denial and Editor definition denial on every field/status door | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph explains cycles, missing and hidden inputs and refuses lossy or stale type changes | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph keeps a personal task private and resolves every reference a task has had, to those allowed only | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph keeps free-form campaign tags distinct, renames once and filters three projects without hidden counts | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph keeps personal work and sections owner-only through lists, ID search, reads and writes | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph orders the local day by group, due instant, priority, creation time and immutable ID | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph persists manual section/task ranks on reconnect and logs reversible deduplicated section rules | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph runs the PEG-083 public-team join and private-link request journeys on this graph | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph shares personal work only against the reviewed current project audience and content | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-001 one work graph shows a guest on one project nothing of the other, through the API, exports and files | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: PEG-064 retained graph recovery repairs only reviewed dangling dependencies while preserving live links and refusing a stale repair | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: PEG-064 retained graph recovery restores a shared field revision as new history while retaining later values and refusing incompatible or stale restoration | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: PEG-064 retained graph recovery restores retained project, task and proof graphs while fencing stale review and erased content | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: PEG-064 retained graph recovery restores standalone attachment bytes and scope while fencing stale review, proof reuse and erasure | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: PEG-064 retained graph recovery undoes unchanged bulk effects while preserving later human fields and independent approvals | work-graph-custody-recovery | custody-recovery/work-graph-recovery |
| tests/work-graph.test.mjs :: Project planning canvas collaborates on a planning canvas and promotes a reviewed note once into the native List task | work-graph-reporting | reporting-work/work-graph-reporting |
| tests/work-graph.test.mjs :: Project planning canvas restores exported canvas relationships and native task identity through the installation archive | work-graph-reporting | reporting-work/work-graph-reporting |
| tests/work-graph.test.mjs :: Retained PDF feedback renders retained PDF contents, pins exact identities and refuses stale, hidden and unauthorized feedback | work-graph-core | core-capacity/work-graph-intake |
| tests/work-graph.test.mjs :: Search and reviewed bulk selection finds authorized content, saves filters, reviews every mixed-permission row and preserves later work on undo | work-graph-core | core-capacity/work-graph-intake |
| tests/work-graph.test.mjs :: Test worker lifecycle recovers from an occupied startup port with colored logs, leaves its listener alone and keeps the new origin through restart | work-graph-core | core-capacity/work-graph-core |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions attributes approval-task decisions to the reviewed revision and refuses copied, stale, self and agent sign-off | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions attributes every existing sign-off reopening door to its writer without inventing a reopen for a no-op | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions fences stale time review and keeps private no-project work out of ordinary administrator review | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions holds changed recurring audiences and lost authority without sharing, retains oversight and requires a fresh reviewed audience | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions keeps one durable timer per person and reconnects without duplicate intent or entries | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions never lets an approval task's owner, former owner or an approve-only grant decide it, says why it waits and notifies no one | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions pins recurring work templates and generates one occurrence across restart, DST, exceptions and concurrent runners | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions prepares approved time service packets and reconciles official-schema readbacks without sending | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions reviews one standing internal recurring audience, names unreachable assignees and applies it once across restart and replay | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions reviews whole sheets with delegated authority, refuses stale grants and withdraws unavailable returned entries without disclosure | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions sends reviewed approved time once to each official-schema time service, repairs a rejected job code, reads back a lost response and corrects exactly | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions submits, returns, corrects and locks an exact timesheet, retaining attributed later adjustments and exact CSV | work-graph-time | time-planning/work-graph-time |
| tests/work-graph.test.mjs :: Work planning time, recurrence and decisions writes a recurring task only into projects where its activator still holds authority | work-graph-time | time-planning/work-graph-time |

## Commands and non-test checks

| Command | Before | After |
| --- | --- | --- |
| `pnpm run test:graph:schedule` | 1 | 1 |
| `pnpm run check --profile first-party` | 1 | 1 |
| `node scripts/contract-docs.mjs check PEG-128 PEG-011 PEG-059 PEG-057 PEG-007 PEG-078 PEG-003 PEG-018 PEG-031 PEG-027 PEG-015 PEG-036 PEG-012 PEG-016 PEG-044 PEG-025 PEG-127 PEG-037 PEG-066` | 1 | 1 |
| `pnpm run build` | 2 | 1 |
| `pnpm run test:runtime` | 1 | 1 |
| `pnpm run test:graph:capacity` | 1 | 1 |
| `pnpm run typecheck` | 1 | 1 |
| `pnpm run test:templates` | 1 | 1 |
| `pnpm run test:conversions` | 1 | 1 |
| `pnpm exec rer queue test:work-graph-extensions -- sh -c "node --test --test-name-pattern='^(?:Direct project duplication through reviewed public doors\|Public API and MCP\|Work conversions through reviewed public doors)(?: \|$)' tests/work-graph.test.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:pdf-feedback -- sh -c "node --test --test-name-pattern='^Data custody PDF feedback(?: \|$)' tests/work-graph.test.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:work-graph-custody-recovery -- sh -c "node --test --test-name-pattern='^(?:Data custody\|PEG-064 retained graph recovery)(?: \|$)' --test-skip-pattern='^(?:Data custody intake erasure\|Data custody PDF feedback)(?: \|$)' tests/work-graph.test.mjs"` | 1 | 0 |
| `pnpm exec rer queue test:work-graph-custody-erasure -- sh -c "node --test --test-name-pattern='^(?:Data custody intake erasure\|Local rule audit attributes background)(?: \|$)' tests/work-graph.test.mjs"` | 1 | 0 |
| `pnpm exec rer queue test:work-graph-services -- sh -c "node --test --test-name-pattern='^(?:Goal visibility and accountability\|Engineering handoff\|Meeting review)(?: \|$)' tests/work-graph.test.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:work-graph-reporting -- sh -c "node --test --test-name-pattern='^(?:Native reporting\|Analyst exports\|Project planning canvas)(?: \|$)' tests/work-graph.test.mjs"` | 1 | 0 |
| `pnpm run test:graph:access-control` | 1 | 1 |
| `pnpm run test:graph:portfolios:core` | 1 | 1 |
| `pnpm run test:graph:workflow-rules` | 1 | 1 |
| `pnpm exec rer queue test:journeys-core-access -- sh -c "PEGBOARD_JOURNEY=intake-decisions,approval-followup,intake,access-privacy,access-discovery,public-api,approval-routing,guests node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:journeys-core-work -- sh -c "PEGBOARD_JOURNEY=retained-pdf-review,pdf-feedback,core,recurrence,approvals,time-packets node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:journeys-services -- sh -c "PEGBOARD_JOURNEY=intake-erasure,rule-audit,reporting,calendar-blocks,recovery node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:journeys-services-work -- sh -c "PEGBOARD_JOURNEY=search-bulk,analytics,engineering,meetings,custody,provider-log-retention,departure node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:journeys-planning-capacity -- sh -c "PEGBOARD_JOURNEY=portfolio-capacity,capacity,canvas,work-views node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |
| `pnpm exec rer queue test:journeys-planning-work -- sh -c "PEGBOARD_JOURNEY=portfolio,timeline,register,bundles,goals node tests/journeys/work-graph.journey.mjs"` | 1 | 1 |

Core: Test worker lifecycle, PEG-001, Work views and Native text intake suites vs the original selector with those four excluded. Time: Work planning suite vs the other three original suite prefixes. Recovery is split into Data custody versus diagnostics and retained graph recovery; intake erasure versus background rule audit; reporting/canvas versus Analyst exports; and the separate PDF-custody command moves intact into its own lane. All selector splits are disjoint complements of the prior selectors. No assertion or test file changed. The only removed non-test command is the second identical production build. Hosted output/hydration remain once in runtime-source; typecheck, first-party check and generated contract check remain unchanged. Nightly remains empty.
