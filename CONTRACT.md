# Pegboard target product contract

Target edition: **20 October 2026**, expanded for buyer reviews 1, 2, 3, 4, 5, 6 and 7. Pegboard is the complete work and project management product being built for business teams. A switching buyer brings active projects, history, files and permissions with them, connects their existing services and continues work without a silent loss of context. Agents do coordination and first drafts and show their sources, each acting for a named person under the company’s own policy, while people stay accountable for the business’s decisions.

## Product target

| | |
| --- | --- |
| Category | Work and project management for business teams |
| Incumbents a buyer switches from | Established work and project-management products; adjacent alternatives include scheduling and project-planning tools |
| First buyer | US head of marketing, operations lead or agency delivery lead at a 20–500-person company or agency, coordinating staff and outside clients in USD across US timezones |

The primary journey: a team takes requests in, turns an accepted brief into an executable project, assigns real owners and dates, coordinates dependencies and capacity, produces and reviews deliverables, obtains version-specific human approvals, and reports honestly to stakeholders against goals.

## How to read this contract

- This follows the RER contract standard. It is a destination contract, not a description of shipped functionality: Core is what a buyer switching from the named incumbents uses in the first week, plus the push-further work; the Agent surface and Later are reported on their own lines.
- Done means every acceptance point passes through Pegboard's own doors (product routes, the documented API and MCP door, installed clients, provider sandboxes or official-schema edges, seeded runs) in a recorded Verify run; the Status table records the evidence and the gaps.
- Door rules D-1 to D-13 are stated once below; a clause that lists them proves them at its own door. Real-world proof Pegboard cannot produce in its own repository is in the Field proof register and never blocks done.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file. Rulings are in RULINGS.md, history in CHANGELOG.md, and mechanism in docs/ (`docs/contract/as-built.md` records how the done clauses are built).
- Two test policies name the agent journeys: Base's held policy (standard calls reviewed, every other class approved by the test person) and the schedule-approval policy (standard calls that change other people's dates or assignments wait for a named eligible person's approval). Neither is a default; the company's own policy decides every agent call.

## Door rules

- **D-1.** Doors and screens. Journeys use the actual deployed Cloudflare/Base product: its authenticated browser routes, versioned public API, installed mobile clients or documented import/CLI doors. Route names in prose are buyer-facing destinations to implement, not claims of existing paths. Every browser journey runs at **1440 and 390 CSS pixels** with realistic US campaign, operations and agency data and keyboard access under Base’s accessibility bar (BASE-ACCESSIBILITY-001); a person’s visual inspection of the journeys is register row R-1. A phone-width web view does not prove native mobile support.
- **D-2.** Provider edges. Provider tests use an authorized provider sandbox or a network-edge fake built from the provider’s current official request, response, event and error schemas. Fakes never replace Pegboard’s domain, permissions, persistence, queue or scheduling. A schema-fake result is labeled as such; provider app registration, consent and real-account qualification (register row R-3) are required before claiming a live integration. Delays, retries, quota limits, lost responses, revoked access, duplicates, concurrent edits and process restarts are exercised where relevant.
- **D-3.** Separate outcomes. Sending and provider acknowledgment never imply a human read, update, approval or completed deliverable, on any channel; BASE-MAIL-001 governs mail outcomes.
- **D-4.** Decisions that bind the business. A plan publication, a client or executive publication, a spend and a new outside-organization disclosure each bind their exact version: a person makes each in the product, and an agent’s call that makes one carries its commitment, external or money class, which the company’s policy decides; an agent’s or AI-produced change to other people’s dates is standard with the affected people as facts (D-8). A current Admin-reviewed deterministic rule activation under PEG-094 is already approval for its in-scope date and assignment actions, including dates set on newly created tasks; it does not need approval again on each run. The reviewed-share approval for ordinary system notices (D-6) is already human approval, not a per-message review requirement. These rules apply to every clause, and no rule grants an approval to itself.
- **D-5.** External and internal sends. An **external send** is disclosure to a person or destination outside the organization: clients, vendors, public pages, guest recipients or externally shared channels, even when the transport is the company’s Slack, Teams, Nook or mailbox. A company-only channel/person/mailbox is an internal destination, not external merely because its provider is SaaS. Internal task notifications, digests, reminders and rule posts follow the internal notification policy an owner sets, naming allowed audience, content/scope, cadence and channels, plus current recipient permissions and preferences; an agent’s internal post is standard, and the company’s policy decides it.
- **D-6.** Notices inside a reviewed share. A person’s reviewed guest invitation/share under PEG-019 is also approval for ordinary **system notices inside that share**: assignments, due-soon/overdue reminders, digests, comment/activity notices, proof/approval notices and reminders, and recipient-bound reply routes. These fixed system event templates deliver to that current guest’s own inbox, verified email, personal chat destination or device under the guest’s own channel/digest/follow/mute/DND preferences, like a member’s notices, without another approval. This applies when a rule or follow-up process triggers the ordinary notice, but never turns arbitrary text supplied by a rule or agent into a system notice. Every queued delivery rechecks the current recipient, share, record, field/comment/proof visibility and preferences; revoked/expired shares cancel queued notices and reply authority, and internal-only material is omitted from the payload and aggregate counts. An explicitly reviewed migration share adoption can supply the same approval; imported inactive shares alone cannot.
- **D-7.** What a share does not cover. The share does **not** cover agent-composed outbound messages (including a personalized chase to that same guest), client/executive status publications, posts or feeds to client-shared channels, new audiences or content outside the share: each is external with its recipients and counterparty, a person sending one reviews its exact recipients, content and version, and the company’s policy decides an agent’s call. Outside-share record content also requires a separately reviewed access/share change before delivery; a send approval alone never grants access. A changed or unknown audience is held for review and, for an agent’s call, is a new counterparty. Human approval of an invitation, share or reviewed update gives an agent no authority to change another person’s dates, activate a scheduling rule or approve a person’s work; deterministic rule authority comes only from PEG-094’s separate reviewed activation. The human composing/publishing an exact reviewed update or sending an invitation is the approving person for that action; there is no second approver unless configured by the organization.
- **D-8.** Date edits and the knock-on set. For a human date edit, the authorized editor sees the entire knock-on change set, including affected owners, dates, capacity and conflicts. Dragging and releasing after that visible preview, or pressing Apply in another date editor, is that person’s approval of the exact set; execution rechecks permission and record versions and records the editor. No second sign-off is needed. If any affected record is outside the editor’s grant, the proposal waits for its authorized approver without revealing hidden work. An agent’s or AI-produced date or assignment change affecting others is standard with the affected people as facts, and the company’s policy decides whether it applies alone or waits for a named person’s exact approval; a person’s own scheduling policy covers their unlocked blocks (PEG-069). A deterministic rule’s activated version can set, clear or shift start/due dates and assign in-scope new or existing tasks immediately under PEG-094’s reviewed scope, offset and calendar. Changed/inactive rule versions, out-of-scope cascades and effects outside the activating Admin’s current grant wait for an authorized approver; activation never covers AI or agent output and grants no new access. All reversible schedule changes retain PEG-064 undo.
- **D-9.** Outbound email. Every outbound email follows PEG-084’s authenticated sender, PEG-119’s qualified inbox delivery path, PEG-120’s address suppression and PEG-121’s provider-paced queue; BASE-MAIL-001 keeps provider acceptance distinct from actual Inbox receipt or a human response.
- **D-10.** Reviewed bulk invitations. Reviewed bulk invitations also require PEG-084’s current evaluated DMARC-passing mail identity, PEG-119’s advisory placement status and PEG-121’s capacity preflight; sending is paced with remaining/per-address outcomes and changed or suppressed recipients cannot bypass review.
- **D-11.** Whole-account migration bar. The whole-account obligation has PEG-081’s completeness/custody/cutover bar: a non-technical owner uses Settings → Migration and a saved browser guide with exact installation OAuth callback/scopes and sealed client configuration, never a CLI or copied personal/access token. Authorize the source account/workspace, enumerate all authorized active and archived work across every container and page, reconcile source visibility/access gaps explicitly, and obtain necessary source-owner authorizations rather than calling a partial account complete. Per-board/list manual exports cannot be the required normal path; optional account exports/supplements remain supported. Save preflight counts/byte estimates, source plan/quota assumptions, request volume, staging storage/cost, throughput and elapsed-time range. Durable background page/object/byte checkpoints survive interruption, lost pages and revoked/expired credentials repaired by browser reauthorization without duplicate work. Stream/digest at least 10 GB of actual source attachment bytes into PEG-091’s Base-registered owner R2 custody, track file bytes separately from metadata, reacquire expired source URLs under authorized source access, and expose/repair every missing or forbidden blob. No counter or URL substitutes for custody. Report actual requests/bytes/rates, throttled/retry time and total elapsed versus saved estimates. Across the complete account, require per-type IDs/counts, graph/file/permission/time fidelity, counted inert rebuild items, source/native concurrent deltas and PEG-054’s reviewed conflict-preserving rollback. Review bulk mapping/invitations for at least 85 members and 40 guests with exact scope/recipient/role and existing-local matches, one current human decision and one delivery per chosen row; changes invalidate that row, and unreviewed identities/shares never activate. Named accepted losses never become a lossless/completed-subset claim.
- **D-12.** Per-type migration fidelity. The same per-type fidelity checklist includes labels/tags, intake/form definitions, project briefs/Overview/key resources, project announcement/thread history, task templates, saved views/searches/reports/dashboards, personal organization and exact member/guest access levels where present in this source. Every item is migrated, translated or held inert with counted artifacts and an actionable rebuild path; absent source capability/data is labeled rather than invented.
- **D-13.** Multi-assignee workload. For multiple source assignees, the dry run retains every source person/ID and chooses one accountable Pegboard owner by a reviewed mapping (prefer an explicit source owner when available; otherwise the reviewer chooses), with remaining people as current-scope collaborators/effort participants, not silently unassigned or invited. Preserve source workload settings and each per-person duration: board-centric source Split divides effort as the source does, Sum attributes full effort to each participant, and workspace-and-list source explicit per-assignee estimates remain exact. Unavailable allocation settings/data are counted repair items requiring a reviewed choice and labeled changed semantics, never guessed source equivalence. Native PEG-016 allocation records and source-reference views reconcile person/week totals alongside one task identity; source/native differences are reported before cutover, not hidden by changing denominators. New collaborator/share authority remains staged under PEG-054.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | PEG-056 | not run |
| BASE-ACCESS-002 | Sessions | PEG-056 | not run |
| BASE-ACCESS-003 | Public endpoints | PEG-007 | not run |
| BASE-ACCESS-004 | Server-side authorisation | PEG-020 | not run |
| BASE-INPUT-001 | Validation | none | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | PEG-082, PEG-091 | not run |
| BASE-SECRET-001 | No leakage | none | not run |
| BASE-SECRET-002 | Startup | PEG-055 | not run |
| BASE-DATA-001 | Export and import | PEG-091, PEG-058 | not run |
| BASE-DATA-002 | Retention | PEG-065 | not run |
| BASE-DATA-003 | Erasure | PEG-099, PEG-057, PEG-059 | not run |
| BASE-DATA-004 | Outbound flows | none | not run |
| BASE-DATA-005 | Independence | none | not run |
| BASE-PUBLIC-001 | Privacy | PEG-007 | not run |
| BASE-PUBLIC-002 | Origins | none | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | PEG-063 | not run |
| BASE-OPS-002 | Migrations | PEG-055 | not run |
| BASE-OPS-003 | Idempotency | PEG-063 | not run |
| BASE-OPS-004 | Failure is visible | PEG-038, PEG-063 | not run |
| BASE-OPS-005 | Audit | PEG-057 | not run |
| BASE-ROLE-001 | Roles through every door | PEG-020 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | PEG-086, PEG-057 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | PEG-055, PEG-058, PEG-063 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | PEG-099, PEG-059, PEG-065 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | PEG-021, PEG-045 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | PEG-021, PEG-086, PEG-123, PEG-124 | not run |
| BASE-INSTALL-001 | Free self-host and removal | PEG-055 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | PEG-037, PEG-097, PEG-084, PEG-119 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | PEG-060 | not run |
| BASE-DOCS-001 | On-site docs from one contract | PEG-060 | not run |
| BASE-AGENT-001 | One MCP door per seed | PEG-027, SURFACE-001 | not run |
| BASE-AGENT-002 | The seed’s jobs are tools | PEG-027, SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-001 | not run |
| BASE-AGENT-004 | Business identity and short-lived tokens | PEG-027, PEG-062 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role | PEG-062, SURFACE-005 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005 | not run |
| BASE-AGENT-007 | The company’s policy decides | PEG-062, SURFACE-002, SURFACE-006 | not run |
| BASE-AGENT-008 | Truthful attribution | PEG-062, SURFACE-003, SURFACE-004 | not run |
| BASE-AGENT-009 | Every agent action is audited | PEG-062, SURFACE-006 | not run |
| BASE-AGENT-010 | Agents can follow changes | none | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | PEG-062, SURFACE-006 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | PEG-027 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-007 | not run |

## Published clauses

- `PEG-001`: *Tier:* Core

### Shared work graph

#### PEG-001 — One work graph

**Requirement.** Teams create workspaces, teams, projects, sections, tasks, nested subtasks and milestones with stable IDs, owners, collaborators, descriptions, priorities, start/due dates and statuses. A task belongs to several projects without becoming several records; project-specific sections and workflow mappings do not fork its history or double-count its effort. Cross-project membership never grants access to another project's private material. Tasks may also have no project and remain private under PEG-073. Configurable human-readable task references such as MKT-142 are unique within the installation, remain stable on moves/multi-homing and resolve historical aliases after a prefix change; they supplement immutable IDs and never weaken access checks. Team and project discovery and self-joining use PEG-083, and permission-safe refused-link requests use PEG-100; discovering an object never confers a stronger role than its configured default.

**Acceptance.**
1. In Projects, build a campaign and launch project, move a task and add it to both, complete a subtask and inspect one task ID, shared changes and one history in both views.
2. A guest on one project cannot discover the other's name, private fields or attachments through UI, API or exports.
3. Create a no-project personal task and a MKT-prefixed task, move/multi-home the latter and change its project prefix; old and current references find the same task for authorized users and reveal nothing to others.
4. Run PEG-083’s public-team join and team-project journey and PEG-100’s private-link request journey against the same multi-project graph.

## Target clauses

### Work model and planning

#### PEG-002 — Fields, statuses and shared definitions

*Tier:* Core

**Requirement.** Teams configure text, number, USD currency, date, people, single/multiple dropdown, checkbox, formula and relationship rollup fields, per-project status sets and a shared field library. Definitions carry units and permissions; formulas expose errors rather than plausible zeroes, detect dependency cycles and recompute consistently. A shared field keeps its identity across projects and reports; changing its type previews affected records and never silently drops values. Free-form tags are a separate work type from custom fields: a workspace tag catalog supports create/rename/color/archive, task multi-tagging and cross-project tag filters. Catalog names and tag counts are permission-filtered, including personal-task tags. Only project/team Admins change field/status definitions; Editors change permitted values.

**Acceptance.**
1. Create every field type through project settings, add one library field to three projects, edit inputs and compare formula/rollup results through task, report and API reads.
2. Try a cycle, hidden input and incompatible type change; see a safe explanation and no leaked input or lost data.
3. Create a campaign tag independent of a dropdown, tag work across three projects, rename it once and filter by the tag.
4. A Viewer cannot tag or edit values, an Editor cannot alter definitions, and a guest cannot enumerate internal/personal tags.

#### PEG-003 — Every work view on the same records

*Tier:* Core

**Requirement.** List, board, spreadsheet-style table, timeline/Gantt, calendar and workload show the same task graph. Save, name and share filters, grouping, sorting, visible columns and personal/team defaults without granting extra access. Inline edits and accessible alternatives to drag operations update all open views; date-only work and timed work remain distinct. Saved filters also drive list, board, table, calendar and timeline/Gantt across selected projects at team, portfolio and workspace scope, with workload across the same permitted commitments. Multi-project tasks appear once unless an explicitly labeled membership grouping is chosen; edits retain each home project’s field/status mapping. At PEG-023’s fixed dataset/network/device profiles, a remote committed authorized edit is painted in another open permitted view without reload at p95 at most 2 seconds, measured commit-to-paint over 100 events per profile; pending/offline conflicts and permission revocation remain explicit.

**Acceptance.**
1. Open a realistic project in all six views in two signed-in browsers, filter and group it, move a card and edit a due date in the table.
2. Observe identical persisted records without reload and restored saved views after sign-in; a shared-view recipient sees only permitted rows and fields.
3. Create a team-scope due-this-week view over 30 projects in list, board, table, calendar and timeline, including one hidden project and one multi-homed task.
4. Check exact permitted counts, move a card and edit a date, and observe the same single record in its home project and all saved views.
5. Sharing never grants access to the hidden project.
6. Measure 100 remote real edits on each fixed profile and compare commit-to-painted-value p95 with 2 seconds; hidden records never arrive, and an offline view is labeled stale rather than counted live.

#### PEG-004 — Dependencies and believable schedules

*Tier:* Core · *Rules:* D-8

**Requirement.** Finish-to-start, start-to-start, finish-to-finish and start-to-finish dependencies support explicit lag/lead, cross-project links, milestones, critical path/slack, working-day calendars and saved baselines. Scheduling explains the chain and proposed shifts, honors working hours, weekends, US federal holidays, time off and DST, detects cycles and exposes impossible constraints. A human editor confirms the previewed change set by the drag-and-drop or Apply gesture of D-8; its dependent shifts execute together without a second sign-off. An agent’s or AI-initiated shift affecting others carries the standard class with the affected people as its facts, and the company’s policy decides it (D-8, SURFACE-002); unactivated or out-of-scope rule shifts affecting others wait for a person to approve the exact set, and any stale or out-of-scope set refuses. Baselines remain historical when the current schedule changes. The preview is visible before commit on Timeline as well as list, board, calendar and task detail; the same schedule algorithm and permission checks serve every door. Deterministic PEG-094 rule activation approves only dependency effects inside its reviewed scope and the activating Admin’s current grant; outside cascades wait for their authorized approver and do not disclose private work. The default PEG-096 Ready to start notice follows the actual last-blocker completion transition without requiring a user-built rule or exposing private predecessors.

**Acceptance.**
1. Through Timeline, exercise all four dependency types, delay a predecessor over a US holiday/weekend and DST boundary, inspect the critical path and baseline variance, then approve the reviewed shift.
2. Reject a cycle and a stale plan; no unapproved downstream date changes occur.
3. Drag a predecessor as a project Editor after viewing the knock-on preview: dependants shift exactly once, attributed to that editor with undo and no second approval.
4. An agent without a grant to apply others’ schedule changes prepares its set: no date changes until a named eligible person approves the exact set, and the shift is then recorded as that person’s; a viewer or stale edit cannot shift any task.
5. Exercise PEG-094’s in-scope date propagation and out-of-scope hidden-dependant case, with immediate authorized effects only when coherent and no unauthorized partial schedule.
6. Run PEG-096’s two-blocker/concurrent completion and hidden-predecessor readiness cases on this same dependency graph.

#### PEG-005 — Recurring work and human decisions

*Tier:* Core

**Requirement.** Tasks and entire projects recur on calendar or completion schedules with a timezone, exceptions, end condition and preview. Recurrence preserves template references without copying approvals as new decisions and does not duplicate occurrences across restart or DST. Milestones and approval tasks are first-class types; approve, request changes and reject record the human, time, exact reviewed revision and reason. A workspace owner or administrator who does not own the approval task, and has not owned it since its previous decision, decides it against its exact current revision; a task whose only eligible decider owns or owned it stays pending and says why without naming anyone (RL-2).

**Acceptance.**
1. Complete a weekly recurring task and recur an onboarding project, restart during generation and inspect one next occurrence.
2. Through an approval task, request changes, revise and approve; historical decisions remain attributed and a copied or changed revision cannot inherit sign-off.

#### PEG-089 — Accountable recurring work

*Tier:* Core

**Requirement.** When a person activates a recurring project, they preview and record the internal audience every occurrence will receive: the source's team or workspace visibility with its default levels, and chosen internal direct and team grants. That recorded preview is the reviewed share decision for those grants on later occurrences, so no new approval is needed per occurrence. Each generation rechecks the activator's current authority to delegate each level, each grantee's current standing, the recorded audience revision, and authority over every project the occurrence will be written into. If any of these changed or can no longer be granted, the occurrence is held visibly for re-review, never generated with a different audience. Guests, guest and approve-only shares and external links are never carried to an occurrence; each needs a fresh reviewed share under PEG-019. The preview and each occurrence name every assignee who could not open their work, and assignment never grants access. Workspace administrators, and project Admins over a schedule's target, can see and stop it. A failed or held generation shows its cause and an accountable owner (PEG-063).

**Acceptance.**
1. Through the UI at 1440/390 and through the API, activate a monthly onboarding project whose source is team-visible, with a direct Editor and a guest share.
2. The occurrence reaches the team at its default level and the Editor, but not the guest, and an assignee without access is named in both the preview and the occurrence.
3. Revoke the activator's authority: the next occurrence is held with its cause and nothing is shared.
4. Restart and replay produce one occurrence with one audience.
5. Move a recurring task's source out of a project where the activator then loses authority; its next occurrence is held, not written there.
6. A project Admin who did not activate the schedule sees it and stops it.

#### PEG-006 — Useful reusable templates

*Tier:* Core

**Requirement.** Task and project templates capture phases, subtasks, fields, dependencies, rules, relative dates, role placeholders and required approvals. A gallery covers marketing campaigns, launches, client onboarding, events and content calendars. Instantiation previews the concrete work, dates, missing roles and capacity impact; source owners, client guests and secrets are not blindly copied. Template updates are versioned and do not rewrite live projects without a reviewed application. A direct Duplicate project flow, separate from templates, previews selectable tasks/subtasks, assignees, relative/original dates, rules and members. It creates new work IDs and retains source provenance, rechecks every copied membership, shows audience/date effects and leaves copied rules/sends/shares inactive until explicitly reviewed; prior proof approvals and private-task context do not become new decisions or shares. PEG-094’s reviewed deterministic rule activation can instantiate a pinned template with reviewed role mapping, scope and relative dates without a new per-run approval; copied rule definitions and prior proof/share decisions remain inactive unless separately authorized. A later template version or changed date/assignment mapping invalidates the activation that depended on it.

**Acceptance.**
1. Instantiate each gallery family through New project, choose start date and role mapping and inspect correct dates, owners, fields, dependency edges and rules.
2. Leave a role unresolved and require an explicit choice; updating the template leaves an existing project unchanged until reviewed.
3. Duplicate an active project with options first excluding members/rules and then selecting them; compare exact chosen work/assignees/dates, new IDs and source backlinks, review staged shares/rules and confirm no copied sign-off, duplicate notification or broadened visibility.
4. Instantiate a pinned template from an activated deterministic rule and inspect immediately applied new-task dates/assignments; change the template/mapping and keep the next run pending until the Admin reviews/reactivates.
5. An agent without a grant to apply templates prepares its template and date choice; nothing is created until a person applies the exact reviewed template and date.

#### PEG-087 — Convert work without losing its history

*Tier:* Core

**Requirement.** Authorized people preview task → project, project → task, subtask → top-level task and task → subtask conversions through ordinary work menus and the public API. The preview maps owner/collaborators, dates, fields, nested work, comments/files/proof versions, time, source aliases, dependency links, memberships and history, and shows target visibility/capacity changes and any unrepresentable settings. A task-to-project conversion creates one linked project, maps its subtasks into project work and keeps a stable resolvable source record/alias and historical evidence; project-to-task creates a linked parent task with chosen constituent work as subtasks or explicit retained links. Promotion/demotion preserves task identity where the type remains a task, rejects cycles/depth or permission conflicts and never leaves orphaned time/files/children. Nonrepresentable project-only configuration stays as counted linked inert source context with a repair path, never disappears. The person chooses/reviews visibility; conversion cannot expose private personal work, copy an old proof approval onto a different version, activate imported rules or turn an approval into ordinary completion. Recheck the exact source/target revisions and affected scope atomically; repeating the request yields the same conversion, and PEG-064 undo reverses only unchanged owned effects while preserving later native edits.

**Acceptance.**
1. At 1440/390 and through the API, convert an intake task with nested work, file/proof versions, comments, a time entry, dependency and source alias into a project, then convert a populated project into a task with reviewed nested-work mapping.
2. Resolve old links to the authorized survivor/linked record and reconcile all counts, authorship, durations, version digests and scopes.
3. Promote a subtask to a task and demote another task, retaining IDs/history and refusing a cycle, private-scope disclosure, stale preview and unauthorized target.
4. Keep unrepresentable rule/report settings visible as linked inert repair items; replay once without duplicates and undo after a human edit without deleting that edit or resurrecting old approvals.

#### PEG-031 — Find and safely change work at scale

*Tier:* Core

**Requirement.** Permission-aware global search covers tasks, projects, comments, briefs and authorized attachment metadata with filters, saved searches, favorites and recent work. Keyboard quick-add, shortcuts and multi-select support bulk assignment, status, dates, fields, movement, duplication and archive. Bulk review names affected records and skips none silently; stale or forbidden rows are reported, and undo preserves subsequent independent edits. Ordinary tasks can be marked duplicate or merged after a preview chooses the survivor and resolves conflicting fields, assignments, project memberships, dependencies and attachments. Source IDs/reference aliases redirect to the survivor without leaking its existence to outsiders; comments/time/history retain author/source provenance, one approved decision is never duplicated onto different content and merging grants no broader visibility. A stale or unauthorized merge refuses atomically, with conflict-preserving undo where reversible. At PEG-023’s fixed 10k-task/500-member profiles, search paints real permission-filtered results at p95 at most 1 second from submitted query over 100 cold and 100 warm searches per profile, including comments and empty-result queries; skeletons/cached hidden counts never satisfy it.

**Acceptance.**
1. Find an old approval by comment text, save its filtered view, then bulk-change a mixed-permission, concurrently edited task selection through the UI.
2. Inspect exact per-row outcomes, undo unchanged effects and retain later edits; hidden records never appear in search suggestions, counts, API or downloads.
3. Mark and merge two ordinary tasks with conflicting owners and fields, a dependency and separate comments/time entries.
4. Inspect the chosen survivor, one conserved history/time total and safe alias redirects; concurrent edits force re-review and a private-task merge cannot expose either task or its fields.
5. Run the stated cold/warm searches on both fixed profiles, measure query-submit-to-painted-results p95 against 1 second and compare exact permitted result IDs after revocation, with no loading skeleton or hidden-row cache shortcut.

#### PEG-033 — Visual business-work planning

*Tier:* Core

**Requirement.** Teams use task-linked mind maps and a collaborative planning canvas to arrange phases, notes and relationships, promote a planning item into a real task and see its current owner/status. Moving a representation does not clone a task or approve dates. Canvas content and exports follow project permissions and remain portable; project planning is not an unrestricted database or knowledge-base product.

**Acceptance.**
1. In a project planning canvas, two members rearrange a mind map, create a task from a note and edit that task in List.
2. The canvas reflects one task ID and state, exported content restores, and a guest cannot see internal-only notes.

#### PEG-034 — Reusable workflow bundles

*Tier:* Core

**Requirement.** An administrator versions a bundle of fields, views, rules, templates and approval stages, applies it to selected projects and previews subsequent changes with conflicts and local overrides. Adoption preserves existing work and decisions; disabling a bundle stops future actions without deleting history.

**Acceptance.**
1. Apply a campaign bundle to three projects, locally modify one rule, then preview a new version.
2. Adopt only chosen compatible changes, preserve the override and work history, and disable the bundle during queued work without executing an obsolete action.

#### PEG-035 — Risks, decisions and change requests

*Tier:* Core

**Requirement.** Projects keep an accountable register of delivery risks, blockers, assumptions, decisions and scope/date change requests linked to tasks and milestones. Each has owner, impact, next action and review date; accepted changes record the human decision and preserve the original baseline. These are business delivery records, with engineering issues linked to Vector rather than recreated.

**Acceptance.**
1. In a project, raise a dependency risk, assign mitigation and propose a scope/date change.
2. Require the right human to accept it, retain its rejected alternative and original baseline, and trace the risk into the portfolio update and linked work.

### Intake and collaboration

#### PEG-007 — Request intake and triage

*Tier:* Core · *Cites:* BASE-ACCESS-003, BASE-PUBLIC-001

**Requirement.** Public and internal branching work-request forms support required fields, attachments, safe validation, acknowledgments and mappings to task fields and templates. Submissions enter a permission-scoped queue with routing, duplicate candidates, owner, priority and triage deadline; business-hour SLA clocks pause only under explicit policy. Abuse controls protect public intake and never expose internal project data. Pencil responses use the same intake door. Every intake attachment uses PEG-082’s 25-MB-per-file/75-MB-per-submission preflight and PEG-091’s resumable transfer and owned custody. A fixed intake assignment/date policy reviewed and activated by its Admin under PEG-094 assigns and dates new matching tasks immediately; it does not require the designer to approve each request’s due date. AI-generated routing and date choices carry the standard class with the affected people as facts, and the company’s policy decides them (SURFACE-002).

**Acceptance.**
1. Submit branching internal and public forms and a signed Pencil response, including an attachment and duplicate source ID.
2. Inspect one mapped task, acknowledgment and triage clock; advance beyond its deadline to flag/escalate it, and reject malformed, abusive or forged submissions without leaking private fields.
3. Run PEG-082’s exact-boundary and one-byte-over form cases from public and internal intake without private-field leaks or partial submitted attachments.
4. Submit PEG-094’s ten form requests, compare exact five-business-day due dates and fixed designer assignments without pending per-run approval, and distinguish an AI-proposed assignment and date that, under the schedule-approval policy, waits for approval.

#### PEG-082 — Attachment limits and pre-transfer checks

*Tier:* Core · *Cites:* BASE-INPUT-003

**Requirement.** Task and comment attachments, proof revisions, guest-portal uploads, desktop quick-add, both native phone apps (including camera/photo/video capture), browser/sidebar file upload and the public API all accept at least 100 MB per file; the launch limit is exactly 100,000,000 bytes, inclusive, on every ordinary path. Public and internal PEG-007 request forms accept 25 MB per file (25,000,000 bytes inclusive) and 75 MB combined per submission (75,000,000 bytes inclusive). The UI/API state both human-readable and exact byte limits before choosing/transferring files; administrators cannot silently lower these per-file guarantees. There is no arbitrary files-per-task/workspace count cap; bytes consume the installation’s disclosed PEG-061 storage usage and owner-set aggregate quota. Each uploader sees the applicable remaining capacity or a privacy-safe available/not-available decision for restricted shares, without learning private storage totals. A lower remaining aggregate quota is named before transfer, with an owner-contact/repair path; concurrent uploads reserve capacity atomically and cannot overcommit it. Before sending file bytes, a size/role/quota preflight refuses an oversized file or over-total form selection, names the exact applicable limit/remaining allowance, and offers Attach a Google Drive or OneDrive link through PEG-043 (or the owner’s PEG-080 connection guide if disconnected). The server independently checks actual streamed size and refuses falsified size claims; no partial or failed upload is a finished attachment or proof.

**Acceptance.**
1. Through browser/public API upload-session doors at 1440/390, the installed macOS/Windows desktop app and both native iOS/Android apps, upload and finalize an exact 100,000,000-byte fixture on every ordinary path, including task, comment, proof revision, browser/sidebar upload and guest upload; compare stored bytes/digest and one version.
2. Refuse a 100,000,001-byte file and a 25,000,001-byte form file before any file-data request; accept three 25,000,000-byte files in one form submission and refuse an added byte before that selection transfers.
3. Inspect exact limits and the Drive/OneDrive option on web, desktop, guest, phone and API responses, including a disconnected-provider guide link.
4. Exercise visible lower remaining quota, two competing reservations and dishonest size metadata; no failed/partial object appears in Files or proof review.

#### PEG-091 — Resumable transfer and owned byte custody

*Tier:* Core · *From:* PEG-082 · *Cites:* BASE-INPUT-003, BASE-DATA-001

**Requirement.** Web, desktop, guest and native app transfers show bytes/progress, interrupted/resumable/failed state and a cancel control; the public API exposes the same upload-session progress and resume door. Durable bounded-chunk/multipart sessions resume after a connection or process/app interruption and finalize exactly once only after verified byte count/content digest and current permission checks. Retrying a part or finalization creates no duplicate attachment/version, and cancellation, expiry, quota failure or share/session revocation aborts incomplete objects and releases reservations. Completed attachment bytes and proof versions live in the installation’s own US R2 bucket, registered in Base’s portable bucket and object-reference policy; a metadata row, external URL or unregistered parallel store cannot satisfy custody. PEG-058 archives include actual complete bytes, metadata, source/version/digest and task/comment/proof links and restore multipart-sized files to the destination bucket; resumable session credentials/partial uploads never become restored authority or completed artifacts. PEG-059/065 erasure/retention covers original bytes, proof versions, derived previews and incomplete parts.

**Acceptance.**
1. Interrupt a chunk and the receiver/app, restart and resume to exactly one matching version; replay part/finalize, revoke the share mid-transfer and cancel another session, checking no unauthorized completion or orphaned reservation/part.
2. Through Base’s actual archive/export and restore API/CLI doors with a real R2 sandbox, interrupt/resume archive restoration of these files into a fresh installation, compare exact bytes/digests/links including the large MP4/PDF, and prove no old upload capability executes.
3. Erase one proof and an interrupted upload and verify original/derived/version/partial-object cleanup and released PEG-061 storage usage.

#### PEG-092 — Proof revision upload grants and migrated attachments

*Tier:* Core · *From:* PEG-082

**Requirement.** A reviewed external proof share can separately grant narrow Upload a revision permission: it allows a replacement only on that shared proof and grants neither general task editing, wider access nor any new proof-approval authority; existing human approval policies apply and approve-only shares remain approve-only. A migrated attachment at or below the same 100-MB bar can be uploaded as a later proof version through the ordinary paths, with historical source provenance and decisions retained and fresh review required.

**Acceptance.**
1. A member, guest Editor and external proof approver with the explicitly reviewed revision-upload grant each upload a valid 95-MB MP4 and 80-MB PDF through web and both native apps, then annotate the MP4 at a specific frame/timecode and the PDF on its page.
2. An approver without that extra grant cannot upload, and an upload-only contributor cannot approve without a separate current human approval grant.
3. Re-upload a migrated 100,000,000-byte project-management source attachment as proof v2, preserve source v1 history and refuse stale v1 approval.

#### PEG-008 — Capture where the team already works

*Tier:* Core

**Requirement.** Email-to-project handles forwarded mail, envelope routing, attachments and sender attribution. Authorized Slack, Teams and Nook message actions create tasks with source links and approved contextual excerpts. A browser extension captures a selected page/title and chosen content under the user's current scope. Capture previews project, owner and visibility, deduplicates replays, treats external content as untrusted and never grants the source sender project membership. Each member can create/rotate a sealed personal email-to-My-Tasks address in Account settings; authenticated mail routed there becomes an owner-private no-project task with safe attachments, sender/source attribution and no automatic collaborator/project grant. Receipt routes are installation/member-bound, rate-controlled and revoked at sign-out policy/deprovisioning/address rotation; a guessed or foreign route cannot enumerate personal work.

**Acceptance.**
1. Forward a real-format email with attachments, invoke each of Slack, Teams and Nook message actions and capture a web page with the installed extension.
2. Read persisted tasks with source links, replay an event and revoke source access; no duplicate task, unauthorized excerpt or hidden project is created.
3. Create a personal intake address, forward authorized mail with an attachment and find one private My Tasks item; replay it without duplication.
4. Another member cannot read/search the task or its raw route, and messages to a rotated, revoked or cross-installation route create no work or share.

#### PEG-009 — My Tasks and useful notifications

*Tier:* Core · *Rules:* D-5, D-6, D-7, D-9

**Requirement.** Personal prioritized work combines assignments, due work, approval requests and reminders across permitted projects. A unified inbox supports follow/unfollow, read/unread, mute, snooze, daily digest, do-not-disturb and timezone-aware quiet hours. Users can explain why an item arrived and act without losing place. A muted work stream does not create new notifications; mandatory security notices remain clearly separate. PEG-073 defines personal no-project tasks, private sections, date promotion and the deterministic default order; My Tasks shows those alongside authorized project assignments. Every task/comment/approval email notification supports PEG-072 reply-by-email. Internal notices follow the internal notification policy (D-5); ordinary guest system notices and reply routes use the current reviewed share (D-6), with each guest choosing their own notification preferences. Agent-composed guest messages and new or outside-share disclosures are external (D-7). Guest notification controls are independently editable by the guest and neither inherit a member’s preferences nor default to silence merely because the account is external. PEG-096’s Ready to start notice is on by default for the current assignee when the last blocker completes and follows these notification preferences, including guest controls.

**Acceptance.**
1. Assign work, mention a follower and a muted user, snooze an approval and cross a DND boundary.
2. In My Tasks and Inbox, inspect correct priority and only expected notices; receive one configured daily email digest with no hidden or muted content and no lost actionable approval.
3. Compare My Tasks ordering with PEG-073’s stated order; reply to an ordinary comment notification and verify PEG-072’s one attributed comment, then verify an internal digest sends under policy and a guest digest containing only currently shared work sends without per-message approval.
4. Under the held policy, an agent-composed message to a client guest waits for the test person’s approval of its exact recipients and content.
5. Assign shared work to a guest Editor with email and push enabled and receive exactly one of each without an approval queue; deliver a due-soon reminder, comment notice and daily digest with no internal-only field/comment, then mute/DND and verify the guest’s choices suppress or defer the expected notices.
6. Exercise PEG-084’s unauthenticated-domain block, PEG-120’s signed bounce/complaint suppression and PEG-121’s throttle/restart cases for this email path without duplicate, silent-drop or false-delivered outcomes.
7. Exercise PEG-096’s no-rule default last-blocker completion, replay/mute/reassignment/guest privacy cases through Inbox and configured channels.

#### PEG-010 — Collaboration with a complete history

*Tier:* Core

**Requirement.** Rich-text task descriptions, project briefs, comments, mentions, reactions, file attachments and collaborative editing preserve revisions and attributable activity for every work-field change. Presence and live updates do not bypass permissions; concurrent edits surface conflicts or merge without losing text. Edit/delete controls retain appropriate history under retention policy. Project context links to Slate knowledge pages without creating a second wiki. Project/team Messages are scoped announcement threads with a subject, work links, threaded replies, subscription controls and email/in-app delivery alongside status history; they do not create workplace chat channels. Rich descriptions, briefs and comments embed permitted Loom/YouTube video, Figma designs and Google Docs with an accessible link alternative, provider permission checks and explicit unavailable/revoked states; embedding never publishes a private source. Native task/comment file uploads use PEG-082’s 100-MB inclusive limit and PEG-091’s progress, resume and version-safe custody. The same p95 2-second committed-change-to-painted-view bar from PEG-003 covers comment/brief collaboration on PEG-023’s fixed profiles, with source revision and stale/offline labels.

**Acceptance.**
1. Two browsers edit a brief and comment on a task, mention a teammate, attach a file and react.
2. Inspect live updates, field-level actor/time history and conflicting edits after reconnect.
3. A restricted guest's UI, API, exports and mention picker reveal only permitted content.
4. Publish a project and team announcement to a reviewed audience, receive one in-app/email notification and reply in-thread from email.
5. Embed each named media type in a brief and task context, revoke source access and confirm a restricted guest sees no protected preview or content; keyboard users can use the link alternative.
6. Complete PEG-082’s task/comment limit and PEG-091’s interruption and no-duplicate finalization cases.
7. Measure 100 remote comment/brief edits per fixed profile, including a revoked reader and reconnect conflict, with p95 at most 2 seconds for online authorized views and no private payload.

#### PEG-011 — Version-specific creative proofing

*Tier:* Core

**Requirement.** Reviewers annotate images, PDF pages, video timecodes/frames and webpage captures, compare versions side by side and track open/resolved feedback. File identity, content digest and version remain attached to every pin and decision; moving or replacing a source file never moves old feedback onto unrelated content. Webpage proofs capture the reviewed state rather than pretending a mutable URL is a fixed asset. Every native proof revision accepts the PEG-082 100-MB bar, including externally shared uploads with PEG-092’s separately reviewed revision-upload grant; upload never constitutes proof approval.

**Acceptance.**
1. Review two versions of an image, PDF, video and webpage through Proofs at both widths.
2. An external guest pins a comment on PDF v2, compares v1/v2 and approves v2; change the underlying file and observe old proof/approval retained with new review required, including unavailable-source and expired-share states.
3. Use PEG-092’s 95-MB video timecode/frame and 80-MB PDF paths, a migrated 100-MB file re-uploaded as v2 and the current-version approval refusals.

#### PEG-012 — Rule builder, run log and configuration authority

*Tier:* Core

**Requirement.** A no-code builder offers event and scheduled triggers, conditions and actions within/across Pegboard projects: assign, move, set fields, create from template, request review, notify or call a webhook/Crank. Rules carry actor scope, version, enable state, preview and durable run log with inputs, intended effects and outcomes. Loop protection, idempotency and bounded quota-aware retry protect work; retrying a failed run never repeats successful effects or bypasses human approvals. Only the relevant project/team Admin can create, change or enable its rule, field definition or task/project template; Editors can trigger authorized work actions without managing that configuration. AI classify/extract/draft steps are PEG-074. The action catalogue also names mark an ordinary task complete, add a comment, add an existing permitted collaborator/follower, multi-home a task into another permitted project, create a subtask, and add a tag. Each has field/recipient/project scope, preview and the same retry/run/undo semantics; completing an ordinary task cannot sign an approval task. Adding collaborators or multi-homing cannot silently disclose previously private work: existing access is rechecked and any new share still requires the independent reviewed share decision. Run deduplication and PEG-064 conflict-preserving undo cover dates, assignments and all six added work actions without undoing later independent human edits. An Editor who cannot manage rules sees Ask your project Admin with the responsible current Admin(s), a scoped request/suggestion and its status; it creates no executable rule or elevated role. PEG-107 imports rule authorship as source attribution, suggests the required per-project Admin mapping and stages any role escalation for a human access decision rather than silently elevating a former project-management source Editor.

**Acceptance.**
1. Build a conditional status-change rule through Settings, trigger it across two projects and inspect the run.
2. Fail its provider webhook, restart, retry and replay the trigger; one local effect persists, failure/uncertainty is visible, scope denial is enforced and no rule signs a human approval or sends an unapproved external message.
3. Exercise every added action via builder and public API: complete an ordinary task, add one comment, add a permitted collaborator, multi-home one task, create one subtask and add one tag; compare one intended effect after replay/restart and scoped undo.
4. Refuse approval-task auto-signoff, hidden-project multi-homing and a collaborator who would gain unreviewed access.
5. As an Editor follow Ask your project Admin, submit a rule suggestion and inspect the responsible person/request state, with UI/API config writes still refused.
6. Import an project-management source Editor who authored a rule, inspect source attribution and proposed project-Admin mapping, and activate only after the independently reviewed grant/activation.

#### PEG-093 — Rule notices, posts and disclosures

*Tier:* Core · *From:* PEG-012 · *Rules:* D-5, D-6, D-7

**Requirement.** Named Slack/Teams/Nook channel/person actions run for internal audiences under the internal notification policy (D-5). A rule-triggered fixed system notice to a current guest about already-shared work uses that reviewed share approval and preferences. Arbitrary rule posts to external audiences and client-shared channel posts wait for a person’s exact approval; agent-composed guest text is external, and agent or AI-produced date or assignment changes affecting others are standard with the affected people as facts, each decided by the company’s policy (D-7, D-8). A pending outside-share send cannot execute until an authorized human both reviews its exact disclosure and establishes any required share; the rule never broadens the share itself.

**Acceptance.**
1. Have an Editor attempt rule/field/template configuration via UI and API and refuse each, then have an Admin configure an AI intake-classification step and a Slack/Teams internal-channel post.
2. Inspect the permitted dropdown result and step input/output log, one internal post without per-message approval, a pending outside-share or arbitrary external rule send, and, under the schedule-approval policy, a pending AI-produced date proposal; a fixed assignment/reminder notice to a current guest inside their share delivers without another approval.
3. Trigger two rules for the same guest: one ordinary due reminder inside their share and one disclosure of an unshared task.
4. The reminder sends once under their preferences; the unshared disclosure remains pending review with no payload delivered, and refusal remains if required access is not granted.

#### PEG-094 — Deterministic rule dates and reviewed activation

*Tier:* Core · *From:* PEG-012 · *Rules:* D-8

**Requirement.** Deterministic in-scope rule dates/assignments use the separately reviewed activation below. Deterministic scheduling actions set, clear or shift start/due dates from the trigger instant, a specific date, creation date, the triggering task’s start/due/custom date field, or versioned template-relative dates, with positive/negative offsets in days, weeks, months or business days. The preview names timezone, business calendar/US holidays, source-field null policy, invalid end-of-month clamping and DST handling; missing source dates produce a visible no-op/repair item rather than an invented date. An authorized project/team Admin reviews and activates an exact rule version with projects/task predicates (including future matching tasks), fields/actions, assignee choices, date offset/calendar and allowed dependency knock-on scope. That recorded activation is the human approval for deterministic due/start dates and assignments on in-scope new and existing tasks, including form intake, created subtasks and create-from-template work. Each run applies those effects at once without another approval, subject to the Admin’s still-current grant and version checks; it records activating Admin, activation/version, trigger/source revision, computed dates/assignees and outcomes. A changed definition, calendar policy, scope or assignment/date configuration invalidates activation until reviewed again; there is no silent use of an older grant for a newer draft. Each run rechecks rights and affected dependencies. A cascade outside the reviewed scope/current Admin grant stays pending for its authorized human, with no private titles/counts leaked; a coherent approved in-scope effect may apply only if it leaves no inconsistent dependency state, otherwise the linked schedule change waits atomically. AI rule steps and agent-provided date/assignment values are never covered by an activation: they carry the standard class with the affected people as facts and the company’s policy decides them; an AI label, template choice or upstream output that determines the resulting assignee/date is AI provenance too and cannot be laundered through a deterministic wrapper. Approval is never generated by a rule itself.

**Acceptance.**
1. At 1440/390 an Admin previews/activates one form rule (assign the fixed designer, due in five business days on the selected US holiday calendar) and one section-move rule (assign the fixed editor, due in two calendar days).
2. Submit ten requests and move ten existing tasks: all twenty runs apply the expected dates/assignments once with no pending per-run approval, and every log names the activated version/Admin and exact source/computed values.
3. Replay a trigger and restart mid-run without duplicate effects; undo one run, preserving a later human edit as a named conflict.
4. Create template work and a meeting-agenda subtask two weeks before a custom event date under activation; inspect correct new-task dates, negative offsets, a holiday, DST/end-of-month policy and missing-date no-op.
5. Edit the offset without reactivation and require the next run to wait; reactivate after preview, then apply once.
6. Revoke the activating Admin and refuse a later run.
7. Make a date change reach a hidden dependant outside the reviewed project scope: keep the unauthorized cascade (or its inseparable change set) pending without hidden data, and require that project’s authorized approval.
8. Under the schedule-approval policy, an AI-extracted date, an AI-chosen routing/template that determines a date/assignee, and an agent re-plan each wait for exact review.

#### PEG-095 — Holiday calendar changes and bulk re-review

*Tier:* Core · *From:* PEG-012

**Requirement.** A holiday-calendar edit identifies only activated business-day rules referencing that calendar revision; calendar-day rules, unrelated calendars and already committed task dates continue unchanged. Show one consolidated old/new-date/assignee/scope preview for affected rules and a bulk Re-review and reactivate selection to an Admin authorized over the selected projects. Record one decision per unchanged selected rule; stale/unauthorized rows wait individually, and no calendar edit silently rewrites existing commitments. New affected runs remain visible pending this single bulk review, not a hidden failure or one approval dialog per run.

**Acceptance.**
1. Add a US company holiday used by 30 rules across permitted projects, including two unrelated-calendar/calendar-day controls.
2. Preview all affected future dates once, bulk approve the unchanged authorized rows and resume their pending deterministic runs without per-run approval; controls and existing dates are untouched.
3. Change one rule or revoke one project grant between preview/apply and hold only that row.

#### PEG-036 — Approval routing and external review custody

*Tier:* Core

**Requirement.** Approvals support ordered or parallel stages, named people, required quorum, delegates, due dates, reminders and reopen/withdraw paths. Approve-only guests receive only the exact shared material; authenticated or expiring verified-recipient links bind the decision to a person and proof version, and merely opening a link never decides. Changed material invalidates pending decision authority and requires review again. The reviewed proof share authorizes fixed system proof/approval notifications and due reminders to its current external approver, with no additional send review and with their preferences respected. This delivery does not decide the approval or release other project material.

**Acceptance.**
1. Route a creative proof through internal then external reviewers, deny an unauthorized reviewer, expire and revoke an external link, delegate a stage and submit changes.
2. Inspect quorum, human identity, time and exact version; a stale tab or replay cannot approve a replacement asset or reveal other project content.
3. Give an external approver a reviewed PDF-v2 share, advance to its configured reminder time and receive the ordinary proof reminder once without a per-message review.
4. It identifies only their permitted version and safe fields; a hidden internal comment is absent and the decision remains pending until the human’s version-bound action.
5. Repeat named-approver, quorum, delegate and approve-only guest decisions on a PEG-005 approval task through the UI and API.
6. Its owner, and anyone who has owned it since its previous decision, is refused as approver, and the decision door asks PEG-020's capability check rather than a role name.

#### PEG-037 — Reminders, escalation and delivery outcomes

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-3, D-6, D-7, D-9

**Requirement.** Due/overdue, blocked dependency, missing update, intake and approval reminders have named owners, working-hour timing, repeat/escalation policies and stop conditions. In-app, email, Slack, Teams, Nook and mobile push show queued, provider-accepted, failed, uncertain and person-responded states separately. Digests respect preferences; recovery, reassignment and revocation cancel obsolete chases. Uncertain external sends are reconciled before re-send. Ordinary assignment, due, comment, proof and approval notices and digests to a current guest use the current reviewed share as send approval, including rule-triggered notices, while honoring that guest’s channel/mute/digest/DND choices. Their delivery log names the approving share revision. Agent-written external chases are external (D-7); neither an agent action nor a reminder timer can turn its draft into a system notice.

**Acceptance.**
1. Make an approval overdue, reassign it during a queued reminder, simulate provider rejection and lost acknowledgment, restart and then receive a valid reply.
2. Inspect one correctly routed reminder, visible exception and stopped escalation after the actual decision; no duplicate send, muted notice or fabricated response appears.
3. With a guest Editor and external proof approver on reviewed shares, deliver assignment email/push, due-soon/overdue and comment notices, a digest and an on-schedule proof reminder without per-message approvals.
4. Inspect one intended notice per event/recipient/channel and no internal-only material; recheck a queued notice after revocation.
5. Under the held policy in the same run, an agent-drafted guest chase waits for the test person’s approval and an outside-share rule disclosure waits for exact review, with no external payload submitted.
6. Exercise PEG-084’s unauthenticated-domain block, PEG-120’s signed bounce/complaint suppression and PEG-121’s throttle/restart cases for this email path without duplicate, silent-drop or false-delivered outcomes.

#### PEG-096 — Ready to start notice

*Tier:* Core · *From:* PEG-037

**Requirement.** The Ready to start system notice is enabled by default, without building a rule: when the last currently blocking precedent completes, notify the waiting task’s current assignee once per blocked-to-ready transition. Multiple blockers do not generate a premature readiness notice; duplicate/out-of-order completion events and concurrent final completions deduplicate. Reopened/new blockers retract an unsent obsolete notice and a later genuine blocked-to-ready transition may produce a new notice. Respect current task visibility, reviewed guest share, assignee changes and that recipient’s follow/mute/digest/DND/channel preferences; never reveal a hidden predecessor’s name/content/count. The notice opens the authorized waiting task and explains readiness using only permitted dependencies. It does not complete work, alter dates or imply proof approval; a person may disable it in notification preferences.

**Acceptance.**
1. With no PEG-012 rule configured, give one waiting task two blockers and a member assignee.
2. Complete the first: no Ready to start notice.
3. Complete the last (including concurrent/replayed/out-of-order completion) and receive one default readiness notice opening that task.
4. Reassign before a queued send, mute/DND or revoke access, and verify current-recipient delivery or suppression with no hidden dependency details.
5. Repeat for a scoped guest and a hidden predecessor, reopen/add a blocker before dispatch to cancel obsolete readiness, then complete a fresh blocked-to-ready transition and receive only its current notice.
6. No task/date/proof decision changes as a side effect.

#### PEG-097 — Notice timing bars

*Tier:* Core · *From:* PEG-037 · *Cites:* BASE-MAIL-001

**Requirement.** At PEG-023’s fixed scale/profiles, ordinary non-digest non-DND internal/guest system notices appear in the authorized in-app inbox within 5 seconds of the committed event and are handed to the configured mail provider within 60 seconds when its quota/service is available. Measure event commit, inbox-visible, queue-ready, provider acknowledgment and receipt separately. Chosen holds, confirmed authentication failures, provider throttles, quiet hours and digests are explicit deferred states with next eligible time/owner, not falsely on-time successes; after eligibility returns, the same bounds apply from that instant. Push retains PEG-079’s separate five-second hand-off bar and actual Inbox placement/human receipt is never inferred from mail acceptance.

**Acceptance.**
1. At the fixed 10k-task/500-member profiles, timestamp 100 ordinary notice events including a guest and Ready to start: every happy-path inbox notice is visible within 5 seconds and mail is provider-accepted within 60 seconds, without counting a skeleton/outbox row as visible delivery.
2. Cross DND/digest/quota/auth/chosen-hold cases, inspect explicit deferral/deadline and resume timing, no duplicate send and no fabricated mailbox receipt.

#### PEG-072 — Reply to ordinary notification email

*Tier:* Core · *Rules:* D-9

**Requirement.** Task, comment, approval and project/team Message notifications carry a recipient-bound, revocable reply route. A signed provider inbound event must establish delivery custody and authenticated sender identity, matched to a verified current member/guest address with comment access to the exact task/thread; an untrusted From header or possession of a forwarded reply address is insufficient. Valid replies append one attributed comment with safe attachments, strip recognized quotes/signatures without discarding new inline text and deduplicate message IDs. Explicit first-line /complete and /reopen commands from an authenticated current Editor/assignee can change ordinary task completion once and log the human action; they cannot complete an approval task in lieu of a decision. Other reply text becomes a comment, never an implicit command. Reply text never constitutes approval or grants To/CC addresses membership; exact decisions use the authenticated PEG-036/071 controls. A refused reply has an inspectable redacted reason without leaking hidden work to the sender.

**Acceptance.**
1. Generate an ordinary task/comment/approval notification and an announcement, reply from the verified authorized member address through the official-schema inbound mail door and read one comment with its attachment and original source ID.
2. Replay it and test inline text amid quotes.
3. Spoof the From address, forward the reply route to a stranger, revoke the member and use a Viewer’s address; each produces no comment, access grant or decision.
4. Reply /complete and /reopen to an ordinary task notification as its authorized assignee and inspect one human-attributed state change per message; deny the same command from a Viewer.
5. Reply “approved” or /complete to a proof approval email and keep its human approval pending until the explicit version-bound action.
6. Exercise PEG-084’s unauthenticated-domain block, PEG-120’s signed bounce/complaint suppression and PEG-121’s throttle/restart cases for this email path without duplicate, silent-drop or false-delivered outcomes.

#### PEG-039 — Meetings become reviewed actions

*Tier:* Core · *Register:* R-3

**Requirement.** Authorized Zoom, Google Meet and Teams meeting notes/transcripts become proposed task assignments, decisions and follow-ups with meeting/segment citations. Consent and source access govern capture; transcription can be provider-delivered or supplied through an authorized import. Participants resolve ambiguous owners/dates before adoption. No meeting recorder joins or records without the required organizer/participant controls.

**Acceptance.**
1. Connect each meeting service at its official-schema boundary, ingest an authorized transcript with uncertain ownership and prepare actions.
2. A person edits and approves them once through the meeting review page; tasks link back to the source, duplicate delivery does not duplicate work, and revoked access removes unavailable context from later agent reads.

### Delivery and visibility

#### PEG-013 — Portfolios that roll up truthfully

*Tier:* Core

**Requirement.** Nested portfolios organize projects two or more levels deep and roll up status, progress, dates, owners, milestones, custom fields and delivery risk with drill-through to the underlying work. Shared task membership does not inflate totals; manual health and computed indicators are separately labeled. Permissions apply to portfolio search, aggregation and drill-down; totals do not disclose hidden work. A versioned owner-adjustable risk policy is visible beside manual health, with defaults: at risk when any incomplete milestone is past due, any incomplete critical-path task has negative slack, at least 20% of incomplete due-dated tasks are overdue, or the last human-published status is over seven calendar days old. Zero eligible due-dated tasks yields no overdue-share ratio, and a never-published status is labeled missing/unknown, not healthy. Each flag shows triggering source rows, evaluated time and policy version; manual health cannot erase a computed reason. Portfolio tabs include project and cross-project task timelines, workload and dashboards, with saved filters and permission-safe aggregates.

**Acceptance.**
1. Create a two-level portfolio of 20 projects, including shared tasks and a private project.
2. Change a blocker and completion through Tasks and see correct live rollups, at-risk flags and source drill-down; a limited stakeholder sees only authorized totals and no private project names.
3. At a controlled clock, cross each default threshold independently, including exactly 20% overdue and just over seven days stale; observe the expected flag and reason, then resolve it and change the policy to inspect recalculation.
4. Compare manual health separately.
5. Inspect timeline/workload/dashboard tabs for the nested portfolio and confirm no double-counted work or hidden-project leakage.

#### PEG-014 — Goals and OKRs linked to execution

*Tier:* Core

**Requirement.** Company, team and personal goals support objectives, key results, owners, periods, numeric targets, check-ins and linked projects/tasks/subgoals. Progress can be manual, weighted work completion or an authorized numeric source, with explicit unit, calculation, freshness and override history. Missing/stale inputs are shown rather than promoted to success, and one task is not counted twice. Only the goal’s current active human owner authorizes a numeric source, for that one goal, by an explicit audited authorization with a finite expiry; its credential publishes observations only and confers no identity or authority, revocation, expiry or a change of owner ends the source for good, and an ended source yields no progress while its history stays visible (RL-4).

**Acceptance.**
1. Create company/team/personal goals, complete linked work, update a numeric source and inspect computed progress and check-ins through Goals and API reads.
2. Replay or age the numeric event, change permissions and inspect deduplication, stale labeling and restricted rollups.

#### PEG-090 — Goal visibility and accountable goal owners

*Tier:* Core

**Requirement.** Every goal has one accountable owner who is an active internal human; a company or team goal's owner is never an agent, guest or analyst. Company goals are readable by every active internal member (owners, administrators, managers, members and analysts) unless a person who manages a goal restricts it to named people or teams. Team goals are readable by the team's current members and by anyone with current read on the team under PEG-083. A personal goal is readable only by its owner unless the owner shares it with named people or teams after a preview. Workspace owners and administrators manage company goals; a team's Admins and the workspace/team managers covering it manage its goals; owners manage their personal goals. Managing means creating, linking work, naming the owner and editors, and restricting or sharing visibility. The owner and named editors check in and record numeric observations. Managers and administrators gain no ordinary read of personal goals; exceptional custody stays under PEG-058/059/065. Guests see a goal only through a reviewed PEG-019 share and agents only through an explicit PEG-062 scope; guests never check in, override or publish observations, and an agent’s check-in or observation is a standard call for its sponsor that the company’s policy decides. Each reader's progress uses only inputs they may open; any other input yields PEG-014's restricted state, without its title, owner or count. Broadening a goal's audience first previews the check-in notes and linked titles it would newly reveal. Visibility, role and grant changes apply at the next read and at commit.

**Acceptance.**
1. Through Goals at 1440/390 and through the API, a member reads a company goal and its permitted links.
2. A team member reads their team's goal and a non-member is refused it.
3. A guest, an agent and an unnamed member are each refused a restricted company goal.
4. Name a member as owner of a company key result: they check in and record an observation, another member cannot, and naming an agent, guest or analyst as owner is refused.
5. Share a personal goal with a manager after its preview, then revoke the share; an administrator's ordinary session never reads it.
6. Revoke a reader's project grant between preview and check-in: the check-in is refused and the restricted state shows no hidden titles or counts.

#### PEG-015 — Stakeholder status drafts, publication and subscriptions

*Tier:* Core · *Rules:* D-5

**Requirement.** Project and portfolio updates contain health, highlights, risks, decisions and next steps, source links and the covered time window. Drafts and published revisions remain distinct; a named person publishes anything clients or executives will see, binding its exact revision, and an agent’s publication is external and commitment, decided by the company’s policy. Subscriptions deliver approved updates to in-app, Slack, Teams, Nook and email audiences with per-recipient access and delivery outcomes. Later corrections remain visible in status history. A person can request a date-bounded AI status draft on demand, edit/reject it and explicitly publish the reviewed revision under PEG-074. Project/team announcement threads under PEG-010 appear with status history and retain threaded responses. The internal notification policy (D-5) delivers an already published update without a second approval per delivery.

**Acceptance.**
1. Draft an update from three projects, exclude a private risk from a client's version, approve and publish exact content to each channel.
2. Inspect subscriber receipt outcomes and immutable published history; revise a source before approval and require a new review rather than publishing stale or private material.
3. Generate an on-demand project and portfolio status draft for a chosen window, reject/edit one sourced assertion and publish as an authorized human.
4. Confirm one publication decision, expected internal deliveries and a still-pending client version until its exact recipient/content review.

#### PEG-098 — Discussion on published status updates

*Tier:* Core · *From:* PEG-015

**Requirement.** Each published status-update revision has a permission-scoped comment/reply thread with mentions, follow/mute, edit/delete attribution and links to that exact revision; authorized recipients can discuss it without republishing the status or silently broadening the audience. Guest replies follow the reviewed share, and private/internal replies never leak through the client version.

**Acceptance.**
1. Publish a project and portfolio update, add member and guest comments/replies at 1440/390, edit/correct the update and retain revision-bound conversation/notifications.
2. Revoke a guest, replay an email/chat reply and refuse hidden/internal comments across UI/API/digest without changing the publication decision.

#### PEG-099 — Rights requests on retained status snapshots

*Tier:* Core · *From:* PEG-015 · *Cites:* BASE-DATA-003, BASE-DATA-006

**Requirement.** A retained status snapshot causes an explicit custody blocker, never a successful erasure claim or an indefinite automatic refusal. A rights request records its receipt date, responsible handler, affected copies, applicable deadline and disposition. The installation owner may delegate narrowly scoped custody review to a named privacy administrator without granting ordinary browsing access to unrelated personal work. Acknowledge requests within ten business days and provide a reasoned disposition within 45 calendar days, or sooner where applicable law requires. An extension is available only where the applicable rule permits it, with notice before the original deadline, the permitted reason and a definite final date; missing implementation alone does not justify an extension or refusal. Pending the product erasure journey, provide a documented controlled manual route for eligible snapshot erasure or verified deidentification. Retain only material supported by a recorded applicable retention basis or lawful hold, with scope, authority and expiry or review date. Restrict unnecessary reuse and disclosure while review is pending, preserve nonpersonal audit continuity, and report unresolved recipient or processor copies honestly. Reviewed snapshot erasure remains required product scope.

**Acceptance.**
1. Submit an employee rights request affecting cited work and an attributed actor in drafts and published revisions.
2. Inspect the custody blocker, receipt date, named delegated handler, affected-copy inventory and deadline without a false deleted outcome.
3. Resolve an eligible request through the documented controlled route, preserve nonpersonal audit continuity and verify that retained copies and an older archive cannot restore erased personal content.
4. Separately retain only justified held material with a recorded basis and review date.
5. Exercise acknowledgment, initial response and permitted-extension deadlines at a pinned clock, reject an unsupported indefinite hold, and refuse an unauthorized handler without exposing unrelated work.
6. Report outstanding external copies without claiming provider-confirmed deletion.

#### PEG-016 — Capacity across all committed work

*Tier:* Core

**Requirement.** People have working hours, IANA timezone, hours/effort capacity, skills/role placeholders and time off from calendars and Willow or configured HRIS feeds. Workload includes cross-project commitments without double counting; tentative resource plans are labeled separately. Overload and unknown availability are visible, with drag-to-reassign and accessible alternatives, scenario comparison and reviewed reassignment. Capacity is hours/effort, while Gauge owns utilization economics. A member can declare dated full/partial-day out-of-office in Account → Availability without calendar/HRIS integration, with IANA timezone, working-time reduction and optional delegate/contact. It is labeled self-declared, not approved HR leave; assignment and mention pickers show an absence warning, workload removes the absent capacity and plans use it. Reasons stay private unless the member explicitly shares them. External approved leave overlaps by union, never subtracts twice; missing/stale feeds remain visibly unknown outside the known self-declared interval. A task retains one accountable owner plus permitted collaborators and explicit per-person effort allocations. Workload sums each person’s allocation once across multi-homing; task estimates, participant-hours and task counts have separate labeled totals. PEG-111 and PEG-114 preserve source assignees and split/sum/per-person estimate semantics through reviewed mapping rather than dropping secondary people or guessing each person’s load.

**Acceptance.**
1. Overload a person across three projects, add approved time off and an unfilled role, then inspect week/day capacity.
2. Compare a staffing scenario and reassign a task through Workload to clear the real overload.
3. A stale HRIS feed shows unknown freshness and a hidden task does not leak its title.
4. Without any integration, declare three local out-of-office days and a half day, inspect assignment/mention warnings, daily workload and an agent plan excluding unavailable capacity; cancel/extend the declaration with attributed history.
5. Overlay approved Willow leave and verify union/no double subtraction and no private reason leak.
6. For a 10-hour board-centric source item assigned to two people, reconcile Split as 5/5 and Sum as 10/10 participant-hours while preserving a single 10-hour task estimate.
7. For a workspace-and-list source 3/7 per-assignee estimate preserve both allocations and total 10; a multi-homed task remains one allocation per person.
8. Missing source semantics are an explicit reviewed choice/repair before any lossless workload claim.

#### PEG-017 — Task time and approved timesheets

*Tier:* Core · *Register:* R-3

**Requirement.** Timers and manual entries record person, project/task, date, duration, notes, source and estimate versus actual. One person cannot accidentally run overlapping timers; reconnect preserves intent without duplicate entries. Timesheets submit, return for correction, approve and lock; later corrections are attributed adjustments, not silent rewriting. Approved entries export to Gauge, Harvest, QuickBooks Time and CSV with stable external IDs and totals. Pegboard issues no invoice, rate card, payroll or monetary budget. A workspace owner or administrator other than the person who logged the time, with current access to every entry’s project, returns or approves a submitted timesheet; time on personal no-project tasks stays private and unsubmitted, approval sends nothing outward, and approved time reaches a provider only through PEG-042’s reviewed send (RL-3, RL-101).

**Acceptance.**
1. Track and manually enter time across two tasks, reconnect an interrupted timer, submit/return/correct/approve a timesheet and attempt a forbidden edit.
2. Export to each named time service and CSV through official-schema edges, then reconcile exact durations and project/task references without duplicates.

#### PEG-088 — Accountable timesheet reviewers

*Tier:* Core

**Requirement.** Besides workspace owners and administrators, a workspace/team manager or project/team Admin whose current authority covers every project on a submitted timesheet may return or approve it. A timesheet whose projects no single eligible reviewer covers waits visibly for one who does, and its hidden entries are never revealed to a partial reviewer. No one approves or returns their own time; a sheet whose only eligible reviewer logged it stays submitted and shows that it needs another reviewer. An agent’s approval or return is a commitment call the company’s policy decides, recorded as the agent’s act for its sponsor and never as the sponsor’s (SURFACE-004). A reviewer's or the person's loss of authority between preview and commit refuses the decision. On a returned sheet, the person may withdraw an unapproved entry on work they can no longer reach; the withdrawal is attributed in history and reveals no hidden content. Guest time submitted under PEG-019 follows the same reviewer rule. Approving sends nothing outward.

**Acceptance.**
1. Through UI and API, have a project-B Admin approve a single-project sheet.
2. Refuse that Admin on a sheet that also carries project-A time, then approve it as a manager covering both.
3. Refuse a self-approval by the only workspace owner and show the awaiting-another-reviewer state.
4. Revoke the reviewer's grant between preview and decision and see a refusal.
5. Return a sheet, revoke the person's access to one entry, withdraw that entry, then resubmit and approve.
6. Have a guest Editor submit time and have it approved.
7. An agent whose grant does not cover the sheet is refused an approve attempt.
8. No provider call or notification leaves the organization.

#### PEG-018 — Included reporting and export

*Tier:* Core · *Rules:* D-9

**Requirement.** Cross-project dashboards offer configurable charts/widgets, saved filters, drill-through, completion/overdue/throughput/cycle-time/status-age, time/capacity, request and approval reporting. Scheduled reports respect recipient access, timezone and selected window; CSV, real Excel workbooks, Letter-size PDF and BI connectors expose the same snapshot and definitions. Included reporting is not a paid tier, and truncated exports are never called complete. The minimum widgets are horizontal bar, vertical column, line/time-series, donut, single-number, table, burn-up and burn-down; each offers a named measure, group/time bucket, date window, completion/timezone semantics and source-row drill-through. Historical snapshots and event-time changes retain scope added/removed, reopened work and baseline changes, so a burn chart cannot quietly rewrite past progress; counts or effort are selected explicitly. Google Sheets live reporting is PEG-077. A scheduled authorized report is available in-app and handed to its configured provider within 15 minutes of its scheduled local time, including DST policy and restart; provider acceptance and actual recipient receipt remain distinct. If provider delivery cannot complete within that bound, the recipient/owner sees an overdue/failed state and cause by the deadline, with safe recovery, rather than a false on-time success. The passing happy-path evidence includes controlled recipient receipt within the bound; client/executive report publication still requires the existing human publication decision, not a fresh review of each notification.

**Acceptance.**
1. Build a dashboard over three projects, reconcile each widget with its source rows and download CSV/XLSX/PDF.
2. Schedule an authorized email report over a DST transition, inspect one correct window and delivery result, then deny a private-data subscription and verify no count or export leaks.
3. For every named widget, use a dated work history with added scope, completion, reopening and a removed task.
4. Reconcile every point/bar/slice/number/table row and both burn curves to source events over the selected range, including a DST boundary; inspect unknown history instead of invented trend points.
5. Schedule a report across DST and restart, record scheduled instant, generation, provider acceptance and controlled mailbox receipt and require at most 15 minutes lateness in the available-provider case.
6. Fail the provider and inspect the overdue cause by the same deadline; no duplicate delivery or unapproved client publication is labeled on time.
7. Exercise PEG-084’s unauthenticated-domain block, PEG-120’s signed bounce/complaint suppression and PEG-121’s throttle/restart cases for this email path without duplicate, silent-drop or false-delivered outcomes.

### People and daily access

#### PEG-019 — Free guests and scoped client views

*Tier:* Core · *Rules:* D-6, D-7

**Requirement.** Unlimited free guests receive project/task shares, viewer, comment-only, approve-only and editor/assignee roles and a branded client portal scoped to their client work. Internal-only tasks, fields, comments and files stay internal across views, reports, search, notifications and agents. Share previews show exactly what the recipient will see; expiry/removal revokes links and sessions promptly without deleting attributable historical decisions. A free guest Editor can create work within a shared project, assign/reassign among permitted project participants, be assigned deliverables, complete/reopen tasks, edit allowed fields, attach results and log/submit time on assigned tasks; an assignee-only guest grant limits edits to that task. Guest shares never permit member-directory browsing, invitations, permission changes or configuration edits beyond an explicit administrator policy. Existing commenter/approver-only restrictions remain selectable. The reviewed share records the inviting/adopting human, recipient, scope, exclusions and role; that decision authorizes in-scope ordinary system notifications/reminders/digests/reply routes (D-6), subject to the guest’s own preferences and current server permissions. It approves no agent-written message, client-shared channel post or outside-share data (D-7). Guest uploads have the same ordinary 100-MB limit and privacy-safe capacity state as members under PEG-082 and PEG-091’s progress and resume; an external approver may receive PEG-092’s separate narrow proof-revision upload grant only by reviewed share. The guest assignment chooser offers the project’s owners and its current explicit or configured project audience; implicit workspace administration alone never reveals a person, current share and role are rechecked on each action, and attributable historical decisions survive revocation (RL-102).

**Acceptance.**
1. Share one client project with each guest role, preview their portal, approve an asset and remove a guest.
2. Attempt internal record IDs, hidden fields, attachment URLs, exports and old links through UI/API; all refuse while the manager retains the historical signed decision and free-guest accounting.
3. As a freelancer guest Editor, create a shared-project task, assign it within the shared participant set, complete assigned work, upload its deliverable and submit time.
4. Refuse internal fields, unrelated projects, member enumeration and invitations through UI/API and email/chat actions; an assignee-only guest cannot edit a peer task, and comment-only/approve-only guests retain those exact limits.
5. After the reviewed invite, assign a shared task to the freelancer and receive one email and push without another approval; receive a comment notice, due-soon reminder and digest omitting a planted internal-only field/comment.
6. Queue another notice, revoke the share before send and prove it and its reply route are canceled.
7. Under the held policy, an agent-drafted chase to the same guest waits for the test person’s approval, and a rule disclosure outside the share waits for exact review.
8. Run PEG-092’s guest Editor and explicitly granted external proof-uploader web/iOS/Android cases; approve-only guests without that grant remain unable to upload or edit work.

#### PEG-020 — Server-enforced roles and administration

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESS-004

**Requirement.** Owner, administrator, workspace/team manager, project editor, member, guest, analyst and scoped agent roles have explicit capability grants. Private workspaces, teams and projects and field-level hide apply at every read/write door; a UI hide is never authority. The admin console manages memberships, invitation policy, sharing, retention, exports, integration grants and an auditable access review. The last responsible owner cannot be accidentally removed. For members and guests alike, team/project grants include Admin, Editor, Commenter and Viewer in addition to approve-only/task-assignee scopes. Viewer reads only; Commenter adds comments/reactions/allowed attachments but changes no task values; Editor creates and edits work; Admin additionally manages project/team settings, field/status definitions, rules, templates and shares. Within each object, effective capability is the highest current valid direct/team grant; explicit internal-only field/task restrictions, agent scopes and personal-task privacy still cap it. The UI explains each granting path, and revocation recalculates immediately. Administrative custody powers do not turn personal tasks into ordinary browsable work. Team privacy, project visibility/defaults and request/decision lifecycle are first-class settings under PEG-083 and PEG-100; resulting grants and refusal paths are enforced at every read/write door and included in the access review.

**Acceptance.**
1. Use a role matrix through real sign-in, task/project routes, API, exports and webhook registration.
2. Change permissions while a user has an open tab and show immediate server refusal and an audit event; try to remove the last owner and expose private fields through aggregate/formula responses, with no unauthorized effect.
3. Give one member Viewer on project A and Editor on B: deny A comments/edits via UI/API while B task edits pass.
4. Give a Commenter direct and Editor team grant on B, observe Editor access, then revoke the team grant and require immediate Commenter restrictions.
5. B Editor cannot edit rules/fields/templates/settings that B Admin can; personal/internal-only work remains undiscoverable through either grant.
6. Exercise PEG-083’s join and PEG-100’s request/approve/deny/expiry/replay/deactivation matrix and compare exact role/effective-grant audit rows across UI/API.

#### PEG-083 — Team privacy, discovery and joining

*Tier:* Core

**Requirement.** Team Settings offers Public to workspace, Membership by request and Private. Active workspace members browse/search public and membership-by-request teams with only policy-discoverable names/details; public teams offer Join without approval at the configured default Viewer, Commenter or Editor level, never implicit Admin, and request teams offer Request to join. Private teams remain absent from unauthorized browse/search/counts; an opaque direct link can offer a blind request under the same no-existence-disclosure rules as refused work links, without making the team discoverable. Team Admins choose authorized request approvers and a responsible fallback. Project Share offers Private to members, Team only and Shared with workspace, with explicit team/workspace default access levels and a preview of effective grant paths under PEG-020. Workspace-wide sharing excludes guests; invited guests retain only reviewed current grants. Discovery, joining and inherited visibility grant no more than configured defaults, and explicit private tasks/fields retain their restrictions. Changing a team’s privacy never silently changes a project’s own visibility; a broadened project audience requires the existing share preview/authorization.

**Acceptance.**
1. At 1440/390 browse/search all three team types as a new active member and guest.
2. Join a public team at its configured Viewer default and open its team-visible project at that project’s stated default; no Admin or hidden-project access appears.
3. Request a membership-by-request team with a message, receive email as its chosen Team Admin, sign in from that email and approve Editor; UI/API reflect only that reviewed scope immediately.
4. Compare invalid and undiscoverable target refusals/acknowledgments through UI/API/unfurls without private metadata or existence leaks.

#### PEG-100 — Access requests from refused links and their decisions

*Tier:* Core · *From:* PEG-083

**Requirement.** From a refused task, project or portfolio URL, browser/mobile deep link or Slack/Teams unfurl, an authenticated active workspace member can select Request access, choose a requested level and add an optional message. A task request proposes the narrow task grant unless a human explicitly reviews a broader project grant. Undiscoverable targets show no private name, field, thumbnail, owner, membership or work count before approval; invalid and undiscoverable links use indistinguishable generic refusal/request acknowledgments so requests cannot enumerate existence. Guests/uninvited/deactivated identities have no internal request option or submission authority. PEG-073 private no-project tasks can never become access-request targets: no request object, approver delivery or grant is created, and ordinary refusals cannot disclose their existence. Requests create no share/invitation and authorize no work content before approval. Delivery routes to currently authorized object Admins/approvers with the project owner, then team Admin or responsible owner/admin as a configured fallback; fallback routing conveys only the minimum administrative request metadata and does not itself grant ordinary private-work access. Requests arrive in the inbox, configured email, PEG-071 Slack/Teams and PEG-079 mobile push with preferences and current authority rechecked; missing provider connections show PEG-080’s guide state while inbox handling remains available. A person with current delegation authority, including an authorized owner/admin or project owner, previews the exact requester, scope and chosen Viewer, Commenter, Editor or Admin grant and approves it, or denies with a safe optional reason. Admin approval requires actual authority to delegate Admin; a request, bot callback, mailbox possession or agent cannot confer it. Authenticated inbox/API actions, signed-in email decision pages and mapped chat/mobile actions use the same public decision door; a GET/prefetch, forwarded button or unverified reply never grants access. Every request, deduplication, expiry, decision and resulting grant is recorded under PEG-057 and appears in the PEG-020 access review with actor, target/scope, requested/granted level, reason and time. Active requests deduplicate by requester/target/scope, have a visible expiry (seven days by default, configurable and bounded by policy), and recheck requester activity, target/share policy, approver delegation and the preview revision atomically at decision time. Denied, expired, already decided, replayed or stale requests grant nothing; deactivating a requester or revoking an approver invalidates outstanding authority. A valid approval takes effect on the next authorized UI/API read without a manual membership workaround.

**Acceptance.**
1. Paste a private project link into Slack as a second member: its refused unfurl/page contains no private name/fields/counts but offers Request access; approve Commenter from the project Admin’s inbox and prove read/comment succeeds while edit/settings fail in UI/API.
2. Repeat narrow task and private portfolio requests, delivery/decision through connected Teams and mobile, denial with a safe reason, and project-owner/team-Admin fallback without granting unrelated access.
3. Choose each of Viewer/Commenter/Editor/Admin as an authorized delegator, refuse an unauthorized Admin delegation and inspect exact grants/audit/access-review rows.
4. Concurrent duplicate submissions produce one pending request; expire it, replay approved/denied decisions, deactivate the requester, revoke the approver and change the previewed policy in separate cases: every stale action grants nothing.
5. Mail GET/prefetch, forwarded or unsigned callbacks cannot approve.
6. A guest sees no request option and cannot POST an internal request; a private no-project task creates no request, notification or grant, even when its ID is submitted.

#### PEG-101 — Imported team and project privacy settings

*Tier:* Core · *From:* PEG-083

**Requirement.** PEG-106 and PEG-081 import the source’s three team privacy types, project visibility/defaults and exact direct/team/guest paths as reviewed staged settings, preserving private nondiscovery and refusing unreviewed audience expansion.

**Acceptance.**
1. Import a project-management source fixture containing all three team privacy types and all three project visibility levels, mixed defaults and direct/team/guest grants through PEG-106 and the full PEG-081 account journey; reconcile source/effective permissions, review staged audience decisions and repeat directory/join/refusal checks after cutover with no broadened share.

#### PEG-021 — Enterprise identity and US custody

*Tier:* Core · *Cites:* BASE-SIGNIN-001, BASE-SIGNIN-002 · *Register:* R-8

**Requirement.** Native sign-in coexists with owner-configured SAML/OIDC through Auth, Okta, Microsoft Entra ID and Google, plus SCIM provisioning/deprovisioning, MFA, SSO-only enforcement, session duration, device/session listing and revocation. Provisioning never infers permission from email domain alone. US data hosting covers work records, attachments, backups and configured agent/provider processing with documented exceptions requiring explicit owner consent; provider residency restrictions are engineering work. Settings → Sign-in provides the browser-guided PEG-080 Continue with Google and Continue with Microsoft setup, without hand-authored SAML/OIDC config. Verified source identity must match an active invited/local member; invitation-only admission never broadens to a domain-signup policy. The native mobile apps offer the same configured methods in the system browser under PEG-079; disconnected methods name the missing connection and guide rather than silently failing.

**Acceptance.**
1. Qualify each named IdP using its official schema or sandbox, sign in under enforced SSO/MFA, then SCIM-deactivate a member and refuse every active session, token and mobile write within five minutes.
2. Inspect actual deployment/storage/backup placement and configured processor routing rather than inferring US custody from an app URL.
3. As a non-technical owner enable each Google/Microsoft method through the timed PEG-080 guide/live check, sign in an invited member and find their existing identity.
4. Refuse an uninvited, unverified-email, wrong-tenant or wrong-issuer account and show the named connection/recovery link if the method is not ready.

#### PEG-022 — Native iOS and Android daily work

*Tier:* Core · *Register:* R-4

**Requirement.** Installable native apps provide My Tasks, inbox, search, assignments, comments, attachments, approvals and push with deep links. Offline queues preserve pending edits and reviewed asset revisions, show unsynced state and resolve conflicts on reconnect; offline approval remains pending until the server validates current authority and version. Local caches and push payloads honor revocation and privacy. Run Edit Run’s release lane owns app builds, signing, App Store/Google Play publication and APNs/FCM service credentials; Run Edit Run operates the scoped push relay in PEG-079. The installation owner never needs an Apple/Google developer account or app-signing/push credentials. Member device consent and the owner’s once-per-installation relay registration remain explicit browser/app actions. Native apps additionally quick-add tasks and projects, complete/reopen work, edit due/start dates, assignee, status and every permitted custom field, browse project list/board/calendar and read project status/dashboards. Camera/photo pickers attach deliverables with visible upload state. Offline creation, completion and edits queue with one causal history each; a cached authorized project directory allows creating a task in a project never opened on that device, without pretending its uncached tasks are readable. Newly created offline projects/tasks remain pending authorization until reconnect. iOS/Android home-screen widgets show a permission-scoped Today list and quick-add entry; dark/light/system appearance and private notification previews follow user controls. Public-store installation, invitation/QR/URL binding, same-as-web native/IdP sign-in, app-version compatibility and production push qualification are mandatory PEG-079 journeys in addition to all offline and daily-work journeys here. Native camera/photo/video and attachment/proof uploads meet PEG-082’s ordinary 100-MB limit and persist PEG-091’s resumable progress across app restart. Web screenshots alone do not satisfy this clause.

**Acceptance.**
1. On real iOS and Android clients, open assigned work from push, comment and queue an approval offline.
2. Reconnect for a valid sync, then repeat after an asset change and after deprovisioning; inspect conflict/refusal, no duplicate decision and no accessible revoked cache.
3. On both real OS clients, cache the authorized project directory without opening project B, go offline, create a task in B, complete a cached task in A and change another due date.
4. Reconnect and inspect exactly those three changes with one history each.
5. Also create/edit a project, reopen work, change assignee/status/custom fields, attach a camera/photo item and read list/board/calendar/status/dashboard.
6. Test denied reconnect, widget quick-add, dark appearance and lock-screen privacy with no unauthorized cache access.
7. On both native apps complete PEG-082’s exact-limit and pre-transfer oversized refusal, PEG-091’s interrupted-resume and PEG-092’s shared-proof upload cases.

#### PEG-079 — Public mobile apps and Run Edit Run push service

*Tier:* Core · *Register:* R-4

**Requirement.** Run Edit Run’s release lane builds, signs and publishes the Pegboard iOS app to the public App Store and Android app to public Google Play under Run Edit Run’s developer accounts, and operates their production push relay. For every supported Pegboard release it tests and publishes compatible apps; the owner distributes no build and holds no Apple/Google developer or APNs/FCM credential. Each app’s signed compatibility manifest, store-support notes and installation-binding screen state its exact oldest supported Pegboard installation semver/API generation. For both launch apps that oldest version is the first released Pegboard installation edition: the exact full version from that launch’s edition.json is compiled into each app’s minimumInstallationVersion, not left as “latest” or an unfilled placeholder; later app builds declare their actual oldest qualified version separately for iOS and Android. An older/unsupported installation shows “This Pegboard app needs installation {minimumInstallationVersion} or later. Ask your owner to upgrade” with the current/required versions and owner-upgrade link; it cannot silently bind or mutate incompatible data. Members install the public app and enter their HTTPS installation address, scan its Settings/invitation QR or open its verified invitation deep link, see the installation identity/origin and confirm the binding. Native email links and configured Google/Microsoft/Auth/enterprise IdPs use the system browser and return a one-time installation-bound sign-in code to the app; tokens never travel in untrusted deep-link query strings. A member from another installation, wrong-origin invitation, replayed code or revoked installation cannot obtain the first installation’s session/data. Run Edit Run operates the relay under the same custody limits as Vector MOBILE-004/MOBILE-002: Settings → Mobile links relay terms, its data list/status page and compatibility matrix. The owner confirms one registration; its installation key is sealed/encrypted at rest, never returned in ordinary reads/logs/archives, immediately rotatable/revocable, and authorizes only that installation’s registered devices. Devices register through their signed-in installation; it submits only authenticated, signed relay requests and the relay refuses unsigned, cross-installation, deregistered or revoked sends. Allowed payload fields are the opaque device registration, work-item identifier, optional item title and actor display name, notification kind and installation-scoped notification ID; no description, comment, customer/contact data, credential or attachment may be included. ID-only is the private default and omits title/actor; the app fetches authorized details directly from its installation after waking. Optional title/actor previews require the member’s explicit setting and current record/share access, with disallowed sensitive content omitted. The relay stores only registrations/installation authority and redacted delivery metadata, forwards via APNs/FCM and retains no notification payload after forwarding; relay data/processing posture is declared under PEG-021/065. The owner can disable push installation-wide; sign-out, SCIM deprovisioning, device-token revocation, installation revocation and share removal stop matching pending pushes and direct quick-action authorization. Connected healthy delivery is submitted to the relay within five seconds of its inbox event outside the recipient’s quiet hours, with provider acceptance distinct from device receipt; deferred notices send once when allowed.

**Acceptance.**
1. On every release also qualify the signed TestFlight/Play internal-testing builds against the declared oldest supported installation and a current edition; verify each app’s exact minimum value and the named upgrade message/refusal against an older installation.
2. A relay fixture built from the published relay schema rejects unsigned, cross-key/cross-device, revoked and replayed attempts; capture only allowed payload fields, ID-only omission and no retained payload after forwarding, with no planted comment/customer/attachment content.
3. Cross-installation invitation/code replay cannot read data; deprovision/sign out and confirm deregistration, stopped push, denied quick actions and inaccessible revoked cache.
4. Test quiet hours and share revocation before queued delivery without duplicate notices.

#### PEG-076 — Installable desktop access and notification control

*Tier:* Core

**Requirement.** A browser-installable desktop app runs on macOS and Windows with a standalone window, deep links, keyboard quick-add, the same project/task/report permissions and OS notifications. Installation/update paths are browser-guided, visibly offline-capable to the supported PEG-023 queue, and sign-out/revocation clears local authority. OS and browser notifications require consent, use private previews, respect DND/mute and cannot expose work after revocation. Light, dark and system themes preserve contrast, chart legibility, proof version cues and focus at both widths; appearance preferences synchronize per user without changing shared project state. Desktop quick-add/task/comment/proof uploads meet PEG-082’s 100-MB limit with PEG-091’s visible durable progress and resume and the pre-transfer provider-link alternative.

**Acceptance.**
1. Install the desktop web app on macOS and Windows from its actual browser door, quick-add a task, open an allowed task deep link and receive an assignment notification.
2. Deny notification permission, mute/DND, revoke the session and inspect suppressed/private notifications and denied cached/deep-link reads.
3. Switch light/dark/system, inspect the changed screens at 1440/390 and run the same keyboard/contrast/reflow checks; an app update preserves pending edits or shows a named conflict.
4. Run PEG-082’s exact-limit/one-byte-over and PEG-091’s interrupted upload on each installed desktop app, preserving one version across update/restart.

#### PEG-023 — Speed and continuity at buyer scale

*Tier:* Core

**Requirement.** A 10,000-task project supports p95 interactive first-list load under one second and filter response under 300 ms on a published, reproducible US desktop/phone network and device profile. Measure actual authorized retrieval, permission filtering and rendering, including cold and warm runs, with 500 members and realistic custom fields, comments and dependencies. Optimistic edits show pending/error states and survive brief disconnections without silently overwriting newer work. Limits and degraded service are visible. The minimum fixed reference profiles are a four-core Intel Core i5-8250U laptop with 8 GiB RAM/current stable Chrome at 1440 CSS pixels on 20 Mbps down/5 Mbps up with 40 ms RTT, and a Pixel 6a with 6 GiB RAM/current stable Chrome at 390 CSS pixels on a stated 4G profile of 10 Mbps down/2 Mbps up with 80 ms RTT. Timing uses browser navigation start to the first real interactive authorized task page (including asset/network startup) and input event to painted filter results; 100 independently reset cold and 100 warm samples on each profile use the same stated dataset and p95 bars. Faster hardware or a less constrained network cannot substitute for these acceptance profiles.

**Acceptance.**
1. Use the built app with the stated dataset and published timing method at both widths; measure loads/filters, edit during disconnect and concurrent remote change, reconnect and verify persisted work or an explicit conflict.
2. Record actual timings and profile; a skeleton or cached empty list is not a pass.
3. Measure both fixed device/network profiles with those sample counts and time origins at the 10k-task/500-member dataset; publish observed p95 cold/warm loads and filters, device/browser versions and shaping settings, with no skeleton/empty-cache shortcut.
4. Any profile that exceeds the existing one-second/300-ms bars remains unmet rather than redefining the profile.

#### PEG-073 — Private personal work and a predictable day

*Tier:* Core

**Requirement.** My Tasks creates no-project tasks private to their owner, with user-defined sections, reorderable section/task ranks and a visibility preview before any project share or collaborator is added. Other members, guests and administrators cannot discover them through ordinary lists, search, API, notifications or agents; exceptional owner custody/export/retention actions remain explicit audited administration under PEG-058/059/065. The default incomplete-task groups are Overdue, Today, Upcoming and Later in that order: past due; due on the user’s current local day or manually marked Today; due in the next seven local days; then remaining/no-date tasks. Overdue wins over Today. Within each default group sort by due instant/date ascending, no date last, then urgent/high/normal/low priority, creation time and immutable ID. Date-only due values use the end of the named local day; manual ranks or saved custom sorts override only when visibly selected. At local midnight, due-tomorrow work becomes Today without changing its project section or deadline. User-defined section rules can promote or move personal work with a logged, reversible result.

**Acceptance.**
1. Create a private no-project task and custom section through My Tasks, then search/read its ID as owner, another member and an administrator’s ordinary session: only the owner succeeds.
2. Inspect default order using overdue, today, equal-date priorities, next-seven-day and no-date tasks; mark Today manually and compare with the stated tie breakers.
3. Advance local midnight across DST so due-tomorrow work promotes once, set a manual section rank, reconnect and verify persistence.
4. Adding the private task to a project requires a visibility preview and grants only the reviewed access.

#### PEG-032 — People leave without orphaning work

*Tier:* Core

**Requirement.** Member removal previews owned tasks, projects, portfolios, goals, approvals, rules, scheduled updates, connector custody and delegated agent work. A responsible administrator chooses a replacement or explicit unassignment for every set; concurrent changes invalidate the review. Access revocation is immediate, unsafe sends stop and historical authorship remains attributable or privacy-anonymized. Transfers never impersonate the departed person's approval.

**Acceptance.**
1. Remove a manager with active projects, queued sends and pending approvals through Admin.
2. Review each affected set, transfer work and inspect revoked sessions/keys, canceled old sends, new accountable owners and preserved history; a concurrently added assignment forces a fresh review.

#### PEG-045 — Identity lifecycle and access review

*Tier:* Core · *Cites:* BASE-SIGNIN-001

**Requirement.** Domain verification, invitation acceptance, group-to-role mapping, SCIM user/group change, guest lifecycle and organization ownership transfer have an explicit preview and permission-safe default. Deactivation cancels scheduled personal/agent authority and invalidates pending approval links; reactivation does not resurrect old tokens or share links. Admins can inspect and revoke third-party app grants and download an access review without exposing credentials. PEG-100’s pending access requests are part of deactivation and access review: reactivation never revives a prior request’s approval authority.

**Acceptance.**
1. Provision and move a user between IdP groups, map a restricted role, invite an external guest and inspect the access review.
2. Deactivate/reactivate the user, revoke an app and transfer installation ownership; old sessions, API/MCP keys, proof links and personal automations stay invalid until explicitly renewed.
3. Deactivate/reactivate a pending requester and revoke a pending approver, then refuse their stale access decisions and inspect the access review.

### Connections and public automation

#### PEG-025 — Calendars and task time blocks

*Tier:* Core · *Rules:* D-2 · *Register:* R-3

**Requirement.** Two-way Google Calendar and Outlook Calendar connections map task due dates and scheduled work blocks explicitly, respect free/busy permissions, work hours, timezones, holidays and locked meetings, and distinguish a deadline from effort reserved before it. Event moves update only the mapped task schedule under authorized change policy; provider edits never silently approve a team deadline change. Cancel, disconnect, recurring-event exceptions and concurrent edits reconcile with visible conflicts. Dial owns booking links. An optional read-only iCalendar/ICS subscription for My Tasks or selected project work provides stable UIDs, timezone/date-only semantics and update/cancel events, with an expiring revocable scope-bound capability whose URL is treated as a secret. Users preview exported fields; guest feeds stay within reviewed shares, and removing access stops further reads without claiming to erase events already cached by a calendar client.

**Acceptance.**
1. Through Calendars, schedule a task into free time on each provider using [Google event](https://developers.google.com/calendar/api/v3/reference/events) and [Microsoft event](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0) schema edges.
2. Move/delete the event, cross DST and simulate a simultaneous task edit; inspect exact mapping, preserved deadline, conflict state and one event after replay/reconnect.
3. Subscribe Apple Calendar and a second ICS client to a selected project/My Tasks feed, update a due date and cancel a task, then inspect stable UID and correct dates/cancellation without duplicates.
4. Revoke the feed/share, require failed later fetches and verify no hidden task/field or raw capability enters logs or archives; acknowledge previously cached client copies explicitly.

#### PEG-026 — The full integrations hub

*Tier:* Core · *Rules:* D-2 · *Register:* R-3, R-6

**Requirement.** Owners install, scope, configure, test and revoke Slack, Teams, Nook, Gmail, Outlook, Zoom, Google Meet, Google Calendar, Outlook Calendar, Google Drive, Dropbox, Box, OneDrive/SharePoint, Chest, Figma, Adobe Creative Cloud, Canva, GitHub, Jira, Vector, HubSpot, Salesforce, Orbit, Buoy, Gauge, Harvest, QuickBooks Time, Auth, Okta, Entra ID, Google identity, Zapier, Make, Crank, Tableau, Power BI, Pencil, Willow, Linen and HappyToHelp adapters. Each names supported directions/actions, required grants, data custody, app approval and current connection health; arbitrary workflow composition belongs to Crank. Integration cards cannot stand in for a working adapter. PEG-071 defines complete in-tool chat actions, feeds, notifications and Gmail/Outlook sidebars; PEG-077 adds Google Sheets, Loom, Miro, Zendesk, Freshdesk, Intercom, DocuSign, Calendly and YouTube/Google Docs embeds. Every added adapter follows the same installation, authority, health and qualification requirements, with its declared direction and handoff; it does not merge the sibling’s specialist job. PEG-080 owns the browser-only registration/distribution guide and measured 15-minute qualification for Slack, Teams, Google Workspace and Microsoft 365, with tenant-local apps/clients rather than a Run Edit Run shared OAuth broker. All connected subfeatures, pending provider approvals and member identity-link requirements are separately visible; one working Calendar scope cannot falsely enable Gmail/Drive or sign-in. PEG-085 additionally requires Run Edit Run-published native public Zapier/Make apps, guided per-installation scoped connections and ready-made triggers/actions/templates; generic webhook recipes alone cannot satisfy distribution.

**Acceptance.**
1. Install every named adapter through the hub and exercise its named job in PEG-007/008/016/017/021/025/039–045: source event/read → allowed Pegboard effect → provider acknowledgment or authorized return update.
2. Also execute Zapier, Make and Crank task-create/task-change webhook recipes and a Willow time-off update.
3. For each, record schema/sandbox or live-account qualification, denial, disconnect and reconciliation; no unchecked listing passes.
4. Qualify PEG-071’s chat and mail round trips and each PEG-077 service’s declared journey, including rejection/revocation/replay, rather than treating capture or an integration logo as sufficient.
5. Complete all four provider guides against official-schema network edges, then use each sign-in/chat/mail/calendar/file door required by PEG-080.
6. A disconnected subfeature explicitly names the missing connection and guide rather than presenting a nonfunctional control or silently dropping a chase.

#### PEG-080 — Guided owner-registered provider apps and connections

*Tier:* Core · *Rules:* D-2 · *Register:* R-3, R-7

**Requirement.** Settings → Connections guides the owner or an explicitly delegated integration Admin through separate Slack, Microsoft Teams, Google Workspace and Microsoft 365 registrations using the owner’s provider organization/accounts. It shows not connected, connecting, awaiting provider/admin consent, connected and needs attention per client and feature. For the chosen installation origin it generates exact authorized redirect URIs/JavaScript origins, request/event/interactivity/sidebar URLs, least-needed scope names with purpose, subscription/consent settings, complete manifests/packages and safe copy/open-console controls; no one hand-writes a manifest, invents a URL/scope or runs CLI code. Step-by-step links lead to the correct provider consoles and back to the saved guide. A provider-displayed client ID/secret or app configuration token may be copied once into a sealed field; actual access/refresh tokens are acquired in the browser OAuth code flow, encrypted at rest, origin/tenant/scoped and excluded from archives/logs. Guide progress survives reload and credentials can be rotated/revoked without losing work links. The page states who registers the client, which provider receives which data, grants/custody under PEG-021/065, and that no Run Edit Run-operated shared OAuth broker handles these connections. The mobile push relay is a separate service and never receives provider OAuth credentials or chat/mail/file content. Slack uses a buyer-owned Slack app created from the installation-generated manifest via the provider console or apps.manifest.create, then OAuth installation, request/event URL verification and a signed message/action test. Teams uses the buyer’s bot/Entra registration and generated Teams app package with installation messaging endpoint, scopes/valid domains and icons; the guide covers browser registration, tenant custom-app upload/deployment and a real bot/action callback. Google Workspace guides the owner through their Cloud project/consent and web OAuth client for Continue with Google, Calendar and Drive, plus deployment of the generated Gmail sidebar add-on into their authorized Workspace domain; exact generated redirect URIs/scopes and required publication/domain/internal-testing settings are shown, with no implied public Marketplace listing. Microsoft 365 guides Entra client registration and consent for Continue with Microsoft, Outlook Calendar and OneDrive/SharePoint plus the generated Outlook add-in manifest’s tenant deployment; Teams registration and deployment are explicitly linked but separately tested. Member-owned access uses a per-member Link account browser consent step after installation-level connection; a bot or tenant admin token never impersonates an unlinked member. Each feature is enabled only after provider credentials/grants validate and the owner completes its live round trip; denied consent, missing scope, bad callback, client rotation, blocked app policy or pending provider approval shows its precise cause and browser repair step. External provider review is not a success state or an excuse to drop an adapter. A non-technical authorized owner following each guide connects each of the four providers in at most 15 elapsed minutes from Open guide to successful live test, including required console/account/client/package steps and provider waits. Qualification includes a scripted walkthrough against fakes generated from the provider’s official app-registration/OAuth/event/add-on schemas and **one real live connection per provider**, recorded separately with timestamps/screen recording and redacted request/event evidence. Feature tests cannot be skipped because the broader tenant is connected; pending external approval or an exceeded time bar leaves that connection obligation unmet. The baseline PEG-055 installation remains usable while optional provider connections are pending, and the separate 15-minute clocks do not replace its 30-minute installation and PEG-115 AI bar. Every dependent surface—Continue with Google/Microsoft, Slack/Teams actions/unfurls, Gmail/Outlook sidebar, calendar sync/time blocks, Drive/OneDrive picker, mobile IdP sign-in and PEG-030’s per-channel chase job—names the missing or broken feature/connection and links to its saved guide. Blocked jobs stay visible without fabricated success, silent fallback to another channel or unapproved sends; reconnect retests and resumes only still-authorized deduplicated work.

**Acceptance.**
1. At 1440/390 a scripted browser-only walkthrough of each of the four guides against official-schema provider fakes completes within its 15-minute bar.
2. Begin without the provider apps/clients already registered and retain registration/package/consent and signed callback/test evidence without secrets.
3. After Slack setup, an invited member links their own account and comments/completes one task from Slack.
4. After Teams setup, install its generated tenant app and receive/act on a task notice.
5. After Google setup, an invited verified member signs in and uses Calendar, the deployed Gmail sidebar and Drive; after Microsoft setup, do the same for Microsoft sign-in, Outlook Calendar/sidebar and OneDrive.
6. Uninvited and cross-tenant identities are refused and member setup-management attempts are denied.
7. Disconnect each feature, visit every named dependent surface and trigger its chase/job, and verify the specific missing-connection guide state, no provider call or false successful job, ordinary work continuity and safe single resume after repair.
8. Repeat denied consent, bad redirect, missing scope, admin app-policy rejection, expired client and origin change without inventing success or restarting a duplicate registration.

#### PEG-102 — Google sign-in for outside guests

*Tier:* Core · *From:* PEG-080

**Requirement.** For Continue with Google, show whether this owner-registered client is Internal-only or configured/qualified for External users. An invited guest with a personal Gmail or another company’s Workspace account may use it only if that client admits the account and verified subject/email matches the existing invitation; external-client publishing/consent/verification is guided engineering work, not implied by internal Workspace setup. An Internal-only denial names that restriction without revealing membership and offers native email-link/passkey sign-in immediately; it never blocks an otherwise invited guest’s native access. Required external-user configuration and denied/test/unverified-app states are explicit and do not silently swap to a shared OAuth broker.

**Acceptance.**
1. Invite a Gmail guest and a guest from a second Workspace domain.
2. With an Internal-only client show the named restriction and complete native sign-in; configure/qualify External access through the guide and sign each into the same invited identity, refusing an uninvited/wrong-subject account.
3. Simulate Google publication/test-user/consent restrictions with official schemas and inspect recoverable native access, not a broken invite.

#### PEG-103 — Microsoft add-in deployment and propagation

*Tier:* Core · *From:* PEG-080

**Requirement.** Microsoft add-in deployment measures two visible timestamps: owner console/package work and actual add-in availability/live test. The existing 15-minute bar remains total elapsed time including provider waits, not a paused operator-only clock. If Microsoft’s documented propagation takes up to 24 hours for a new deployment (or longer update propagation), show Awaiting Microsoft deployment, submission/time/affected users and next check; no connected-sidebar or timed-pass claim is made until an actual client live test succeeds. Record active owner minutes separately for diagnosis. A pending propagation run exceeding 15 minutes leaves that timing qualification unmet, with the provider constraint explicit; it does not drop Outlook support, extend the bar silently or weaken a test.

**Acceptance.**
1. For Microsoft, measure a fast live connection against the original 15-minute wall clock; separately simulate an add-in unavailable for 24 hours after successful tenant submission.
2. Show pending propagation with owner-work and wall times, preserve ordinary work/native mail sign-in, perform the real sidebar test when it appears and record that this delayed run did not meet the 15-minute qualification.
3. Never count the submitted manifest alone as a working sidebar.

#### PEG-071 — Work inside chat and mail tools

*Tier:* Core · *Rules:* D-5, D-6, D-7

**Requirement.** Slack, Teams and Nook show permission-filtered task/project link unfurls with live status/freshness, personal My Tasks and cited status queries, comment/complete/reopen/assign/due-date controls and human proof approval tied to the exact version. Authenticated action callbacks map the actual human to a current Pegboard identity and recheck rights at execution; a bot token or channel membership alone grants no work authority. Project-to-channel feeds and personal assignment/mention/approval notifications follow configured audience scopes and preferences. PEG-093 rules post to a named internal channel or person under the internal notification policy (D-5); a fixed personal system notice to a current guest about shared work uses the reviewed share and guest preferences without another approval (D-6), while a client-shared channel or feed, an arbitrary guest post or an unknown audience waits for exact disclosure approval. A private chat recipient linked to a guest is not treated as a client-shared channel; it receives only the guest’s personal authorized notices. Sending any project feed to a shared channel still requires review even when all currently known guests have project shares. A refused private unfurl/deep link offers PEG-100’s no-leak member request door; connected chat request notifications and authenticated human decisions preserve exact scope/role and current delegation.

**Acceptance.**
1. In each installed Slack/Teams/Nook app, unfurl a task, list My Tasks, query a permitted project, comment, complete/reopen, assign and preview/apply a due-date change under current rights.
2. Link a project feed and receive one personal notification and one rule-triggered internal-channel post without per-message approval.
3. Human-approve PDF v2 in chat, replace it with v3 and refuse the old button/replay.
4. Revoke the actor and inspect refusal and non-leaking private unfurls.
5. Receive a fixed personal assignment/proof notice as a scoped guest without per-message approval in each configured chat adapter; remove the share and cancel a queued notice.
6. Under the held policy, an agent-composed guest chase waits for the test person’s approval, and a feed or rule post to a client-shared channel waits for exact review, even when the guest can see the source task.
7. Run PEG-100’s Slack refusal-to-request/inbox approval and Teams request/decision, compare guest/invalid/private-task refusals and reject replayed or unmapped decision callbacks.

#### PEG-104 — Gmail and Outlook sidebars and chat connection states

*Tier:* Core · *From:* PEG-071 · *Register:* R-3

**Requirement.** Gmail and Outlook installed sidebar add-ons create/search/link tasks from an open email with project, assignee, due date and chosen attachments. Explicit per-thread reply sync retains provider/thread/message IDs, a visibility preview, stop-sync and deletion controls; later replies become attributed source-message comments once, without automatically enrolling external authors as members. Owner app registration, tenant sidebar deployment and first live connection are PEG-080 requirements; ordinary members only link their own authorized account afterward. The Slack/Teams and Gmail/Outlook UI and sidebar entry points display a named missing-connection guide state until the corresponding feature test passes, including partial tenant consent or revoked credentials.

**Acceptance.**
1. In both Gmail and Outlook sidebars create a task from an open email with all mapped fields, enable reply sync, deliver/replay a later reply and see one source-attributed comment/attachment; stop sync, revoke mail access and verify no subsequent ingest or automatic external share.
2. Start with unconnected Slack/Teams/Gmail/Outlook and inspect explicit connection/guide states at each tool entry point and Pegboard action door; finish PEG-080’s guide and first live test, link a member account and perform the actual in-tool actions.
3. Revoke the client, keep the intended action visible as blocked and reconnect without a duplicate task/comment or disclosure.

#### PEG-085 — Published Zapier and Make apps for every installation

*Tier:* Core · *Register:* R-6

**Requirement.** Run Edit Run’s integrations/release lane builds, submits, publishes and maintains the official Pegboard integration in Zapier’s public app directory and the approved Pegboard app in Make’s public catalogue, including versions, support links and ready-made Zap templates/Make scenario blueprints. Provider review, account ownership, app verification and ongoing compatibility are Run Edit Run engineering obligations; an invite-only development app, private blueprint or generic Webhooks/HTTP module cannot satisfy public distribution. Each public app’s connection screen accepts the owner-run installation’s exact public HTTPS base address, displays/validates that product identity/API compatibility and uses a browser-guided scoped credential grant from that installation. API-key authentication is supported through PEG-027’s dedicated revocable automation credential: an authorized Admin opens Connections → Zapier or Make, selects only allowed projects/fields/actions, reviews access and generates a one-time display to paste into the platform’s secure connection field. An OAuth variant may use a documented per-installation client instead, but no shared Run Edit Run OAuth broker is required and no ordinary member password/provider secret is requested. The connection binds installation origin, credential sponsor and scope, with secure platform credential storage, no cross-installation token reuse/redirect forwarding, no private-network fetch target or arbitrary remote credential destination and no central copy of work content at Run Edit Run. The connection page states Zapier/Make’s processor/data custody and the owner’s current plan/task-credit requirements before consent. The native trigger/search/action catalogue includes new task, changed task/status/due date, completed/reopened task, new comment, find task/project by stable reference, create task/subtask, update permitted fields/date/assignee, add comment and multi-home to a permitted project. Dynamic permitted project/field/person selectors, sample output, schema/units and structured permission/validation errors replace handwritten payload/URL recipes. Templates cover form/Sheets request → task, new Pegboard task → permitted Slack notice, completed task → external record update and cross-tool comment/task follow-up, with selected mappings and no imported recipient authority. Triggers support scoped subscription or documented checkpointed polling with stable event IDs, deduplication and missed-event recovery; platform retries/out-of-order events, rate limits and reconnect cannot duplicate work. Searches/actions read and mutate only the current grant; human proof decisions and new access or disclosures keep their approval doors, AI and agent scheduling carries its class under the company’s policy, and a connected app cannot self-activate a Pegboard rule or impersonate a person. Existing Zapier/Make task-create/task-change webhook recipes remain additional public-API doors. The migration guide helps replace steps from supported project-management and board or workspace sources using mapped local IDs/fields, previews new recipes and tests them while inactive; switching providers never silently enables an old scenario or promises an impossible automatic transfer of third-party ownership/plan entitlement. Platform plan charges/task credits, premium classification and polling intervals are shown as actual published provider terms under PEG-061, not an unsupported promise of a free tier. General cross-app orchestration stays with Zapier/Make or Crank.

**Acceptance.**
1. Create a native Pegboard connection to each of two separate owner-run installations through its address plus the scoped credential guide.
2. A buyer writes no generic webhook URL, custom JavaScript or JSON payload for the native cases.
3. From published templates/blueprints, map a Google Sheets/form request into one task, react to its change/completion into one permitted Slack/external record update and add a comment/subtask through each platform’s native modules; exercise every listed trigger/search/action with source IDs and a limited project/field set.
4. Use official-schema platform/network fakes for throttle, polling checkpoint gap, duplicate/out-of-order delivery, lost acknowledgment and restart.
5. Revoke/rotate credentials and show an actionable failed/reconnect state, preserve event watermarks and resume each still-authorized effect once.
6. Refuse a hidden project/field, wrong installation, unsafe base address, redirect to another origin and unauthorized share/proof decision; under the schedule-approval policy an AI-produced date action waits for exact approval.
7. Rebuild representative inactive source-platform workflows in Zapier and Make using PEG-046/081’s mapped local IDs, compare trigger/field/output mappings and activate only by the authorized buyer’s explicit action.
8. Compare actual required platform plans/classification/task credits with the estimate; a private/unapproved app or generic Webhooks/HTTP workaround leaves this distribution clause missing.

#### PEG-027 — Public API, events and MCP

*Tier:* Core · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-004, BASE-AGENT-012 · *Register:* R-9

**Requirement.** A documented versioned REST API exposes permitted work CRUD, views/search, project/portfolio/goal reporting, time, approvals, import/export and automation configuration with pagination, concurrency checks, idempotency and structured errors. Signed webhooks offer subscriptions, event IDs, replay and delivery history. An MCP server lets Claude, ChatGPT, Gemini, Cursor and other compatible external agents use the same user/bot permission model, with declared tools and the risk classes each tool can carry (SURFACE-001). API/MCP resources also cover personal tasks/sections, tags, cross-project views, announcement threads, custom task references, duplicate-merge previews and custom-agent definitions under their exact human/agent permissions.

**Acceptance.**
1. Using the published OpenAPI and MCP doors, create/update a task, paginate a project, read a report and receive a signed task event.
2. Connect each named client, deny out-of-scope access, stale edits, expired credentials and forged webhooks; replay a valid event without duplicate effects and refuse an agent attempt to approve itself.
3. List a personal task as its owner and deny the same ID to an administrator’s ordinary key; try a guest-editor mutation and Viewer comment, proving transport-independent permission results.

#### PEG-038 — Connector failures are recoverable work

*Tier:* Core · *Cites:* BASE-OPS-004

**Requirement.** Connections show last success, freshness, required permissions, cursor, failed object and actionable owner. OAuth refresh/rotation, webhook verification, backfill, polling gaps, provider rate limits and schema changes preserve stable source IDs and causal order. A durable outbox separates local commit from external delivery; proven-unaccepted requests may retry, ambiguous submissions reconcile before retry. Reconnection repairs missed changes with a preview when overwrites or external sends would occur. Connection health includes provider-app identity, consented subfeatures and the current generated installation origin; a changed origin/secret requires guided provider callback/package repair and retest before dependent actions resume, without discarding existing source IDs or member links.

**Acceptance.**
1. Through an installed connector, create work while its provider returns 429, later 401 and then loses a response; restart Pegboard, reconnect and replay events out of order.
2. Inspect visible health and exact per-object outcomes, one intended effect, retained later edits, no leaked credential and no false delivered state.
3. Change the installation origin or rotate a provider client secret during a timed-setup fixture, repair exact callbacks/manifests through the saved guide and require a new live event/test before connected status.
4. Preserve source links and queued action identity, and expose unresolved provider-policy failures.

#### PEG-040 — Engineering handoff without a second issue tracker

*Tier:* Core · *Register:* R-3

**Requirement.** A business task links to existing or explicitly requested Vector or Jira issues and GitHub issues and pull requests with stable external IDs, backlinks, owner/status mappings and sync direction. Engineering cycles, code reviews and release flow remain in Vector and the code host. An engineering closure updates the linked business indicator but does not automatically satisfy business acceptance or approve a launch. Only an owner or administrator links an engineering source; its context stays private to the authorizing administrator, reading and each outbound write need their own exact consent, and no outbound authority outlasts that consent (RL-6).

**Acceptance.**
1. Link one campaign dependency to each of Vector, Jira and GitHub, update its source status and reconcile it in Pegboard, then return an authorized mapped update.
2. Deny an unmapped closure, revoke a source grant and replay the event; retain one link, visible stale state and a still-pending human launch approval.

#### PEG-041 — Commercial and service work becomes delivery

*Tier:* Core

**Requirement.** Won Orbit, HubSpot and Salesforce deals, selected Buoy customer-success milestones and Linen/HappyToHelp ticket escalations can create a delivery project from an approved template with owner, client share preview, due expectations and source backlink. Configured status/milestone updates return to the source, with explicit human approval for customer-visible content. CRM, account health and ticket SLA state remain at their source; reopened or duplicate events cannot duplicate projects or erase the original commitment.

**Acceptance.**
1. For each of the six source products, deliver a qualifying event through its authorized schema edge, review/adopt one project and return a permitted delivery-status update.
2. Replay, reopen, decline the handoff and fail the return write; inspect one project, source identity, restricted customer fields and accountable unresolved exception.

#### PEG-042 — Reconciled time handoff to specialist systems

*Tier:* Core · *Register:* R-3

**Requirement.** Gauge, Harvest and QuickBooks Time adapters map people, projects/tasks/job codes and approved duration entries with external IDs, approval state and adjustment provenance. Buyers preview exact totals, mapping gaps and exclusions, choose the system authoritative for each field and reconcile acknowledgments, rejection and later corrections. Pegboard never fabricates billable rates, invoices, margin or payroll authorization; Gauge owns those economics. For PEG-107’s source timesheet and budget module handoff, route exact source budget/rate/billable/currency/effective-date artifacts to Gauge’s reviewed move-in/mapping process (RATE-001/002, BUDGET-001 and economic reconciliation), with stable Pegboard task/person/time links and per-type acknowledgments or named pending mappings. No Gauge API capability or automatic finance approval is presumed; unsupported source-shaped rows remain inert for explicit mapping/import work, not a fabricated completed transfer. A current owner or administrator with access to every linked entry sends the exact reviewed packet; the provider credential serves only that send and is never stored, each entry is claimed before the send with a stable external identity, nothing is retried blindly, an uncertain row is read back from the receiver before any separately authorized write, and an approved adjustment corrects only the exact prior total the receiver holds (RL-101).

**Acceptance.**
1. Export an approved timesheet to each named service using its official schema/sandbox, including [QuickBooks Time's official API reference](https://github.com/TSheetsTeam/api_docs).
2. Reject an unknown job code, fix its mapping and resume; replay and adjust an entry and verify one acknowledged entry plus a traceable correction, exact hours and no invoice or payroll action.
3. Using Gauge’s actual public reviewed import/API door or its official-schema edge, map the project-management source handoff into finance drafts and compare exact amounts, currencies, dates, billable flags and frozen approved-time provenance.
4. Receive per-type IDs/acknowledgments, replay without duplicates, refuse unsupported mappings visibly and retain the full pending/exportable packet until repaired; no invoice or new approved budget is issued.

#### PEG-043 — File and creative-tool continuity

*Tier:* Core · *Rules:* D-2

**Requirement.** Google Drive, Dropbox, Box, OneDrive/SharePoint and Chest file pickers attach stable source IDs and versions with permission-aware previews. Figma and Canva designs and Adobe Creative Cloud panels connect briefs, task updates, assets and review results; approved exports enter version-bound proofing. Source deletion, permission change and version replacement remain visible without granting file rights. Native attachments meet PEG-082’s explicit 100-MB per-file bar and PEG-091’s resumability and Base R2 custody on every ordinary upload path; forms have the separately stated 25-MB/75-MB limits. Pegboard is not a file-sync drive; larger assets use linked providers, including Google Drive and OneDrive. A project Files tab lists the currently permitted attachments and proof versions across its tasks, with task/source/version links, filters and an explicit unavailable-source state. It deduplicates the same source version while preserving task associations and never shows internal-only filenames, counts or thumbnails to a guest. All native, imported and linked file versions keep distinct custody/source labels; PEG-082 and PEG-091 are mandatory for native/uploaded bytes and proof revisions.

**Acceptance.**
1. Through each named file provider, attach a permitted file, deny an unauthorized file and replace/revoke the source.
2. Through Figma, Canva and an installed Adobe panel, open a brief, submit an asset and read its review result.
3. Inspect exact version and return update, no broadened share and a clear unavailable state after revocation.
4. Open Files on a project with multi-task attachments, two proof versions and one internal-only asset; inspect one entry per permitted source version and its task links, filter/open the proofs and compare member versus guest counts and denied-source states.
5. Complete PEG-082’s upload/provider-link refusal and PEG-091’s Base R2 round trip, then compare permitted Files entries and version digests.

#### PEG-077 — Agency and operations service handoffs

*Tier:* Core · *Rules:* D-2

**Requirement.** The hub includes Google Sheets live task/project/portfolio export with field selection, read-only sync direction, refresh watermark, deletion markers and permission-filtered snapshots; spreadsheet edits do not silently change source work. Loom/YouTube video, Google Docs and Figma rich embeds in briefs/descriptions/comments retain source access, accessible links and explicit source-version/freshness labels. Miro board/card links and authorized selected-note-to-task handoff preserve backlinks without rebuilding Miro. Zendesk, Freshdesk and Intercom ticket escalation creates/links one business task/project with a reviewed field/audience mapping and returns permitted progress as source internal notes; ticket/customer reply/SLA authority stays at the help desk. DocuSign handoff prepares a reviewed envelope request or links an existing envelope and records verified signed/declined/voided events and artifact references; Pegboard never substitutes a task approval for a legal signature or sends an envelope without a person’s exact approval. Calendly booking/cancel/reschedule events link preparation/follow-up tasks and reconcile the existing calendar event; booking links/scheduling stay in Calendly or Dial. These are required target adapters, delivered directly or through a documented configured Crank/Zapier/Make connector with equivalent custody and observed outcomes; no native-incumbent availability is assumed.

**Acceptance.**
1. Install each service and use its actual supported sandbox or official-schema edge: refresh a three-project Google Sheet after edit/deletion and revoke its grant; view/revoke each named embed; create a task from a selected Miro item and follow its backlink; escalate/replay a ticket from each of Zendesk/Freshdesk/Intercom and return one internal progress note.
2. Human-approve one DocuSign envelope handoff, verify signed/declined/voided events, reject a forged event and leave an unapproved send pending.
3. Process Calendly booking/reschedule/cancel without duplicate tasks or calendar events.
4. For every service inspect denied scope, source deletion/revocation, unavailable state and reconciled outcome; external disclosure never bypasses recipient review.

#### PEG-044 — BI without private-data shortcuts

*Tier:* Core · *Register:* R-3

**Requirement.** Tableau and Power BI connectors provide documented, paginated task/project/portfolio/goal, time, request and approval datasets with stable IDs, relationships, units, report definitions, incremental sync and deletion markers. An analyst key sees only allowed records/fields; snapshots and refresh watermarks expose stale data. Work exports and scheduled reports match these definitions rather than producing conflicting totals. An owner or administrator issues each analyst key for explicitly reviewed projects and fields under their current authority; keys expire within thirty days and snapshot fetches within twenty-four hours, new reads stop at once when the issuer’s, scope’s or key’s authority ends, and a key grants no outbound or product write (RL-103).

**Acceptance.**
1. Connect each BI tool using its supported connector protocol, build a three-project report and compare exact counts/durations with the same Pegboard snapshot.
2. Incrementally update and erase a task, refresh and inspect removal, then revoke the key and deny hidden fields and cached new fetches.

### Everyday assistant and configuration

#### PEG-074 — Ask, summarize and use AI in rules

*Tier:* Core

**Requirement.** An in-app assistant answers work questions using only the current user’s permitted tasks, comments, project/portfolio/goal state and authorized references, with clickable record/excerpt citations, covered time window and freshness; hidden or missing context stays unavailable and never leaks through an answer or source list. On-demand task/thread/project/portfolio summaries and date-bounded status drafts expose decisions, blockers, actions and source evidence. Users edit/reject/accept drafts before publication. PEG-012 offers no-code classify, extract, summarize, draft and custom-prompt AI steps with schema-bound outputs, allowed dropdown values, explicit input selection, model/provider/cost limits and a preview. Run logs retain the permitted input references, definition/model versions, output, validation/error and applied effect; malformed/unjustified outputs stay failed/pending without invented values. AI steps obey the same scope and are decided by the same company policy as other agents (SURFACE-002). An AI-produced date/assignee or AI-selected template/routing that determines them retains AI provenance across later rule steps; deterministic rule activation cannot supply approval for those generated commitments.

**Acceptance.**
1. Through Ask, query “what’s blocking the launch?” as a limited member, summarize a 60-comment task thread and a date-bounded project/portfolio, and compare each answer’s factual claims/citations with only authorized rows.
2. Deny a named private project and remove access mid-request; output and retained answer reads must exclude revoked data.
3. Create an AI rule step that classifies a known intake request into an allowed dropdown, extracts a date and drafts a comment; inspect input/output logs and one permitted application.
4. Return an out-of-schema category or injected approval instruction from the model edge and inspect visible refusal without extra writes or disclosure.
5. An ordinary summary or status draft is never published to clients or executives as a side effect; publishing it is a separate external call.
6. Under the schedule-approval policy, extract a date and choose a routing/template with AI, feed each into a later deterministic step and see it wait for exact schedule/assignment approval before applying; a fixed non-AI rule in the same fixture applies immediately under its reviewed activation.

#### PEG-105 — No-model and failed-model states

*Tier:* Core · *From:* PEG-074

**Requirement.** All AI entry points share the connection state established in PEG-115: Ask, task/thread/project/portfolio summaries, status drafting, AI rule-step builder/run log, and native/custom agent teammates, planning, coordination and capacity surfaces show “No AI model connected” with an accessible Connect model link when setup skipped AI or the model is disconnected. Background rules/agents are visibly blocked with that same reason and a resumable pending job, never marked successful or completed. Invalid/revoked credentials, service unavailability and budget/custody failures show a named AI-unavailable cause and browser recovery link; secret values are excluded and no automatic substitute processor is used. On reconnect/retest, only currently authorized deduplicated work resumes; ordinary work and non-AI rules/notices continue throughout.

**Acceptance.**
1. On the explicit no-AI installation, visit every named entry point at 1440/390 and invoke its public API/job door: inspect the exact no-model message and connection link, structured blocked reason, zero inference calls, no invented output and retained pending work.
2. Revoke a working model credential, invoke Ask, a summary/status draft, an AI rule step and assigned teammate, and inspect visible recoverable failures with ordinary task/edit/guest-notification journeys still passing.
3. Reconnect through the link, pass a live test and resume once with current scope, logged model/budget and no duplicate task change or send.

#### PEG-075 — Define and govern a custom teammate without code

*Tier:* Core

**Requirement.** Authorized project/team Admins use a no-code editor to name an agent, version its instructions, attach permitted knowledge sources/style guides, select tools/model/provider, define assignment/event/schedule/rule triggers and set output schema, rubric and stop and budget limits; what its calls do alone or wait for is the company’s policy. It previews effective credential/data scope and sample permitted input/output before activation; a knowledge URL, prompt or trigger cannot grant permission. Changed instructions or knowledge access are versioned and re-reviewed for activation, with old in-flight runs fenced from new authority. Triggers deduplicate and loop-protect through PEG-012/063; disable immediately stops new work and reaches running tasks through PEG-062 cancellation. The definition editor and teammate task/run pages expose PEG-105’s no-model or named AI-unavailable state and browser Connect model/retest link. An authorized administrator may save a disabled definition without AI, but activation/paid execution is blocked until a current model test and budget/custody checks pass; a saved draft does not simulate a successful dry run.

**Acceptance.**
1. As Admin, build a marketing-copy teammate with named style knowledge, allowed task/comment tools, assignment and scheduled triggers, a PEG-028 rubric and cost cap; dry-run with the actual configured model edge, review and activate it.
2. Trigger one task from assignment and one rule, replay the trigger and inspect exact versioned inputs, output and cost/action log.
3. As Editor attempt instruction/trigger changes and refuse them; revoke the style source, change the instructions, disable mid-run and verify no new out-of-scope read, paid action or stale-version write.
4. Choose “continue without AI,” save a disabled custom teammate and attempt dry-run/activation: inspect “No AI model connected,” the connection link and no paid call or task mutation.
5. Connect/retest a permitted model, then explicitly activate and run the same version with observable usage; revoke its credential and inspect the named recoverable blocked state.

### Migration and cutover

#### PEG-024 — Migration as a complete buyer journey

*Tier:* Core

**Requirement.** Importers for project-management source, board-centric source, workspace-and-list source, kanban-board source, creative-work source, grid-based source, calendar-scheduling source, product-planning source, project-and-workflow source and CSV provide upload or authorized source extraction, saved dry-run, field/status/person/dependency mappings and a fidelity report. Source identities, timestamps, history and attachment custody stay explicit. Missing source data is named and recoverable by source API or authorized supplemental files where available; it is never invented or silently dropped. Imported shares, rules, recurring schedules, agents and sends start inactive. The whole-account project-management source path is PEG-081: browser OAuth and streamed whole-account API extraction on plans below the highest enterprise tier, not a required organization export, CLI or manual per-project export. Existing JSON/CSV/saved-export doors remain available as additional importer paths rather than prerequisites. PEG-109 and PEG-112 also require complete board-centric source and workspace-and-list source account-scale browser-authorized extraction and 300-container/125-person/10-GB reconciliation, not just one campaign or a task CSV.

**Acceptance.**
1. Through Import, ingest a real authorized project-management source export augmented with official-schema API data for comments/files and compare sections, custom fields, dependencies, comments and attachments.
2. Inspect per-record failures and unmapped data, apply once, re-import and undo without removing later native edits.
3. Complete every source-specific journey below before claiming migration parity.
4. Alongside the retained file-import cases, have the non-technical owner start the whole-account project-management source API job in PEG-081, approve its estimated scope/time, interrupt/resume it and complete account-wide reconciliation and the reviewed invitation/delta cutover.
5. Complete both PEG-109/112 full-account fixtures in addition to their retained export/small-source journeys.

#### PEG-046 — project-management source account migration

*Tier:* Core

**Requirement.** Move teams/projects/sections, tasks/subtasks, multi-homing, field library, dates, dependencies, milestones, comments/attachments, followers, approvals, recurring definitions, portfolios, goals and supported status/time history using JSON/CSV plus authorized API extraction. Keep source users as attributed identities until mapped to local members, and preserve unsupported rule/template details as inert source context with a rebuild path. Documented JSON/CSV export availability and limitations are part of the fidelity report. The migration checklist explicitly counts tags/tag memberships, branching form definitions, project briefs/Overview/key resources, project/team Messages and replies, task templates, saved searches/views, reports/dashboards, My Tasks private tasks/sections and per-member Admin/Editor/Commenter/Viewer levels plus guest editor/assignee shares. Each record is migrated, translated or held inert with source identity, artifact and a concrete rebuild path; a source API limitation is a named unresolved cutover item. Personal exports apply only for their authorized source owner, and inactive staged shares retain exact source grant paths for review. Source app.project-management source.com task/project URL aliases are retained after cutover: pasting a known migrated source URL in search or the migration resolver opens its mapped local record only for a currently authorized user. Ambiguous/unmapped URLs show a specific repair item to authorized migration administrators, never a guess or an unauthorized existence leak.

**Acceptance.**
1. In Import this project-management source, migrate a campaign already in approval and a 20-project portfolio from real export and official-schema paginated source reads.
2. Compare identity counts, shared tasks, dates, custom fields, dependency graph, author/time history and file digests; source export omissions appear in the fidelity report and block an unqualified complete-cutover decision.
3. Migrate a project-management source project containing tags, branching intake, a brief and key resource, Messages/replies, a task template, saved search/chart, My Tasks sections and Viewer/Commenter/guest-editor grants.
4. Compare per-type/source-ID counts for every listed item; each is mapped or appears in an explicit counted rebuild item, and no form/share silently disappears or activates.
5. Paste migrated project-management source task/project URLs through search and the public resolver door, including a multi-homed task, and reach the correct local ID.
6. Repeat as a restricted guest and refuse without revealing hidden names; an unmapped URL yields the authorized repair item without creating work.

#### PEG-106 — project-management source whole-account scope and privacy settings

*Tier:* Core · *From:* PEG-046

**Requirement.** Whole-account switching is mandatory at PEG-081’s 300-project/125-person/10-GB scale using browser OAuth and API enumeration even when organization-export endpoints are unavailable to the source plan. It includes active and archived projects and the full available source types named here, with source-authorized private-data collection and explicit unresolved access/custody/rebuild items. A 20-project portfolio or per-project export alone cannot satisfy the whole-account obligation. The fidelity checklist includes team privacy (Public to workspace, Membership by request, Private), project visibility (Private to members, Team only, Shared with workspace), their default levels, join/approval policies and direct/team/guest granting paths. Source settings are staged for PEG-101 review; a missing setting is a named repair item, never guessed public.

**Acceptance.**
1. Run PEG-081’s authorized source-plan account fixture through the browser in addition to this 20-project/export journey; reconcile every source type and file digest across 300 active/archived projects, 85 members and 40 guests, then apply an edited-source delta and reviewed bulk member invitations without silent shares/sends.
2. Add all three team privacy types and all three project visibility levels with mixed defaults to both source-export and PEG-081 fixtures; reconcile source settings and staged/effective grant paths, then repeat PEG-083 and PEG-100 discovery/join/request checks after reviewed cutover.

#### PEG-107 — project-management source rule authors and finance artifacts

*Tier:* Core · *From:* PEG-046

**Requirement.** Rule-author identities and their source roles are counted separately from active Pegboard configuration authority. Provide PEG-012’s Ask your project Admin and staged per-project Admin review; source authorship never silently grants Admin. source timesheet and budget module time, approval and billable/non-billable provenance join PEG-017/042’s hours reconciliation; budgets, effective-dated bill/cost rates, rate cards and monetary actuals are retained as finance-restricted inert source artifacts and handed to Gauge with source identity/currency/period, never activated as a Pegboard monetary ledger. A missing source field or disconnected Gauge is a counted repair/pending handoff, not a dropped economic record or an implied budget migration success.

**Acceptance.**
1. Import rule-author/Editor metadata plus approved time, billable flags, rates and a USD project budget.
2. Compare hours/approval/source IDs in Pegboard and exact financial artifacts in the restricted handoff, review project-Admin elevation separately and reject unreviewed activation.
3. A non-finance guest cannot read amounts; when Gauge is unavailable the manifest stays pending with counts and an exportable repair packet.

#### PEG-081 — Whole-account project-management source extraction

*Tier:* Core · *Register:* R-7

**Requirement.** The non-technical owner starts Settings → Migration → project-management source, follows a saved browser guide to register their installation’s own project-management source OAuth client with exact generated HTTPS callback/scopes, and authorizes the selected source organization through browser OAuth. Any provider-displayed app client secret is sealed once; the buyer never copies a personal access/access/refresh token, runs a CLI or manually exports individual projects. Source tokens are obtained/refreshed server-side after the browser grant, stored encrypted, excluded from logs/archives and revoked on disconnect. The guide makes the app ownership, source role/plan, permitted object types, unavailable permissions and scope explicit. The migrator enumerates the complete active and archived account graph available under authorized source membership, including projects/sections/tasks/subtasks/multi-homing, people/guest grants, fields/tags, dependency/time/approval/comment/message history, portfolios/goals and attachment provenance, plus all PEG-046 mappings or counted rebuild items. It detects source access gaps and offers browser reauthorization/requests to the proper source owners; it never calls an incomplete authorized subset the whole account or silently invents private records. The necessary source authorizations are engineering work, not an exemption from account completeness. Before work starts, a saved preflight shows account/object/byte counts or clearly labeled scan estimates, plan/rate assumptions, expected request volume, staged storage/cost, throughput assumptions and an elapsed-time range. Durable background extraction checkpoints page cursors/source IDs, scanned data revisions and byte/object progress, survives token refresh and process interruption, and resumes without re-reading/creating completed effects unnecessarily. Scheduling respects the actual provider token quotas and Retry-After, including paid-domain 1,500 requests/minute, at most five concurrent duplicate/instantiate/export jobs per user where such endpoints are used, search and request-concurrency/cost limits, and shared source-account activity; workers cannot evade throttles by switching unapproved tokens. Non-Enterprise+ extraction uses ordinary authorized paginated APIs, never requires the highest-enterprise-tier-only organization-export service-account route and remains complete when that endpoint refuses. Attachments are streamed into owner-controlled US storage with byte counts/content digests and source/version identity while download URLs are valid; expired URLs are reacquired from the authorized source and failed/forbidden/missing blobs are named unresolved custody items with a repair action, never replaced by an empty file or called migrated. Data extraction/metadata and file-byte progress remain separate. Actual completed requests, source rates, throttled time, retries, transferred bytes, transfer rates and elapsed time are reported against the displayed estimate, including interruptions and revised estimates; raw token-bearing file URLs never enter public reports. Attachment bytes use PEG-091’s Base-registered R2 buckets; a migrated file up to 100 MB is eligible for PEG-092’s ordinary proof-v2 upload.

**Acceptance.**
1. The PEG-055 non-technical tester uses only browser setup/OAuth to migrate an authorized source account on an authorized plan or an official-schema network-edge fake with at least 300 active/archived projects, 85 members, 40 guests, multi-homed tasks, portfolios/goals, multi-year comments and at least 10 GB of actual streamed attachment bytes.
2. The fake rejects Enterprise+ organization export, enforces 1,500/minute token quota, five-job limit where relevant, documented search/read/write concurrency limits and 429/Retry-After, and includes expired cursors/token refresh/expiring attachment URLs; retain a separate scheduler case that reaches the five-job boundary even if the main path uses no export jobs.
3. Show the owner a preflight estimate, pause/interrupt the actual extraction and receiver, resume after restart and compare per-type IDs/counts, graph edges, identity/permission mappings and every stored file’s digest/byte count across the full account.
4. Fail one blob, inspect named unresolved custody, reacquire/repair it and reconcile before success; a declared Content-Length or synthetic metadata counter cannot substitute for transferring/digesting the 10-GB corpus.
5. Record screen/timestamp evidence, measured requests/bytes/rates, retries/throttled time and total elapsed versus the saved estimate; require accurate unresolved status or estimate-overrun explanation rather than an unmeasured speed claim.
6. Upload a migrated exact-100-MB file as proof v2 through PEG-092 and require fresh current-version review.

#### PEG-108 — project-management source accountable cutover and bulk invitations

*Tier:* Core · *From:* PEG-081 · *Rules:* D-10

**Requirement.** PEG-054’s final delta, fidelity reconciliation, inactive authority and conflict-preserving rollback operate across the whole account. Cutover includes reviewed mapping and bulk invitations for source members and guests: preview exact local identities, email recipients, roles/project scope and existing-account matches, select/approve the batch with one auditable current decision per invitation, then send only those reviewed invitations once. New records are not silently invited by importing them. Existing active members are matched rather than duplicated; a changed address/share invalidates that invitation’s review and preserves other approved rows. Every available source type and all attachment digests must reconcile, with unresolved items counted and repaired or explicitly accepted as named losses before cutover; accepted loss does not become a claim of lossless migration. Source rules, proof decisions, bot scopes and share capabilities never become new execution/approval authority. source team privacy types, project visibility/default access levels and direct/team/guest grant paths join the enumerated account fidelity report and staged-setting review under PEG-101.

**Acceptance.**
1. Edit source records/files/permissions and native work during a delta pass, inspect conflicts and updated totals and complete or roll back the reviewed cutover without lost native edits or repeated effects.
2. Review and bulk-invite 85 mapped members plus chosen guest shares, compare one decision/delivery per invitation, skip matched members, reject a changed-address row and prove unreviewed identities receive nothing.
3. Include every project-management source team privacy/project visibility type with mixed default roles and source grants across the 300-project account.
4. Compare settings/counts before review and effective discovery/default access after approved cutover; no private team/project becomes discoverable inadvertently.
5. Run PEG-121’s 125-person mail-capacity queue at this source’s reviewed cutover, including one suppressed address, a corrected/re-reviewed row, provider throttle and restart; reconcile each invitation to one accepted or visible failed outcome with no unreviewed send.

#### PEG-047 — board-centric source account migration

*Tier:* Core · *Rules:* D-12

**Requirement.** Move workspace/board/group/item/subitem work, columns/statuses, people, connected-board references, dates, updates, files, dependencies, views, dashboards and supported time/automation definitions. Use authorized account exports/API augmentation; a single-board spreadsheet export alone omits view behavior and some updates, which the report must name. Formula and mirror definitions are translated or held explicitly for human repair.

**Acceptance.**
1. Migrate an active multi-board campaign with subitems, cross-board links and private client work.
2. Inspect mapped values, supplemental updates/files, reconstructed dependencies and reconciled board/dashboard counts; repeat after source changes and retain one mapped record with conflicts and source-only omissions visible before cutover.
3. Include labels, a form, brief, saved view/report and mixed member/guest grants in this source migration fixture; compare per-type counts and reconstruction decisions, inspect every held item and require a resolved or explicitly accepted loss before cutover.

#### PEG-109 — board-centric source whole-account extraction

*Tier:* Core · *From:* PEG-047 · *Rules:* D-11 · *Register:* R-7

**Requirement.** Use documented export or API guidance and its current supported token lifecycle. Enumerate board pages with archived/all state and item cursors without assuming documented export or API guidance enumerates archived items. Where archived IDs are not API-enumerable, provide a guided, authorized read-only capture of the source archive listing through Pegboard’s browser companion, saved with source identity/watermark, then use supported ID-based reads; it never unarchives or changes source work to make extraction easier. Account exports can supplement custody but documented export or API guidance, so they cannot establish complete extraction. Any inaccessible archived work remains an explicit blocking inventory/repair item until collected or accepted as a named loss. Respect the selected plan’s documented daily/minute/concurrency/complexity/IP limits and retry_in_seconds/Retry-After under documented export or API guidance; no unapproved token rotation evades quotas. No per-board export or source unarchive is required.

**Acceptance.**
1. In addition to the retained smaller fixture, a non-technical tester completes browser OAuth and a full source-account run at 1440/390 against an authorized source account or official-schema network-edge fake, with at least 300 active/archived work containers, 85 members, 40 guests, multi-year comments/history and at least 10 GB of actually transferred/digested file bytes.
2. Show/save the preflight estimate; throttle requests, expire a credential/file URL, interrupt extraction and the receiver, restart/resume, repair a failed blob and compare every type/ID/count, edge, identity/permission/time total and stored file digest across the account.
3. A metadata-only 10-GB counter cannot pass.
4. Record measured requests/bytes/rates, throttle/retry time and elapsed versus the saved estimate and explain overrun/unresolved work honestly.
5. For board-centric source the 300 containers are boards spread across multiple workspaces, including private/shareable and archived boards, archived items/subitems, connected-board links, formula/mirror definitions, updates/files and dashboards.
6. Include more than one item page and board page.
7. The fake enforces the documented Pro plan daily/minute/app-token complexity/concurrency limits and retry timing, active-only source paged-item endpoint behavior and separately authorized archive-list capture plus official ID reads; a separate live authorized archive-list capture proves the browser door without fabricated archive APIs.
8. Require archived source IDs/bytes and mixed source grants in reconciliation, with missing archive capture visibly unresolved rather than silently skipped.

#### PEG-110 — board-centric source cutover, delta and invitations

*Tier:* Core · *From:* PEG-047 · *Rules:* D-10, D-11

**Requirement.** A board-centric source cutover repeats its delta, reviews its member and guest invitations and paces its mail under D-10 and D-11, with PEG-054’s reviewed conflict-preserving rollback.

**Acceptance.**
1. Change source records/files/grants and native work during a repeat delta; inspect conflicts and complete or roll back without losing native changes or replaying effects.
2. Review/invite 85 mapped members and 40 chosen guest shares once, skip matched locals, invalidate a changed address/role and prove unreviewed rows receive nothing.
3. Run PEG-121’s 125-person mail-capacity queue at this source’s reviewed cutover, including one suppressed address, a corrected/re-reviewed row, provider throttle and restart; reconcile each invitation to one accepted or visible failed outcome with no unreviewed send.

#### PEG-111 — board-centric source multi-assignee workload

*Tier:* Core · *From:* PEG-047 · *Rules:* D-13

**Requirement.** Board-centric source items with several assignees keep every person, their source identities and the source’s Split or Sum workload semantics under D-13.

**Acceptance.**
1. Add a multi-assignee source fixture, select the one accountable owner and preserve every remaining person/ID as a scoped collaborator/allocation.
2. Exercise PEG-016’s source 10-hour Split (5/5) and Sum (10/10), and workspace-and-list source 3/7 estimates on a shared task.
3. Compare every person/week total, task estimate/count and membership edge with the source-defined semantics, re-run without duplicates and inspect an explicit allocation-repair item when the source setting is absent.
4. No source assignee is lost or silently invited and a changed interpretation cannot be called an exact workload match.

#### PEG-048 — workspace-and-list source workspace migration

*Tier:* Core · *Rules:* D-12

**Requirement.** Move spaces/folders/lists, tasks in multiple lists, subtasks, custom statuses/fields/relationships, dependencies, goals, comments, files, time entries and supported dashboards/templates/automations. Project briefs/task-linked planning content migrate into equivalent Pegboard context; independent wiki documents and chat are handed to Slate/Nook with links and an explicit content report. Use supported workspace exports and authorized APIs/files to fill export gaps.

**Acceptance.**
1. Migrate an agency workspace with a shared-list task, approved timesheet, private asset and linked document/whiteboard.
2. Compare IDs, nesting, status history and time totals, verify attachment bytes or named unresolved custody, and inspect the reviewed Slate/Nook handoff without granting imported guest access.
3. Include labels, a form, brief, saved view/report and mixed member/guest grants in this source migration fixture; compare per-type counts and reconstruction decisions, inspect every held item and require a resolved or explicitly accepted loss before cutover.

#### PEG-112 — workspace-and-list source whole-account extraction

*Tier:* Core · *From:* PEG-048 · *Rules:* D-11 · *Register:* R-7

**Requirement.** Use browser OAuth to select authorized workspaces and enumerate spaces, folders, folderless lists and nested lists, including archived variants. Traverse paginated task API reads explicitly, including archived/closed tasks, subtasks and tasks in multiple lists; preserve one task identity plus every list relationship rather than relying on narrower endpoint defaults. Honor the source workspace plan’s per-token rate limits, 429 responses and X-RateLimit reset/remaining/limit headers; source visibility and provider-version limitations stay named and repairable.

**Acceptance.**
1. In addition to the retained smaller fixture, a non-technical tester completes browser OAuth and a full source-account run at 1440/390 against an authorized source account or official-schema network-edge fake, with at least 300 active/archived work containers, 85 members, 40 guests, multi-year comments/history and at least 10 GB of actually transferred/digested file bytes.
2. Show/save the preflight estimate; throttle requests, expire a credential/file URL, interrupt extraction and the receiver, restart/resume, repair a failed blob and compare every type/ID/count, edge, identity/permission/time total and stored file digest across the account.
3. A metadata-only 10-GB counter cannot pass.
4. Record measured requests/bytes/rates, throttle/retry time and elapsed versus the saved estimate and explain overrun/unresolved work honestly.
5. For workspace-and-list source the 300 containers are active/archived Lists across multiple Spaces and Folders with folderless Lists, archived/closed tasks, deep subtasks, a task in multiple Lists, custom item fields/statuses, comments/files, goals, time entries and private guest assets.
6. Include more than 100 tasks in a List so paging is compulsory.
7. The fake enforces the documented source-plan 100-requests/minute token limit, 429/reset headers, zero-based task paging and default omission of closed/subtask/multi-list work; only explicit traversal can reconcile every source identity/List edge.
8. Include reviewed task-linked content and the existing counted Slate/Nook handoff without inventing missing source data or granting imported access.

#### PEG-113 — workspace-and-list source cutover, delta and invitations

*Tier:* Core · *From:* PEG-048 · *Rules:* D-10, D-11

**Requirement.** A workspace-and-list source cutover repeats its delta, reviews its member and guest invitations and paces its mail under D-10 and D-11, with PEG-054’s reviewed conflict-preserving rollback.

**Acceptance.**
1. Change source records/files/grants and native work during a repeat delta; inspect conflicts and complete or roll back without losing native changes or replaying effects.
2. Review/invite 85 mapped members and 40 chosen guest shares once, skip matched locals, invalidate a changed address/role and prove unreviewed rows receive nothing.
3. Run PEG-121’s 125-person mail-capacity queue at this source’s reviewed cutover, including one suppressed address, a corrected/re-reviewed row, provider throttle and restart; reconcile each invitation to one accepted or visible failed outcome with no unreviewed send.

#### PEG-114 — workspace-and-list source multi-assignee workload

*Tier:* Core · *From:* PEG-048 · *Rules:* D-13

**Requirement.** Workspace-and-list source tasks with several assignees keep every person, their source identities and their explicit per-assignee estimates under D-13.

**Acceptance.**
1. Add a multi-assignee source fixture, select the one accountable owner and preserve every remaining person/ID as a scoped collaborator/allocation.
2. Exercise PEG-016’s source 10-hour Split (5/5) and Sum (10/10), and workspace-and-list source 3/7 estimates on a shared task.
3. Compare every person/week total, task estimate/count and membership edge with the source-defined semantics, re-run without duplicates and inspect an explicit allocation-repair item when the source setting is absent.
4. No source assignee is lost or silently invited and a changed interpretation cannot be called an exact workload match.

#### PEG-049 — creative-work source creative-work migration

*Tier:* Core

**Requirement.** Move spaces/folders/projects and cross-tagged tasks, custom item types/workflows/fields, dependencies, dates/baselines, comments, attachments/versions, proof feedback, approvals, reports, requests and time history using documented export or API guidance, authorized APIs and supplemental archives. Source proof pins and decisions remain labeled historical evidence of the source version; missing proof artifacts are reconciled, never treated as a fresh Pegboard sign-off.

**Acceptance.**
1. Migrate a creative project between PDF v1/v2 approval rounds with time entries and a Gantt baseline.
2. Compare source attachment digests, annotations and decision attribution, then continue review in Pegboard on the correct version.
3. The report names every absent pin/approval artifact or unsupported mapping and the buyer approves its resolution before cutover.

#### PEG-050 — calendar-scheduling source work and calendar migration

*Tier:* Core

**Requirement.** Move workspaces, projects, tasks, priorities, estimates, dependencies, recurring definitions and authorized project context through official API/export capabilities; map scheduled blocks separately from deadlines. Calendar reconnection establishes new authority without copying OAuth secrets. Scheduling policy and locked blocks are reviewed rather than blindly imported; source-only agent/knowledge configuration is retained as inert context or linked to the responsible sibling.

**Acceptance.**
1. Extract an active calendar-scheduling source project through the documented source API, including an unscheduled overloaded task and a moved calendar block.
2. Preview and approve owners, deadline versus time-block mapping and recurring behavior; compare counts/effort with the source and reconnect calendars without duplicate events, copied credentials or automatic unapproved rescheduling.

#### PEG-051 — product-planning source workspace migration

*Tier:* Core

**Requirement.** Import the source’s raw workspace export with spaces and boards, tasks, properties/statuses, dependencies, comments/docs, reminders and assignable-agent context where supplied, supplementing through its authorized API. Preserve original authors and task IDs, and send engineering sprints/issues to Vector with linked business work rather than adopting an engineering product. Agent instructions migrate as disabled draft configuration requiring a scope review.

**Acceptance.**
1. Migrate two product-planning source spaces with custom properties, a dependent task and an agent-owned draft.
2. Reconcile raw records and file availability, rebuild a saved business view, inspect linked engineering handoff and refuse imported bot authority.
3. Re-import a changed task and report the conflict without cloning it.

#### PEG-052 — project-and-workflow source project and workflow migration

*Tier:* Core

**Requirement.** Import project hierarchy, tasks, assignments/dates, available custom fields, attachments and project context from supported project exports, supplemented by authorized API data. Views map to Pegboard work views/canvas; agents, knowledge references and automations become disabled, reviewed configurations. General generated apps/data tables/workflow graphs hand off to Cradle/Pencil/Crank with retained source references. Markdown or text alone is never represented as a complete workspace backup.

**Acceptance.**
1. Migrate multiple project-and-workflow source projects with nested tasks and agent/automation references, reconcile exported and API-visible records and identify absent history/assets explicitly.
2. Continue one business project in Pegboard, inspect the approved sibling handoff and show that imported automations or paid/external actions cannot run until freshly authorized.

#### PEG-053 — kanban-board source, grid-based source and spreadsheet migration

*Tier:* Core

**Requirement.** Kanban-board source boards/lists/cards/checklists, labels/members, comments, attachments and dates map to project work. Grid-based source sheets, hierarchy, dependencies, assignments, fields, attachments and available comments/history map to the fixed work model; arbitrary relational apps remain Cradle's job. CSV/XLSX preview supports explicit encoding, US date/timezone and duration mappings, missing owners, duplicate rows and external IDs; ambiguous dates are refused until resolved.

**Acceptance.**
1. Import a live kanban-board source campaign export, a grid-based source dependency sheet and US CSV/XLSX work files through Import.
2. Compare hierarchy, deadlines, files and graph edges, fix an ambiguous date and unmapped owner, inspect a named history limitation and re-run without duplicates; unrelated database sheets are handed to Cradle with an explicit report.

#### PEG-054 — Mid-stream cutover, reconciliation and rollback

*Tier:* Core · *Rules:* D-10

**Requirement.** Every importer supports a source watermark, saved mapping, side-by-side counts and graph/file/permission/time checks, repeated delta import, concurrent-edit conflicts and a final reviewed cutover plan. Source permissions become restrictive staged shares pending review; active automations and recipient authority never transfer implicitly. Freeze/delta strategy, source shutdown, connector reauthorization and rollback consequences are explicit. Batch undo removes/restores only unchanged owned effects and preserves dependent native work and later erasures. The staged-share review supports bulk accept-as-source for a selected unchanged set after showing actual recipients, source/effective role, grant path and internal-field exclusions, with per-exception correction. It cannot bypass guest policy, create invitations silently or activate unreviewed public links; changed membership or records invalidate only the affected staged decisions and preserve the rest for review. Bulk cutover invitation review also covers mapped members as well as guest shares: exact recipients/roles, existing-identity matches, per-row decision records and single invitation delivery survive retry/restart. PEG-081 extends every count/digest/delta/rollback check to the full project-management source account, not only one active campaign. The same whole-account counts/digests/delta/rollback and reviewed bulk invitation bar applies to board-centric source PEG-109 and PEG-110 and workspace-and-list source PEG-112 and PEG-113.

**Acceptance.**
1. Run a two-pass cutover of an active campaign for every source in PEG-024, create changes on both sides, interrupt/resume apply and compare source/project/task/file/time totals and exact residuals.
2. Approve cutover only after resolved or explicitly accepted named losses; exercise rollback with native edits and demonstrate no lost work, broadened share or replayed notification.
3. Review a migration with 40 guests, bulk-adopt the compatible staged shares and individually correct a Viewer/Editor conflict and internal-field exception.
4. Change a source/local share before Apply; require fresh review for that exception, no broadened scope and one auditable decision per applied grant.
5. Review 85 mapped members and 40 guests at account cutover, approve chosen invitations/share adoptions and change one source address after review.
6. Only current approved recipients get one invitation, matched local identities are not recreated and the changed row requires re-review while full-account delta totals/rollback remain reconcilable.
7. Run the source-specific 300-container/85-member/40-guest/10-GB cases for board-centric source and workspace-and-list source, preserving native edits and current invitation decisions on resume/delta/rollback.
8. Run PEG-121’s 125-person mail-capacity queue at this source’s reviewed cutover, including one suppressed address, a corrected/re-reviewed row, provider throttle and restart; reconcile each invitation to one accepted or visible failed outcome with no unreviewed send.

### Owned operation and data custody

#### PEG-055 — Owner-run Cloudflare installation through Base

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-SECRET-002, BASE-OPS-002, BASE-BACKUP-001 · *Register:* R-7

**Requirement.** The owner’s Cloudflare installation through Base (BASE-INSTALL-001) documents its runtime, database, file/object custody, mail, queue/scheduling and domain bindings, US placement and explicit provider prerequisites/costs. Setup establishes the first owner securely and serves public product/contract/sign-in pages without private data. Upgrade previews data changes and never replaces the owner’s business identity or data. A guided browser-only Base setup requires no CLI, developer tools or hand-written configuration. Before installation it collects member/guest/storage/mail/agent-volume assumptions and shows an itemized monthly USD estimate with dated provider rates, free allowances, optional spend, uncertainties and owner-controlled account charges; it is not a promised bill. The wizard connects the owner’s Cloudflare account with scoped authorization, provisions/validates runtime, storage and mail bindings, guides DNS/domain verification, and guides model connection and a live test before final completion, then creates a first project and sends explicitly reviewed invitations. Every failed prerequisite names its cause, current state, exact browser recovery steps and resume control without duplicate installations or invites. The pre-install quote includes PEG-126’s explicit Run Edit Run software/push/security-update line items and mail-capacity assumptions.

**Acceptance.**
1. Starting with an empty authorized Cloudflare account, install via documented Base steps, configure mail/domain and sign in as the first owner.
2. Create a project, upgrade the deployed Worker and recover from an interrupted upgrade; work/history remain intact and an unconfigured installation or unauthenticated public route reveals no workspace data.
3. Using only a browser, a scripted run from an empty authorized Cloudflare account reviews the estimate, completes mail-verified setup, sends two reviewed invitations and creates the first project in under 30 minutes of elapsed time, keeping start/end timestamps including provider waits.
4. A built-in verified web URL can establish owner setup/first use while custom web DNS remains visibly pending; invitation/sign-in/notification mail still waits for PEG-084’s separately authenticated sender and a passing evaluated sender authentication outcome; platform placement checks remain advisory unless the owner expressly enabled a hold.
5. Separately inject each missing grant, billing prerequisite, mail failure, DNS error and failed model connection/test, follow its browser recovery and resume without duplicate data; if a provider delay exceeds the bar, the run is not called passed.
6. Inspect the complete Run Edit Run/provider quote before any spend decision.

#### PEG-115 — Model connection during setup

*Tier:* Core · *From:* PEG-055

**Requirement.** The non-technical owner selects a supported model and connects it through a scoped owner-account model binding or browser-entered provider credential stored as an installation-local secret. The guided screen names the processor/model, US processing/storage/retention/training posture under PEG-021/065, required grants and USD usage terms before consent; an unqualified custody path cannot be enabled without the explicit owner-approved exception that those clauses require. A default $25 monthly USD AI limit is shown and editable before connection, included in the saved pre-install estimate, and enforced with usage/reservation accounting under PEG-125. The wizard makes a real live inference test and records model identity, configuration revision, timestamp, result and budget usage without logging credential values. Missing/failed model tests name a cause and browser recovery/retest path; they never silently finish as AI-ready. Final setup completion requires either that successful current model test or the owner’s explicit “continue without AI” choice, recorded with actor/time and disabled-AI state. Skipping is never automatic after a failed call or timeout; ordinary work remains available. Without a connected model every AI surface says “No AI model connected” and links to the browser connection flow under PEG-105; no draft, answer or successful rule/agent run is fabricated.

**Acceptance.**
1. During the same under-30-minute browser-only run, connect the chosen model, pass the real live test, ask a cited question about the first project, summarize an authorized seeded thread and generate a status draft; compare logs to model/configuration revision and the USD budget.
2. Separately complete a fresh timed run only by explicitly choosing “continue without AI” and inspect the actor/time record plus “No AI model connected” and Connect model link on Ask, summaries/status drafts, AI rule steps and agent teammates.
3. Verify missing/failed model, invalid credential, failed inference, denied processor consent or budget failure cannot pass setup without a successful retest or that explicit recorded choice.
4. The 30-minute bar counts as met only with the passing model test or the recorded choice as well as all other setup outcomes; provider/model waits remain inside elapsed time.

#### PEG-116 — Guided mobile, connection and migration setup

*Tier:* Core · *From:* PEG-055

**Requirement.** After basic setup, Settings exposes the published-store invitation/QR, one-time push-relay registration and member app-binding guide from PEG-079, plus the four provider-registration guides from PEG-080 and whole-account project-management source migration from PEG-081. These guided paths name their responsible release/provider/owner roles and remain accessible to a non-technical owner; none requires owner mobile developer accounts or a handwritten OAuth manifest.

**Acceptance.**
1. From the fresh setup completion screen, open Mobile, Connections and project-management source migration; verify the owner can follow the named guides with the exact generated installation address/values and separate measured provider clocks, while unfinished connections have explicit states.
2. Record that no mobile signing or Apple/Google developer-account step appears in the owner journey.

#### PEG-117 — Signed release notices and security patches

*Tier:* Core · *From:* PEG-055

**Requirement.** The owner sees signed version/security advisory notices with affected installation versions, severity, release notes, backup/migration/recovery implications and a guided upgrade. An owner’s update policy may allow signed security patches during a chosen window after backup and preflight, with visible success/failure and rollback; feature/schema upgrades outside that policy require the owner’s explicit review. Notices and eligible updates never silently broaden provider/agent permissions.

**Acceptance.**
1. Present a valid and forged release/security notice, inspect applicability and guide, enable a bounded automatic security-patch window and apply one eligible signed patch after backup.
2. Reject a forged/incompatible/out-of-policy update, simulate failure and recover with intact work and an owner-visible result; no secrets or new grants arrive via the update.

#### PEG-118 — Mail-verified setup within the 30-minute bar

*Tier:* Core · *From:* PEG-055 · *Register:* R-5

**Requirement.** Setup and the 30-minute bar also require PEG-084’s SPF/DKIM/DMARC verification, PEG-086’s owner recovery enrollment. Owner/recipient-platform placement probes are offered as advice; unconfirmed placement cannot delay default setup or invitation/sign-in dispatch, and no unused platform account is a prerequisite. A built-in web URL never substitutes for the separately named authenticated sender. The timed run can finish with Inbox placement not confirmed once sender authentication and other setup requirements pass; only an explicitly selected hold can delay that platform’s mail, and an owner/Admin can release it once.

**Acceptance.**
1. Complete PEG-084’s evaluated sender-authentication checks plus PEG-086 recovery enrollment in the same timed setup, send the two reviewed invitations/sign-in links to the platforms actually used and offer placement help without blocking the buyer on it.
2. A fresh sender whose DMARC would fail cannot pass mail-verified setup or send invitations; an isolated missing DKIM with valid aligned SPF, or failed SPF with valid aligned DKIM, remains a warning while DMARC passes; show the named records and repair, and retain all provider waits inside the 30-minute bar.
3. Finish with four unprobed gateway/consumer guests as PEG-119 requires, then demonstrate the separate chosen-hold/manual-release path without changing the 30-minute basic setup bar.

#### PEG-084 — Sender authentication and DNS evaluation

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Register:* R-5

**Requirement.** The PEG-055 browser wizard configures the installation’s explicit production Base mail provider, with at least Resend qualified at launch, and names its From/reply domain, envelope/return-path, DKIM signing identity, account/US processing terms, sending plan and credential custody. Every offered provider must meet this clause’s DNS, events, capacity and live-inbox qualification, rather than inheriting qualification from another adapter. Show the exact provider-generated record type/name/value for SPF, DKIM selector and DMARC, their lookup results/alignment/verification times and console/DNS repair links; safely merge SPF rather than publishing competing SPF records or replacing unrelated senders. Read DNS/provider status and evaluate Pegboard’s own sender: whether the provider’s SPF include/IP authorization is present and passes, whether the chosen DKIM selector/key and actual signature are valid, and whether at least one authenticated SPF or DKIM identifier aligns with the visible From domain so DMARC passes. Show all SPF/DKIM/DMARC records to add and their individual results/repair links, but a lone SPF failure/permerror or DKIM defect is a warning while the other aligned authentication method still passes DMARC; aligned DKIM alone is sufficient to keep invitations, sign-in mail and notices flowing. Initial dispatch requires an evaluated DMARC pass for the selected sender and usable provider credentials, never an unauthenticated fallback. The release’s full live qualification still demonstrates SPF, DKIM and DMARC passing, distinct from the minimum operational send decision. Persist evaluated pass/fail/unknown results, observation/expiry times and provider/account/From/envelope/signing identity, not raw SPF/DKIM/DMARC TXT content or a hash of that text as a delivery-path key. An unrelated SPF include, DMARC p=none → quarantine → reject rollout, pct or rua/ruf edit that leaves Pegboard’s outcomes passing creates no placement re-check, credential invalidation or hold. Normal scheduled authentication evaluation still runs; health records Sender records changed; still passing when a change is observed or reported. Re-evaluate at authoritative TTL or five minutes, whichever is less, and retain last authoritative positive outcomes during timeout, SERVFAIL or resolver/network errors. Show stale age, lookup cause, last success and next retry; retry at one, two, four, eight then at most fifteen minutes and escalate owner warnings after 24 hours without turning transient error into a negative. A DNS authentication pause requires two consecutive fresh authoritative evaluations at least 60 seconds apart showing Pegboard mail would actually fail DMARC, with no intervening passing evaluation; an isolated SPF failure while aligned DKIM passes never satisfies this condition. Name the failed alignment/record and repair in Sending authentication failing. A confirmed unusable/revoked provider credential produces its distinct transport repair state, not a DNS or placement failure. Successful validation resets the negative streak, and repairs resume only current authorized unsuppressed jobs once. A built-in verified web URL supplies no sender identity or mail authority. The first-owner Base/Cloudflare bootstrap can configure sending without an email session; PEG-086 supplies persistent enrolled recovery later.

**Acceptance.**
1. With Google, Microsoft and Other recipients, add another sender’s SPF include, move DMARC from p=none to quarantine/pct=25 and reject, and change rua/ruf; after each passing evaluation request zero placement re-checks and hold zero invitations/notices/sign-in mail, showing changed; still passing.
2. Change provider/From/signing identity with passing authentication: ask for advisory re-checks and keep all mail flowing; the optional hold remains visibly owner-chosen and releasable.
3. Restore against DNS with only unrelated includes/policy/report-address differences and reuse evidence without probes or automatic holds.
4. Remove the SPF include/exceed its lookup limit while aligned DKIM still passes: warn but send normally.
5. Break all aligned mechanisms so DMARC actually fails, confirm twice at least 60 seconds apart and pause every platform despite manual release; a transient timeout/SERVFAIL never supplies that confirmation.
6. Repair/revalidate and resume current jobs once.

#### PEG-119 — Default delivery, optional placement holds and delayed sign-in notices

*Tier:* Core · *From:* PEG-084 · *Cites:* BASE-MAIL-001 · *Register:* R-5

**Requirement.** A new provider/sending domain/signing identity asks for advisory Placement re-check due on affected recipient paths while mail continues whenever the selected sender evaluates as DMARC-pass. A valid key rotation or receiver MX change likewise requests advisory checking rather than re-arming a default hold. Setup offers a probe to the owner’s own mailbox and MX-family placement help, but placement confirmation is advice, never a default setup, invitation or sign-in prerequisite. A Google-only installation needs no Microsoft account and vice versa. Read pending recipient domains’ MX routing and label Google Workspace/Gmail, Microsoft 365/Outlook or the actual named Other/gateway without guessing a hidden backend; an unknown/failed MX lookup does not block otherwise authenticated mail. Invitations and sign-in mail to all platforms send by default once sender authentication passes and their ordinary human invite/share decisions are current, including Mimecast, Proofpoint, iCloud, Yahoo and other unprobeable destinations. Show Inbox placement not confirmed until evidence exists, rather than asserting failed delivery. An owner or authorized installation mail Admin may opt into a visible Hold until probed policy for selected platforms; show its actor/scope/reason/time and effective state before enabling it. One recorded Send without a placement check decision releases any held platform while sender authentication passes; no consenting mailbox, client IT approval or extra licence is needed. Advise a consenting probe mailbox on actual receiver paths when useful, including free Gmail/Outlook.com for their families, but retain the manual release at all times. Owner-confirmed Inbox probes and Received by a recipient are distinct evidence: a recipient following any recipient-correlated link in Pegboard mail, including invitation, sign-in or ordinary task links, records receipt for that platform/path. Receipt evidence can satisfy the optional hold; it proves neither Inbox placement, a human read nor a completed sign-in/approval. A link GET by a scanner never grants a session or work authority. Invitation rows show queued/provider-accepted/bounced/suppressed and Not yet accepted after {N} hours from actual dispatch, exact recipient, attempts and next step. Provide a copyable client-IT allow-list request with sending domain, current provider-published sending IPs/ranges or their documented dynamic-range reference, SPF include names, DKIM signing domain/selector and dated provider guidance; it asks IT to review legitimate delivery, never to disable filtering globally. An authorized resend after allow-list repair preserves one invitation/share identity and current review, records the attempt and never creates duplicate membership or repeated authority. Owner/inviter in-app and independent push warnings identify a chosen held platform and pending count under their current access. During any mail pause or chosen platform hold, every sign-in requester receives the identical delayed notice on web/iOS/Android, known/unknown/inactive alike; never disclose account existence or address suppression. Keep existing sessions, native bindings, task work and independent push working. Persist platform receipt/probe evidence and evaluated sender outcomes, not raw-record fingerprints. Restores re-enter excluded credentials and explicitly reauthorize sends, re-evaluate the selected sender and reuse evidence where appropriate; passing but textually different DNS never holds mail or demands probes. Provider/identity/receiver changes produce only advisory re-check items unless an owner separately chose the optional hold, which retains its one-decision release. The real Gmail plus real Microsoft 365 live run remains release qualification, not a buyer gate. Sign-in requests retain PEG-056’s indistinguishable public response, with a private failure for the responsible admin and no session minted from undelivered mail. During any confirmed mail pause or expressly chosen platform hold every requester, known or unknown, sees the same Sign-in email for this workspace is delayed; your administrator has been told notice on web and both native apps, with the same enabled sign-in alternatives and owner-recovery link. Valid sign-in requests queue durably with their original expiry, current identity/share checks and no automatic lifetime extension; unknown/inactive addresses cause no mail or authority and reveal no queue membership. Existing web/native sessions, passkeys/SSO, mobile bindings, push, task work and provider connections continue under their existing grants; mail readiness never revokes them.

**Acceptance.**
1. On a fresh Google-only installation, evaluate/show SPF/DKIM/DMARC and invite one guest each behind official-schema Mimecast and Proofpoint MX routes and at iCloud and Yahoo, without having a probe mailbox on those platforms.
2. With default settings all four invitations and subsequent sign-in mail dispatch under passing authentication, labeled placement not confirmed; a Google/Microsoft licence or consenting gateway mailbox is never required.
3. Then opt into Hold until probed, queue a fresh recipient per platform and release each with one audited owner/Admin decision; all four become provider-accepted once without new membership/share identity.
4. Follow an ordinary task link as one recipient and accept/sign in as the others; record Received by a recipient on each path, without claiming Inbox placement or treating a GET/scanner as an authenticated session.
5. Simulate one gateway quarantine: invitation age increases, copy the complete domain/IP-range/include/DKIM-selector IT request, allow-list through the controlled provider edge and resend once with one active invitation.
6. A held guest and unknown/inactive addresses receive identical delayed-sign-in notices on web and both native apps.

#### PEG-120 — Bounces, complaints and address suppression

*Tier:* Core · *From:* PEG-084

**Requirement.** Hard bounces and complaints from authenticated provider events are recorded once per exact recipient/address and delivery ID, with provider cause/time and suppression state visible only to authorized inviter/administrators on invitation/member/guest rows and in-app notices. They stop every further email to that address, including already queued notices and sign-in mail; later delivered/replayed events never clear suppression. Signature/tenant/replay checks protect the event door, and missing event subscriptions/custody show an unready provider rather than silently ignoring bounces. Soft delays remain named queued/deferred failures with bounded provider-aware retries. The inviter/admin can review a corrected address and resend exactly once under the normal invitation/share review, while the original address stays suppressed; clearing a complaint on the same address requires documented recipient permission and provider reconciliation, not an automatic retry. Suppression is portable product safety data under PEG-058/059, not restored sending authority.

**Acceptance.**
1. Deliver/replay a signed hard bounce for a guest invitation and a complaint for a member notice; inspect inviter/admin undeliverable cause and per-address suppression, with zero further sends from invitations/sign-in/notices/agent email even after restart or a later delivered event.
2. Refuse forged/cross-tenant events, keep sign-in responses indistinguishable, review a corrected guest address and deliver exactly one newly reviewed invitation.
3. Export/restore suppression and demonstrate that queues/credentials stay inactive and no suppressed address is revived.

#### PEG-121 — Capacity-paced invitation and notice queue

*Tier:* Core · *From:* PEG-084

**Requirement.** The saved estimate and cutover preflight compare expected invite/sign-in/notification/reply volumes for 85 members plus 40 guests with actual provider daily/monthly quotas, request/recipient rates, current shared-account usage and reset windows. A plan too small is visibly insufficient with an owner-reviewed capacity/plan repair; no upgrade/spend occurs silently. Durable queues pace to the provider’s current stated limits/reset/Retry-After, prioritize authentication over optional digests without starvation, preserve recipient preferences and current share/send reviews, and show total, accepted, pending/remaining, next eligible time, deferred, suppressed and failed counts plus elapsed/estimated completion. A 125-person cutover must complete on a capacity-qualified plan, with each message accepted or a named actionable terminal failure and nothing silently discarded. Ambiguous sends reconcile before retry; invitation links are issued safely at actual dispatch under the current reviewed invitation. Queued sign-in links retain their normal request-time expiry: after a pause send only still-valid proofs once, discard expired ones without sending or silently refreshing them, and allow the person to request a fresh normal link. Queue waits cannot deliver dead authority or duplicate invitations.

**Acceptance.**
1. Run a controlled day for 85 members/40 guests: 125 invitations, 125 requested sign-in links, 250 assignments, 125 due notices and 125 digests (750 emails, plus explicitly counted probes/reply mail).
2. First show an insufficient free-plan preflight; then use an owner-approved plan with capacity for that total and exercise published rates, 429/reset/Retry-After, shared-account use, restart and an ambiguous acknowledgment through official-schema network edges.
3. Also complete this paced corpus through the actual configured provider to controlled consenting test mailboxes/aliases; report per-recipient outcomes, live provider IDs, remaining counts falling to zero and measured completion versus estimate.
4. On the healthy-provider live path all 125 distinct cutover invitations and the remaining non-fault corpus are accepted exactly once; a wholesale failure cannot be called a completed cutover.
5. In the separate fault cases every expected message reconciles to one provider-accepted or visible terminal-failure outcome, with no silently dropped or stale-link mail.

#### PEG-086 — Mail-independent owner recovery

*Tier:* Core · *Cites:* BASE-SIGNIN-002, BASE-AUDIT-001

**Requirement.** First setup requires the responsible owner to enroll and verify an installation-origin-bound user-verifying passkey or TOTP authenticator, plus a printable set of single-use high-entropy recovery codes saved offline with a confirmation/challenge. This is part of PEG-055’s browser setup/30-minute bar, not an optional feature deferred until after email sign-in. TOTP secrets are sealed at rest; recovery codes are stored only as hashes, shown once with accessible print/download, and never returned by ordinary reads, logs, exports or support tools. The owner can manage/revoke/replace recovery methods from a currently authenticated owner screen only after fresh verification; replacing codes invalidates the old set. At any later time, including an expired owner session, absent SSO, paused mail or inaccessible mailbox, the persistent Owner recovery public door authenticates the enrolled owner with their passkey/TOTP or an unused printed recovery code. It opens a short-lived, auditable recovery session (15 minutes maximum, fresh verification to extend) limited to Settings → Mail, exact DNS/provider repair, platform probes, owner recovery-method repair and redacted member sign-in delivery status. It grants only that owner’s existing administrative repair authority, no general member session, private-task browsing, new membership/share or SSO-only ordinary-work bypass. Generic account challenges/errors and origin/cross-site controls prevent guessing or replay, alongside BASE-SIGNIN-002’s throttles, replay windows and one-use codes; a mail pause never enables an unauthenticated reset or agent approval. The original first-owner Base/Cloudflare bootstrap remains available for installation creation, not a substitute for this persistent enrolled recovery. PEG-057 records entry/method identifier, repair/change and exit without code/secret/proof values. Archives exclude passkey/TOTP secret authority, codes and recovery sessions; a restoring owner enrolls/verifies destination recovery before completing the owner handover, without forcing unrelated placement probes.

**Acceptance.**
1. At 1440/390 the first owner completes passkey enrollment plus offline printed-code confirmation; repeat a fresh setup choosing TOTP instead, with no SSO configured.
2. Sign out/expire the normal session, pause mail through two confirmed DMARC-failing answers with both aligned mechanisms broken, open Owner recovery and reach the repair screen via each enrolled method and an unused printed code in separate cases, without email.
3. Repair/revalidate sender authentication and offer affected-path placement help without a default gate, inspect the redacted per-member sign-in delivery status and resume current jobs once; the recovery session/repair appears in audit.
4. Refuse a wrong-origin passkey, bad/replayed TOTP, reused/revoked code, foreign origin, uninvited caller and expired recovery session; normal project/private-task/member-invitation doors remain denied even for a valid recovery-only session.
5. Download/archive/log inspection reveals no code, TOTP seed or active proof; destination restore requires new recovery enrollment while retaining unchanged platform probe data.

#### PEG-122 — Team continuity during mail and DNS failures

*Tier:* Core · *From:* PEG-086

**Requirement.** Mail/DNS state never revokes existing sessions, normal task read/write rights, native bindings or independent push; explicit security revocation and normal session expiry still apply. Members see PEG-063’s mail warning and PEG-056’s enabled alternatives, and every public sign-in requester receives PEG-119’s identical delayed-mail notice during a pause, without exposing account existence or private recipient queues. Queued valid sign-in requests retain their ordinary expiry and deliver once after safe recovery only while still current; expired requests are discarded, not regenerated without a new request. During a 125-person DNS edit, people already signed in keep working across projects and guest shares, notices remain in the appropriate queue and independent app push continues.

**Acceptance.**
1. With 85 member sessions and 40 scoped guest sessions on web/iOS/Android, simulate a 60-minute resolver timeout/SERVFAIL window through official-schema DNS edges: no DNS mail pause, original permissions/tasks/comments/assignments continue, real qualified mailbox notices/sign-in mail arrive, and owner warnings show last authoritative success, backoff and escalating stale age.
2. Then break aligned DKIM and SPF so DMARC fails and confirm two fresh authoritative failures at least 60 seconds apart: mail pauses, while all 125 active sessions continue their permitted work and assignment push is delivered.
3. Known, unknown and inactive sign-in requesters see exactly the same delayed notice and enabled alternatives on web and both native apps.
4. Queue one still-valid link and another whose normal lifetime elapses; expire the owner’s normal session, recover without mail, repair the failing authentication and offer only advisory placement re-checks for genuine changed paths.
5. Deliver the still-valid request once, discard the expired request without sending/auto-extension, accept a new explicit request normally and reconcile the 125-person workload/queues with no lost edits, new grants, duplicate notices or suppressed-address mail.
6. Record elapsed DNS/edit/pause/recovery times, session continuity, provider outcomes and privacy refusals.

#### PEG-123 — Second-person recovery and Cloudflare re-enrollment

*Tier:* Core · *From:* PEG-086 · *Cites:* BASE-SIGNIN-002

**Requirement.** Any second owner or explicitly delegated installation Admin may enroll their own passkey or TOTP and printed codes from a freshly authenticated authorized session. Each person’s recovery credential is individually scoped to the same 15-minute mail/recovery repair door, never a shared owner credential or an automatic grant to ordinary work; delegation/revocation is audited and immediately fences later use. The public recovery page also names Lost all methods → Verify Cloudflare account ownership → Re-enroll recovery. A guided Base operator-recovery flow authenticates the holder in Cloudflare and proves current write/control authority over this exact account/Worker installation using a short-lived one-time recovery challenge. The page links the exact Worker’s Cloudflare dashboard and supplies a nonce-bound recovery binding value; the holder puts it into that Worker’s generated recovery secret field through the provider’s official secret-update door, and the installation verifies/consumes it, checks account/Worker/installation/owner binding and removes the challenge. No DNS claim, email possession, guessed Worker name, token pasted into a public URL or source-code edit is sufficient. The existing signed first-owner claim remains single-use; this distinct operator recovery does not reopen it or create a new member/owner. It can re-enroll only a recorded installation owner, explicitly confirms that person, revokes that owner’s lost methods/codes/recovery sessions and requires a new verified method plus new offline codes before leaving the repair-only session. Record provider account/Worker IDs, initiating actor/control proof, affected owner, challenge consumption, revocations and enrollment in PEG-057; never the secret/challenge/code value. Warn other active owners/Admins in-app/push and show the custody event in access review. Cloudflare availability/account recovery is an honest external prerequisite when every local method is lost; enrolled second-person recovery remains independent of it.

**Acceptance.**
1. Enroll a second owner and a delegated Admin with distinct methods/codes, expire the first owner’s session during a real mail pause and repair with the second person at the same restricted scope; revoke the delegation and refuse their later challenge.
2. Then lose every method/code for the original owner and use the generated Cloudflare-account-holder re-enrollment guide through official account/Worker/secret schemas plus one real authorized Worker recovery.
3. Wrong account/Worker/installation, expired/replayed challenge and a caller without actual Worker control fail.
4. A valid challenge re-enrolls only the selected existing owner, invalidates old methods/codes, logs the full redacted audit chain and allows repair without mail; project/member/private-task doors remain refused.
5. Simulate Cloudflare unavailability and show the named external prerequisite and enrolled second-person alternative without inventing a bypass.

#### PEG-056 — Native email sign-in and accountable sessions

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002 · *Register:* R-5

**Requirement.** Base operator-auth sends email sign-in links only to active invited members, returns indistinguishable requests for unknown/inactive addresses and uses hashed, expiring, single-use proofs confirmed by a same-origin POST. A GET never establishes a session; secure cookies and bounded internal return locations govern browser access. A linked Auth/enterprise IdP does not admit an uninvited person or bypass SSO-only policy. Failed mail configuration cannot mint authority. Email links use PEG-084’s evaluated passing sending identity, PEG-119’s advisory placement evidence, PEG-120’s suppression and PEG-121’s paced delivery; a bouncing/suppressed address gets the same public request response as any unknown address, with an authorized admin-only undeliverable reason. PEG-086’s persistent owner recovery remains reachable without mail at any time. During a confirmed pause or expressly chosen platform hold web/native requesters all receive PEG-119’s same delayed notice, normal sessions and enabled alternative methods remain usable, and queued links retain their original expiry. A recipient platform awaiting advice never blocks default sign-in mail. A chosen platform hold uses the same global non-enumerating delayed notice and enabled recovery/SSO options as a confirmed sender pause.

**Acceptance.**
1. Through the native sign-in route, request/confirm a valid link, test unknown/inactive, expired/reused links, scanner GET, foreign-origin confirmation and unsafe return locations.
2. Sign out/revoke and exercise optional IdP sign-in; every private UI/API/export refuses old or missing authority with no product mutation.
3. Refuse actual DMARC-failing or suppressed-address sends without an enumeration difference or session grant; queue delay cannot turn an expired link into valid authority.
4. Run PEG-086’s expired-owner-session passkey/TOTP/code recovery and PEG-122’s 125-person DNS-edit window.
5. Known/unknown/inactive requesters see identical delayed notices in web/iOS/Android, active sessions/push remain usable and no expired queued link is delivered or refreshed automatically.
6. Request sign-in on unprobed Mimecast/Proofpoint/iCloud/Yahoo destinations and dispatch by default; enable a hold, compare held guest/unknown notices and release with one audited Admin decision.

#### PEG-124 — Provider sign-in buttons and passkeys

*Tier:* Core · *From:* PEG-056 · *Cites:* BASE-SIGNIN-002

**Requirement.** The sign-in page and native app show Continue with Google and Continue with Microsoft with an explicit not-connected/needs-attention explanation and authorized Settings guide link until PEG-080’s current live sign-in test succeeds; enabled buttons retain invite-only admission and SSO-only rules. Provider-client secrets and refresh tokens remain installation-local and do not pass through a Run Edit Run shared OAuth broker. Optional native WebAuthn passkeys can be offered by the owner; members/guests enroll one or more device/security-key credentials from an authenticated Account screen with user verification, named devices and revoke controls. The same installation-origin-bound credential works through web or the app’s system-browser sign-in, retains invitation-only admission and cannot bypass mandatory enterprise SSO. Removing a passkey or deprovisioning immediately blocks it; ordinary member recovery follows existing reviewed native/SSO authority rather than an unauthenticated credential reset. Owners must additionally enroll PEG-086’s passkey or TOTP plus printed recovery codes in first setup; the later owner repair session is narrowly scoped and never a general member/SSO bypass.

**Acceptance.**
1. Before connection, select each provider method and inspect the named missing-connection/guide state with no session.
2. After the live test sign an invited member in through web and app with the same account; invalid state/nonce/redirect, unknown provider tenant and revoked client produce explicit recoverable refusal without falling into a new account.
3. With a virtual WebAuthn authenticator through the browser door, enroll a passkey as a guest, sign out/in and find the same identity; deny a wrong-origin/foreign challenge and reused challenge.
4. Revoke/deprovision and refuse later sign-in, then enforce SSO-only and confirm passkeys cannot bypass it.
5. Qualify the equivalent system-browser return on both native apps.

#### PEG-057 — Durable audit distinct from editable activity

*Tier:* Core · *Cites:* BASE-OPS-005, BASE-AUDIT-001, BASE-DATA-003

**Requirement.** Authentication, role/share changes, imports, exports, approval decisions, rules, agent actions, destructive operations and provider sends have durable actor/time/action/subject/result records. Product activity may show authorized detail; the permanent audit uses opaque identifiers and redacted metadata and excludes credentials/capabilities. Changing a task, agent or proof never rewrites the audit. The permanent audit is append-only, content-free and opaque; the owner reads installation events, workspace administrators their workspace’s and each person their own, erasure removes or deidentifies removable actor content while justified operational references stay, and retained authentication or legacy activity is reported separately rather than called erased (RL-104).

**Acceptance.**
1. Change a role and task, approve a proof, run a rule/agent, import/export and attempt a failed external send through public doors.
2. Erase an actor and restore an archive; audit remains complete and attributable as allowed, anonymized where required, without planted names, email addresses, token values or asset bodies in permanent audit metadata.

#### PEG-058 — Whole-workspace portable archives and inactive restore

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001

**Requirement.** Owners export versioned, integrity-checked archives covering every target record, graph edge, field/view/template/rule definition, proof/annotation/version, time/approval, portfolio/goal/report, comment/file, source provenance, import batch, agent output and audit. Restore into eligible empty product state validates before writes, resumes interruption and reconciles counts/digests without truncation. Personal sections/tags, custom task references and aliases, announcement/email-thread provenance, saved cross-project views, agent definitions/rubrics/review metrics and all new connector state are included as product data, with personal-work custody distinguished from ordinary member access. Product identity mappings travel; sessions, login proofs, OAuth/API/MCP keys, provider secrets, active share capabilities and execution authority do not. Restored rules, sends, recurring jobs and agents stay inactive until reauthorized. Every completed PEG-091 attachment/proof original and derivative in the declared R2 bucket custody travels as actual bytes, with version links/digests; partial upload state and its capabilities do not become completed work on restore. Portable data includes mail-domain configuration references, redacted qualification history and address suppression decisions, while mail credentials, probe/sign-in proofs and active send authority remain excluded; restoration revalidates sender configuration and requires explicit send reauthorization; reuse evaluated outcomes and receipt/probe evidence under PEG-119; passing DNS edits and sender changes never create a default placement hold, and requested placement re-checks are advisory unless the owner expressly chooses otherwise.

**Acceptance.**
1. Export a populated 500-member installation with a 10,000-task project and its real retained file/history corpus, interrupt/resume transfer and restore to a new owner's empty Base installation.
2. Compare all declared counts, relationships and digests; corrupt/nonempty imports write nothing and no restored credential, notification, approval capability or agent job executes.
3. Include PEG-082’s exact-limit files and PEG-092’s migrated proof v1/v2 in the real R2 multipart round trip; reconcile byte digests, version links and inactive upload authority.
4. Round-trip PEG-120’s suppression/outcome data and prove restored queues cannot mail before sender validation/explicit reauthorization or unsuppress an address through an older restored delivered event; evaluated passing outcomes reuse platform evidence despite text-only record differences and genuine sender changes ask for advisory re-checks without a default hold.

#### PEG-059 — Erasure with honest external limits

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006

**Requirement.** Authorized owners erase a task/project, proof/file, guest/member or permitted workspace data with a preview of dependent records and a durable redacted receipt. Work data, uploaded object versions, indexes, cached previews and agent-held retrieval copies are removed or irreversibly deidentified under declared retention/hold policy. Erasure journals prevent later imports/restores from resurrecting erased data when applied to the receiving archive. The last owner requires explicit installation reset or replacement. Already downloaded files and messages held by outside recipients require their systems' deletion process. An owner previews the exact dependent scope and confirms an irreversible erasure; holds win, shared tasks survive in other projects, shared proofs need their own review, erasure journals apply and the last owner needs reset or replacement, and each retained or externally unconfirmed copy is reported as it is, never as provider deletion (RL-105).

**Acceptance.**
1. Erase a project with proof versions, comments, search hits and agent outputs through Data settings; inspect completed database/object/index removal and receipt.
2. Try stale writes, replayed intake and an old archive with the later journal; data stays erased, audit stays redacted and external retained copies are accurately identified.

#### PEG-060 — US defaults and accessible daily use

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-DOCS-001 · *Register:* R-1, R-2

**Requirement.** USD, US English, MM/DD/YYYY, 12-hour time, Sunday-start weeks (switchable), US federal holidays and Letter-size PDFs are defaults. IANA zones and explicit date-only semantics preserve deadlines and reminders across DST and distributed US teams. Every daily route, client review, form, export setup and admin flow meets Base’s accessibility bar, including alternatives to drag and color-only meaning; the human screen-reader pass and the Section 508 conformance report are register rows R-1 and R-2. In-product getting-started guidance, role-specific onboarding and a searchable versioned help center explain the actual task, proof, guest, migration and AI-connect/no-AI journeys. Help and error pages give an accessible “where to get support” path to the installation owner and appropriate Base/provider support information, with exportable redacted diagnostics; guidance does not depend on a vendor support desk or expose credentials. Teammate profiles list permitted assigned work and availability summaries only, honoring personal-task privacy and guest directory restrictions.

**Acceptance.**
1. Complete request → project → assignment → proof → approval → report and admin/export journeys at 1440/390 under Base’s accessibility bar, including the drag and color-only alternatives.
2. Cross US DST with an all-day deadline, report and recurrence; verify local display, holiday calendar and Letter PDF output.
3. As a new member and guest, complete the getting-started task/review guidance, find model connection/help and follow the support path with redacted diagnostics.
4. Open a teammate profile as an authorized colleague and inspect only permitted assignments; a guest cannot enumerate the directory and no profile exposes private no-project tasks.

#### PEG-061 — Included capabilities and measured operating costs

*Tier:* Core

**Requirement.** No seat minimums, seat buckets, guest charges or agent-seat charges apply. Reporting, workload and time tracking are included. Owners see member/guest/agent counts, Cloudflare storage/compute and third-party mail/AI/provider usage, configured USD budgets and exhaustion alerts. Usage controls can pause new optional agent work with a clear reason; they never silently lose queued work, block data export or demote read access to existing business records. No unverified saving or bill is presented as an actual charge. The pre-install estimate in PEG-055 is saved with input assumptions and rate date, and compared later against observed infrastructure/provider usage. Guests/agents never cause a hidden member-license charge; the owner can change assumptions before committing any account spend. PEG-091 shows reserved, completed and pending-cleanup attachment bytes against the owner’s aggregate storage quota and itemized USD estimate before transfer; PEG-082’s per-file guarantees are not silently lowered by that quota.

**Acceptance.**
1. Add one member, many free guests and scoped agents, then use reporting/workload/time without an upgrade gate.
2. Inspect itemized measured versus estimated usage, cross a configured agent budget and observe an explicit pause and accountable queued work while ordinary tasks and full export remain available.
3. Before installing, compare an 85-member/40-guest profile with a 120-member profile and inspect itemized USD estimates and assumptions; proceed only through the owner’s explicit spend decision, then compare measured usage with the saved estimate.
4. Reconcile upload reservations, completed/aborted/erased object bytes and displayed remaining capacity/cost estimate, including two concurrent uploads at a quota boundary.

#### PEG-125 — The AI spending cap

*Tier:* Core · *From:* PEG-061

**Requirement.** A fresh installation proposes a $25 monthly USD AI cap, shown in the itemized pre-install estimate and editable/approved by the owner before any paid test or inference. Track test-call usage, completed calls and reserved in-flight cost against that cap, with explicit estimates where a provider does not supply final usage immediately; do not claim an actual bill from estimates. A no-AI setup choice records AI disabled and incurs no model test/inference charge. Budget exhaustion pauses AI work visibly with a reconnect/budget-management route and retained pending jobs; it never silently substitutes another model or processor.

**Acceptance.**
1. Compare the estimate’s default/edited AI cap with the saved budget, run the setup live model test and reconcile its usage/reservation once.
2. Exercise budget exhaustion and recorded no-AI choice: the former visibly pauses AI jobs and the latter makes no model call; ordinary tasks, guest notices and export still work and no extra provider/model is invoked.

#### PEG-126 — Published Run Edit Run price lines

*Tier:* Core · *From:* PEG-061

**Requirement.** The pre-install and Settings quote contains a separate What you pay Run Edit Run table for software/license, PEG-079 push-relay service and security updates, each with the exact numeric USD amount (explicit $0 when free), one-time versus recurring basis, billing period/usage basis, included scope and dated public edition/price terms. These are quoted from the actual offered edition’s published terms and saved with the owner’s choice; neither open-source availability nor the absence of seat fees implies an unpriced service is free. An absent/unknown/TBD price is not an acceptable install quote: the release must publish and show each amount before the owner proceeds, and no compulsory charge can appear only after installation. Required versus optional services, renewal/overage terms and any tax estimate are explicit; paid extras require a separate owner choice and cannot turn the included capabilities into seat gates. The total distinguishes Run Edit Run charges from Cloudflare, mail, AI and optional Zapier/Make plans, and includes mail-day volume versus PEG-121’s provider quotas. This contract does not invent an unpublished Run Edit Run price or a provider bill.

**Acceptance.**
1. Before installation compare the quote with the actual release’s public software, push-relay and security-update terms: every line has an exact amount including numeric $0 where offered free, period and included scope, and the saved USD total reconciles with provider estimates and chosen options.
2. An unpublished/missing amount blocks the purchase/install decision with a named terms error, not a guessed $0.
3. Change the 85-member/40-guest mail profile, inspect volume/quota and any required provider-plan repair, accept optional spend explicitly and prove no undisclosed Run Edit Run or third-party fee is added after completion.

#### PEG-062 — Agents are scoped credentials for a named sponsor

*Tier:* Core · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Every native/external agent has a named human sponsor, explicit projects/fields/actions/providers, expiring revocable credentials, model/provider selection and a visible cost/data policy. Action/evidence logs, stop controls and conflict-preserving undo cover reversible writes; irreversible external effects carry their external or destructive class and expose their truthful compensation limits. PEG-075 provides the no-code instruction/knowledge/tool/trigger editor; saved definitions do not expand credential scope. An agent’s internal provider post is standard; only fixed guest system notices use the reviewed-share approval of D-6. Agent-written outside-organization messages and client-shared channel posts are external, human decision gates are commitment, and team-affecting agent or AI-produced date or assignment changes are standard with the affected people as facts; the company’s policy decides each. A deterministic PEG-094 rule’s Admin-reviewed activation covers that rule’s current in-scope runs; it gives an agent and its generated values no authority. An agent asking the notification service to send a system event cannot inject free-form message text or expand recipients/visible fields. Installation model credentials are distinct from each agent’s work credentials, stay secret/installation-local and use the owner-approved processor/budget. A missing/revoked model stops inference with PEG-105’s visible recovery state without broadening sponsor authority or disabling ordinary work.

**Acceptance.**
1. Create a scoped agent, give it an allowed task and adversarial instructions in an attachment, then request through API/MCP a hidden record, an external send and a spend outside its grant, and a self-approval.
2. All refuse without leaks; rotate/revoke mid-run and stop further actions.
3. Undo its allowed edits while preserving a human's later change, and show that a sent message cannot be falsely unsent.
4. Under the held policy, an agent posts an internal status within its grant without waiting; once a client guest joins the channel, the same post is external and waits for the test person’s approval before disclosure.
5. A custom-agent instruction attempting to expand its grant changes no credential or permission.
6. Disconnect the model during a scoped agent task and inspect its blocked run, recovery link and zero additional model calls/effects; reconnect/retest and recheck both work scope and budget before any continuation.

#### PEG-063 — Restart-safe business operation and recovery

*Tier:* Core · *Cites:* BASE-OPS-001, BASE-OPS-003, BASE-OPS-004, BASE-BACKUP-001 · *Register:* R-10

**Requirement.** Durable jobs for imports, recurrence, rules, reports, follow-up, provider sync and agents survive Worker/process restarts with deduplicated effect identities, leases, visible progress and an accountable exception owner. Backups, restore drills, service health and queue/storage capacity are inspectable by the owner. Partial outages expose stale/unknown states rather than falsely completing work. Data integrity and permission checks hold during deployment, reconnection and recovery. Members see a signed-in service-health/connection banner and a public installation-specific availability/support link that can be hosted independently of the installation and discloses no work data. The owner can configure an independent health/status provider for that link rather than making an outage page depend on the failed Worker itself. The installation target is 99.9% monthly availability of native sign-in and ordinary task read/write doors, measured by independent probes with outages and denominator/exclusions disclosed; provider/chat/model readiness is reported separately and no unmeasured SLA is claimed. Mail health distinguishes transient lookup warnings, pending negative confirmation, confirmed sender pauses and per-platform placement waits; the public delayed-sign-in notice reveals no account/recipient details. Owner repair remains available through PEG-086, while ordinary work and independent push continue under PEG-122. Health distinguishes advisory placement evidence/re-checks from an explicitly chosen hold and an actual DMARC-failing sender pause; warnings about SPF alone, raw DNS edits or unknown MX cannot masquerade as a mail hold.

**Acceptance.**
1. In the deployed product, interrupt each named job class before and after an external effect, restart and inspect safe completion or explicit uncertainty.
2. Restore a backup into an inactive installation, reconcile work/job totals and reauthorize chosen jobs; demonstrate no duplicate project, approval, timesheet entry or external message.
3. Drop the installation while its independently hosted status link remains reachable, inspect the member-facing degraded/reconnect message and work-free status page, recover and reconcile pending edits.
4. With controlled independent probe observations, compute the stated monthly availability and show unavailable/missing observations explicitly rather than improving the denominator; distinguish model/provider outage from installation outage.
5. Complete PEG-122’s transient and confirmed DNS windows, inspect warning/backoff and platform-specific queue health, preserve all 125 existing sessions and open mail-independent recovery after owner session expiry.
6. Keep mail/session/push work flowing through PEG-084’s passing SPF/DMARC edits and DKIM-only aligned pass, inspect advisory labels, then exercise the chosen hold and actual two-confirmation DMARC failure separately.

#### PEG-064 — Trash, revisions and conflict-preserving undo

*Tier:* Core

**Requirement.** Accidental task/project/file or configuration removal enters permission-scoped trash under the owner's published retention, with restore previews that repair graph links and name missing dependencies. Destructive erasure is a separate irreversible action. Field, brief, template and workflow revisions can be compared and selectively restored; history and newer dependent work survive. Undo never reverses a person's separate approval or claims to retract an outside message. A PEG-012 rule run exposes undo by run/effect ID with its activation version/Admin (PEG-094); successful irreversible outside sends retain their stated compensation limits.

**Acceptance.**
1. Archive/restore a project, trash/restore a task and proof version, compare a brief revision and undo a bulk change after another member edits it.
2. Inspect the restored graph, preserved later work, explicit conflicts and inaccessible erased objects through browser/API/archive reads.
3. Undo the PEG-094 date/assignment and PEG-012 added-work-action runs, retaining later human edits and refusing a stale or unauthorized undo.

#### PEG-065 — Retention and processor custody are explicit

*Tier:* Core · *Cites:* BASE-DATA-002, BASE-DATA-006

**Requirement.** Owners set published retention for product history, trash, attachments/proofs, import originals, agent prompts/outputs and provider logs, with separate transient credential/session cleanup. A legal hold names its scope, authority and expiry. Retention changes preview consequences and propagate to object versions, search and processor deletion requests; stale backups carry erasure journals. Agents use only the processors and data-sharing and training settings the owner selected. An owner reviews each retention execution exactly, proof versions expire together, active holds win, processors, sharing and training are separately consented, automatic destructive expiry and outbound deletion stay off, and an unresolved processor follow-up stays explicit until the processor confirms (RL-106).

**Acceptance.**
1. Through Data settings, configure different retention classes, apply a hold, expire eligible records and erase an unheld project.
2. Inspect product/object/index/processor outcomes and unresolved external deletions, confirm held content is disclosed as retained and verify an old archive plus current erasure journal cannot silently resurrect erased material.

### Agent surface

**Specialist: Project coordinator.** It keeps the company’s work moving: it triages requests, drafts plans and status from real work, chases owners, repairs slipping schedules and keeps migrations honest, acting for the person who sponsors it.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call; this section presets none.

**How Pegboard computes each class.**
- *standard*: creating, editing, moving, tagging, commenting, converting and completing work, schedule and assignment changes, internal posts and notices, and drafts, plans and status drafts kept inside the business; each can be undone in the product. Facts: the item count and, for a date or assignment change, the people whose work it changes.
- *external*: anything that reaches someone outside the business: a message an agent composes for a guest, a client or executive status publication, a post to a client-shared channel, outside-share content and a provider write (Jira, GitHub, Harvest, QuickBooks Time, Gauge, Zapier, Make, DocuSign, a help desk). Facts: the recipient count and the counterparty, *known* for a guest already on the share or a connected provider account, *new* otherwise and *public* for a public form or link.
- *commitment*: a decision others rely on: an approval-task, proof, routed-approval, change-request or timesheet decision, a published plan, an accepted migration loss and a cutover. Facts: the decided item and its version.
- *access*: shares, guest invitations, memberships, roles, access-request decisions, analyst keys, recurring audiences and teammate definitions. Facts: the people and whether the call widens or narrows.
- *security*: provider connections and their credentials, sign-in and sender configuration, and API and automation credentials.
- *destructive*: erasure, purging trash and an executed retention expiry. Facts: the item count.
- *money*: changing the AI budget or another spend the business pays a provider. Facts: the USD amount and the provider.
- *accounts*: registering a provider app or client in the company’s own provider account (PEG-080).
- *gated*: a consent screen or console step that a provider keeps for a person in the company’s own account (Slack, Microsoft, Google, the migration source).
- *live*: enabling or disabling a rule, recurring schedule, workflow bundle, teammate, webhook or mail hold.

Pegboard holds no regulated personal data and declares no sensitive tool.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `pegboard.work.create` | Create projects, sections, tasks, subtasks and milestones | PEG-001, PEG-002, PEG-031 | standard | API v1 project and task create |
| `pegboard.work.update` | Edit, move, multi-home, tag, complete and bulk-change work, including personal work | PEG-001, PEG-002, PEG-003, PEG-031, PEG-073, PEG-028 | standard | API v1 task update |
| `pegboard.work.search` | Search work and read saved views | PEG-003, PEG-031 | standard | none |
| `pegboard.work.convert` | Preview and apply task and project conversions | PEG-087 | standard | none |
| `pegboard.schedule.change` | Preview and apply dependency, date and assignment changes | PEG-004, PEG-069, PEG-029 | standard | schedule preview and apply |
| `pegboard.recurrence.manage` | Activate, stop and re-review recurring tasks and projects | PEG-005, PEG-089 | live (+ access) | none |
| `pegboard.templates.apply` | Apply templates, duplicate projects and adopt workflow bundles | PEG-006, PEG-034 | standard (+ access) | none |
| `pegboard.canvas.update` | Arrange the planning canvas and promote a note | PEG-033 | standard | none |
| `pegboard.register.update` | Raise risks and change requests and accept a change | PEG-035 | standard or commitment | none |
| `pegboard.intake.triage` | Submit, route and triage requests and captured work | PEG-007, PEG-008, PEG-066 | standard (+ external) | none |
| `pegboard.files.upload` | Upload attachments and proof versions | PEG-082, PEG-091, PEG-092, PEG-043 | standard (+ external) | none |
| `pegboard.inbox.read` | Read My Tasks and the inbox and set notification preferences | PEG-009, PEG-073 | standard | none |
| `pegboard.comments.post` | Comment, edit briefs and post announcements | PEG-010, PEG-072 | standard or external | API v1 task comments |
| `pegboard.proofs.review` | Pin, compare and resolve proof feedback | PEG-011 | standard | none |
| `pegboard.decisions.record` | Decide approval tasks, proofs and routed approvals | PEG-005, PEG-036, PEG-067 | commitment | none |
| `pegboard.rules.configure` | Build, activate, re-review and disable rules | PEG-012, PEG-093, PEG-094, PEG-095 | live (+ external) | none |
| `pegboard.notify.send` | Send reminders, chases and notices | PEG-037, PEG-096, PEG-097, PEG-030 | standard or external | none |
| `pegboard.meetings.import` | Import meeting actions and adopt them | PEG-039 | standard | none |
| `pegboard.portfolios.read` | Read portfolios, rollups and reports | PEG-013, PEG-018 | standard | none |
| `pegboard.goals.update` | Create goals, check in and record observations | PEG-014, PEG-090 | standard | none |
| `pegboard.status.publish` | Draft, publish and discuss status updates | PEG-015, PEG-098, PEG-030 | standard or external · commitment | none |
| `pegboard.status.rights` | Handle a rights request on retained status snapshots | PEG-099 | standard or destructive | none |
| `pegboard.capacity.plan` | Read workload and compare staffing scenarios | PEG-016, PEG-029, PEG-078 | standard | none |
| `pegboard.time.log` | Run timers, enter and submit time | PEG-017 | standard | none |
| `pegboard.time.decide` | Return or approve a timesheet | PEG-017, PEG-088 | commitment | none |
| `pegboard.time.send` | Send approved time to Harvest, QuickBooks Time or Gauge | PEG-042 | external | none |
| `pegboard.reports.export` | Export reports and issue analyst keys | PEG-018, PEG-044 | standard (+ access) (+ external) | none |
| `pegboard.shares.manage` | Invite guests, share work and decide access requests | PEG-019, PEG-083, PEG-100 | access (+ external) | none |
| `pegboard.members.manage` | Change roles, remove members and review access | PEG-020, PEG-032, PEG-045 | access | none |
| `pegboard.integrations.manage` | Connect, test and revoke providers, webhooks and Zapier or Make | PEG-025, PEG-026, PEG-038, PEG-080, PEG-102, PEG-103, PEG-085 | security (+ accounts · gated) | none |
| `pegboard.handoffs.sync` | Link and reconcile engineering, commercial, file and service handoffs | PEG-040, PEG-041, PEG-043, PEG-077 | external | none |
| `pegboard.migration.import` | Import, map and reconcile a source account | PEG-024, PEG-046, PEG-106, PEG-107, PEG-081, PEG-047, PEG-109, PEG-111, PEG-048, PEG-112, PEG-114, PEG-049, PEG-050, PEG-051, PEG-052, PEG-053, PEG-101, PEG-070 | standard (+ gated) | none |
| `pegboard.migration.cutover` | Select a cutover, invite members and guests, or roll back | PEG-054, PEG-108, PEG-110, PEG-113 | commitment · external (+ access) | none |
| `pegboard.assistant.ask` | Ask questions and summarize permitted work | PEG-074, PEG-105 | standard | none |
| `pegboard.teammates.configure` | Define, activate and disable a custom teammate | PEG-075, PEG-028 | access (+ live) | none |
| `pegboard.data.erase` | Preview and run an erasure | PEG-059 | destructive | none |
| `pegboard.data.retention` | Review retention, holds and processor follow-ups | PEG-065 | standard or destructive | none |
| `pegboard.archive.export` | Export a whole-workspace archive | PEG-058 | standard | none |
| `pegboard.trash.restore` | Restore from trash, compare revisions and undo | PEG-064 | standard | none |
| `pegboard.audit.read` | Search and export the audit | PEG-057 | standard | none |
| `pegboard.outcomes.read` | Read coordination and delivery measures | PEG-068 | standard | none |
| `pegboard.mail.configure` | Configure the sender, holds and releases and read suppression | PEG-084, PEG-119, PEG-120, PEG-121 | security or live | none |
| `pegboard.settings.budget` | Change the AI budget and other provider spend | PEG-061, PEG-125 | money | none |

**Resources.** `pegboard://projects/{project}`, `pegboard://tasks/{task}`, `pegboard://portfolios/{portfolio}`, `pegboard://goals/{goal}`, `pegboard://proofs/{proof}/versions/{version}`, `pegboard://timesheets/{timesheet}`, `pegboard://requests/{request}`, `pegboard://status/{update}`. **Events.** `task.created`, `task.updated`, `task.completed`, `task.ready`, `schedule.shifted`, `decision.recorded`, `proof.version_added`, `comment.added`, `timesheet.approved`, `status.published`, `request.submitted`, `rule.ran`, with Base’s `approval.pending`, `approval.decided`, `review.flagged` and `policy.adopted`. **Prompts.** Triage requests (PEG-066), plan from a brief (PEG-029), draft a deliverable (PEG-028), chase owners and draft the weekly status (PEG-030), carry a proof to a decision (PEG-067), repair a slipping schedule (PEG-069), resolve portfolio conflicts (PEG-078) and prove a migration (PEG-070).
**Not tools, and why.** PEG-055, PEG-115, PEG-116, PEG-117 and PEG-118 (the owner’s installation and its setup are installation facts); PEG-056, PEG-124, PEG-086, PEG-122 and PEG-123 (sign-in and owner recovery are a person’s own screens); PEG-021 (identity providers are installation facts); PEG-022, PEG-079 and PEG-076 (the native and desktop apps run on a device); PEG-023 and PEG-063 (speed, continuity and operations are installation facts); PEG-060, PEG-061’s included capabilities and PEG-126 (US defaults, accessibility and published price terms are installation facts); PEG-027 and PEG-062 (the API and MCP door and agent credentials are the door itself); PEG-071 and PEG-104 (work inside chat and mail tools is the connector’s own door).
**Limits.** Capacity limits only: request rate, body size, PEG-082’s 100,000,000-byte attachment limit and archive size, documented on `/docs/agents`. Thresholds on items, recipients and spend, and provider spend caps, are the company’s policy.
**Handoffs.** Listens for Orbit `deal.won`, Buoy milestones, Linen and HappyToHelp escalations, Willow `leave.approved` and Vector issue changes. Emits `task.completed`, `status.published` and `timesheet.approved` for the account (Orbit), delivery-finance (Gauge) and engineering (Vector) specialists.

#### SURFACE-001 — The registry equals this table and the Base harness passes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-013 · *Register:* R-9

**Requirement.** Pegboard serves the Base MCP door at `/mcp` with the tools, resources, events and prompts in this section, each tool calling the same server action as the work UI. The existing public API and MCP operations (PEG-027) move onto that door under their table names.

**Acceptance.**
1. `tools/list` names exactly the tools in the table, each with its declared classes in `_meta`, and their Core clause ids plus the not-a-tool reasons cover every Core clause.
2. The Base conformance harness runs BASE-AGENT-001 to BASE-AGENT-013 on Pegboard’s seeded workspace under the all-autonomous and the held policies, and passes.
3. On the shared fixture, each tool and its UI action give the same record state and audit event type.
4. `resources/templates/list` names the resources above, and a task read for a guest’s sponsor returns exactly the fields that guest sees in the UI.
5. The existing public API MCP operations answer at `/mcp` under their table names, and their old path stays an alias.
6. `/docs/agents` lists every tool, class, resource, event type and prompt in this section.

#### SURFACE-002 — Work, schedule and assignment changes carry standard with the affected people

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Every call that changes work inside the business carries the standard class with facts the server computes from the records: the item count and, for a date or assignment change, the people whose work it changes. An AI-produced date, routing or template choice keeps its AI provenance through later rule steps and is decided as the agent’s call, never covered by a rule activation.

**Acceptance.**
1. Creating, editing, moving or completing work carries standard with its item count.
2. A schedule or assignment change carries standard with the people whose work it changes; a change to the sponsor’s own work names only the sponsor.
3. An argument or record text claiming that a change affects no one else leaves the computed facts unchanged.
4. Under the all-autonomous policy, an agent’s dependency shift applies at once, reads "<agent> for <person>" and keeps PEG-004’s undo.
5. Under the schedule-approval policy, the same shift waits for a named eligible person’s approval of the exact set and applies once approved, with the person as approver and the agent as preparer.
6. An AI-extracted date fed into a deterministic PEG-094 step is decided as the agent’s call under each policy, never applied by the rule’s activation alone.

#### SURFACE-003 — Guest messages, publications, outside shares and provider writes carry external

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Every call that reaches or exposes anything outside the business carries the external class with its recipients and counterparty, and every one an agent completes is attributed to the agent acting for its sponsor.

**Acceptance.**
1. An agent-composed message to a guest carries external with its recipient count; a guest already on the share is a known counterparty and a new recipient is new.
2. A client or executive status publication carries external · commitment.
3. A post or feed to a client-shared channel carries external, whoever can already see the source task.
4. A provider write (Jira, GitHub, Harvest, QuickBooks Time, Gauge, Zapier, Make, DocuSign or a help desk) carries external with that provider account as its counterparty.
5. A public form or link carries external with a public counterparty.
6. Under the held policy an agent’s guest chase waits with no payload sent and goes out once the test person approves it, and the mail names "<agent> for <person>" as its sender.

#### SURFACE-004 — Decisions carry commitment and are attributed truthfully

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Every decision others rely on carries the commitment class with the decided item and version, and an agent’s decision is recorded as the agent’s act for its sponsor, never as the sponsor’s.

**Acceptance.**
1. An approval-task, proof, routed-approval or change-request decision carries commitment with the decided item and its version.
2. A timesheet return or approval carries commitment with the sheet and its total.
3. Accepting a migration loss or selecting a cutover carries commitment.
4. Under the all-autonomous policy an agent’s decision reads "<agent> for <person>" in the record, the activity view and exports, and the owner of the work or the person who logged the time is never the decider.
5. After a person approves an agent’s prepared decision, the record shows the person as approver and the agent as preparer.

#### SURFACE-005 — Access, security, accounts, live and money calls

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006

**Requirement.** Calls that change standing authority, protective settings, outside accounts, running behaviour or spend carry their classes with facts the server computes.

**Acceptance.**
1. A share, guest invitation, membership, role, access-request decision or analyst key carries access with its people and direction.
2. A provider connection, sign-in or sender configuration, or credential change carries security.
3. Registering a provider app in the company’s provider account carries accounts · gated, and the provider’s consent screen goes to the named person.
4. Enabling or disabling a rule, recurring schedule, workflow bundle, teammate, webhook or mail hold carries live.
5. Changing the AI budget carries money with the USD amount.
6. An agent widening its own grant or its sponsor’s role returns `self_escalation` under every policy.

#### SURFACE-006 — Destructive calls, policy setup, Pause and audit

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Irreversible calls carry the destructive class, the company answers every class Pegboard uses before agents act, and every agent call is audited with its classes and decision.

**Acceptance.**
1. Erasure, a trash purge and an executed retention expiry carry destructive with the item count.
2. Before setup answers every class Pegboard uses, an agent call returns `policy_unset` with the setup link, and setup lists those classes with no answer pre-selected.
3. Pause agents stops the next Pegboard call within 60 seconds.
4. The Agents page’s counts by class and decision equal the audit rows for the seeded week.

#### SURFACE-007 — A coordination week under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-013

**Requirement.** A stranger agent runs a seeded coordination week through MCP alone, for a named sponsor with the workspace-administrator role, under two company policies.

**Acceptance.**
1. Given only the seed URL, the agent connects through MCP for the sponsor and lists the Pegboard tools.
2. Under the all-autonomous policy it triages two requests, drafts a plan from a brief, chases two owners, repairs a slipping schedule and publishes a cited weekly status to a client guest with no person involved: nothing waits, nothing is refused by policy and the review feed is empty.
3. Under the held policy the same week runs every standard call and lists it in the review feed, and waits at each external and commitment call, each running once the test person approves it.
4. Under the held policy with external blocked, the client publication and the guest chases return `policy_blocked` and the rest of the week completes.
5. In both runs every record the agent wrote reads "<agent> for <person>", and every approval names the test person.

## Push further

### Agent work and coordination

#### PEG-028 — Assignable teammates do the work

*Tier:* Core

**Requirement.** A scoped agent takes an assigned task and its permitted brief, comments, references and files, produces a real brief, copy, research, plan or creative draft, and attaches its deliverable with source/evidence links for the task’s reviewer. Every tool action, data source, model/provider and cost is logged; unsupported facts and unavailable source material are explicit. A produced draft is not a human-approved finished task. Human sponsors can stop and undo reversible effects under PEG-062. Before execution, each draft type has an explicit brief-derived rubric: required sections, output format, length bounds, audience, required facts and prohibited claims, plus brand/tone constraints linked to a named, versioned team style source. Each factual claim links a permitted source excerpt/record; unsupported claims are flagged individually and cannot be presented as verified. Reviews record accept unchanged, edit then accept or reject, the original/reviewed versions and reasons. PEG-068 measures edits; a mere attachment cannot pass the rubric or mark the task accepted.

**Acceptance.**
1. Assign campaign-copy and sourced-research tasks through Tasks to a scoped agent using an actual configured model edge.
2. Inspect complete attached drafts, cited references and action log; deny hidden context and injected instructions, stop a run and undo an unchanged edit.
3. No one, agent or person, accepts their own deliverable; a person who accepts it or approves its client publication is recorded as the approver, and an agent’s client publication is external under the company’s policy.
4. Use a fixed authorized brief set covering a creative brief, campaign copy, research report, project plan and creative concept, each with its required sections/format/length/audience/style version and factual-source checklist.
5. Run through the real task/agent/review doors and check every rubric item, sources and unsupported flags; exercise accept, edit and reject, compare persisted revisions and measured edits, and leave nonconforming output pending/rejected rather than accepted.

#### PEG-029 — Plan from a brief within real capacity

*Tier:* Core

**Requirement.** An agent reads a permitted brief, request or meeting notes and the relevant task graph, staffing roles, estimates, working calendars and capacity. It proposes phases, tasks, owners, dependencies, milestones and dates with source links, assumptions, missing decisions and infeasible constraints. Creating the planned project and tasks is a standard call with the affected people as facts that the company’s policy decides; where a person approves the plan, they approve its exact version, and changed availability or scope invalidates that preview. Every planned task carries a proposed named owner and positive hour/effort estimate, date constraints and source/assumption; role placeholders are visibly unresolved and must be mapped before publishing. All accepted assignments fit PEG-016’s total committed capacity, dependencies are acyclic and dates honor the brief’s deadline and working calendar. If constraints cannot fit, show the exact infeasibility and alternatives rather than calling an overloaded plan feasible. The plan rubric additionally covers required phases/deliverables/milestones from the brief and the versioned style/spec source, with accept/edit/reject and edit measures as for PEG-028.

**Acceptance.**
1. Submit a real launch brief with a holiday, time-off conflict and constrained designer.
2. Review a complete feasible draft or explicit infeasibility with alternatives, edit role/date choices and approve once through Plan review.
3. Under the schedule-approval policy, nothing is created before approval; a stale review refuses, and a repeated accepted request produces one project.
4. For fixed campaign-launch, client-onboarding and event briefs, check required phases/deliverables, every owner/estimate, graph/calendar constraints and aggregate capacity before approval.
5. One feasible case must fit its deadline; one impossible case must name the shortage and await a human decision to change the brief/capacity.
6. Compare edited/accepted/rejected plan revisions and ensure an unresolved owner or unapproved deadline change cannot publish.

#### PEG-030 — Coordinate through actual updates and proposed re-plans

*Tier:* Core · *Rules:* D-5, D-6, D-7, D-9

**Requirement.** Agents inspect permitted requests, activity, dependency/critical-path changes and approval deadlines, triage intake, chase owners in Slack, Teams, Nook and email under the company’s policy, reconcile authenticated replies to the correct task and draft weekly project/portfolio status citing source activity. Slippage produces concrete re-plan alternatives. Published plans and executive or client-visible content are commitment and external, dates affecting others are standard with the affected people as facts, spend is money and external sends are external; the company’s policy decides each, and no reply or silence is fabricated into progress. Routine company-only chases and draft notifications follow the internal notification policy (D-5); a client or executive publication and an agent-written outside-organization send are external (D-7). Fixed system notices to a current guest about reviewed shared work follow the share-approved notice path, including when the coordinator triggers that event, without turning agent-written content into a system notice. On-demand and weekly status use PEG-074’s cited summaries and PEG-028’s deliverable rubric, with actual accept/edit/reject results flowing into PEG-068. Each Slack/Teams/mail chase requires that specific connected provider feature and linked actor grant under PEG-080, with a named missing/broken connection and guide on the project and chase run. The agent does not claim a chase was sent or silently switch transport while disconnected; a new transport or audience is classed afresh under the company’s policy.

**Acceptance.**
1. Under the held policy, make a task stale, approve the agent’s chase and reply through each chat/mail adapter; inspect the attributed update and stopped reminder.
2. Under the schedule-approval policy, delay its predecessor and review a capacity-checked re-plan waiting for approval.
3. Open the weekly status draft, follow citations and reject a wrong assertion; no unapproved date/publication change occurs.
4. Under the held policy, run an internal stale-task chase that sends without waiting, then the same chase to a client guest, which waits for the test person’s approval.
5. Check the status draft’s required health/highlights/risks/next-steps sections against its date window and source tasks before the person publishes.
6. Schedule the same internal chase with Slack, Teams or Gmail/Outlook absent in separate cases; observe the exact missing-provider state and guide plus one retained blocked job and no send.
7. Complete the corresponding live guide/link step and resume once, process the real signed/authenticated reply into the task and stop follow-up under the original permissions.
8. Exercise PEG-084’s unauthenticated-domain block, PEG-120’s signed bounce/complaint suppression and PEG-121’s throttle/restart cases for this email path without duplicate, silent-drop or false-delivered outcomes.

#### PEG-066 — Triage until work has an owner and a next step

*Tier:* Core

**Requirement.** With the request text, attachments, existing task graph and the company’s intake settings, an agent identifies likely duplicates, missing information, routing and priority alternatives, prepares clarifying questions and follows accepted work to assignment and a scheduled next action. Reversible internal routing is standard; priority tradeoffs are standard with the affected teams as facts, new access grants are access and external replies are external, and the company’s policy decides each. Confidence and conflicting evidence stay visible.

**Acceptance.**
1. Submit an ambiguous request and a near-duplicate with a malicious instruction.
2. Under the held policy, through Intake inspect cited candidates and proposed routing, approve the agent’s clarification and process its reply.
3. Under the held policy a person decides merge/priority and acceptance; the agent then verifies an actual owner and next action without changing another team’s commitment or granting access.

#### PEG-067 — Carry creative review to an accountable decision

*Tier:* Core · *Rules:* D-6, D-7

**Requirement.** An agent reads allowed asset versions, pinned feedback, stage/quorum policy and review deadlines, groups unresolved feedback, drafts a revision brief and prepares exact reviewer reminders. Fixed system reminders for a currently reviewed proof share use that share’s approval and the approver’s preferences; agent-composed reviewer messages are external (D-7). It follows missing reviewers, reopened feedback and returned revisions until the right humans sign the current asset or an accountable owner explicitly stops the work. It never signs on a person's behalf or carries a prior-version decision forward.

**Acceptance.**
1. Run a campaign proof through missing external review, request-changes and v3 replacement.
2. Inspect a sourced revision brief, an ordinary proof reminder authorized by the reviewed share, and, under the held policy, an agent-written reminder sent once the test person approved it; reject an old-v2 approval and observe the actual human v3 sign-off close follow-up.
3. No merely delivered reminder or generated replacement is marked approved.

#### PEG-068 — Measure coordination and delivery outcomes honestly

*Tier:* Core · *Register:* R-10

**Requirement.** Per-project measures use logged human planning/chasing/reporting time, agent runs, reviewed commitments, baseline dates and actual completion to show PM overhead and surprise slips. The owner selects comparison periods and cohort rules; exports expose definitions, denominators, missing data and overrides. Estimated time saved stays labeled and cannot be inferred solely from token counts, notifications or model self-report. For textual drafts, store Unicode-NFC normalized token-level Levenshtein distance between generated and accepted text, divided by the greater token count, with raw counts and tokenization version; for structured plans, also show task/field/edge additions, removals and changes by stable draft identity. Accept unchanged has zero distance, reject remains a separate outcome, and cosmetic normalization rules are disclosed. Report accepted-without-edit chases/status drafts, edited accepts and rejects per project. A versioned fixed reference-campaign benchmark with 20 stale tasks, two weekly reports and a controlled slippage event requires at least 16 correctly reconciled agent-handled internal chases and both cited status drafts accepted unchanged by a human, no prohibited action, no surprise critical-path slip left unreported before its due time, and fewer logged human coordination minutes than the matched manual run; retain all attempts and failures, not a cherry-picked success.

**Acceptance.**
1. Use a completed project with attributable human time entries, agent activity, an approved baseline and actual finish.
2. Through Outcomes, reconcile hours and slip counts to source rows, change the comparison window and include a project with missing time.
3. Observe correct exclusions/unknowns and a plain refusal to claim proven savings from insufficient data.
4. Through Outcomes, reconcile edit distance for an unchanged accept, a one-token edit and a rejection; for a plan compare field/edge diffs separately.
5. Execute the reference campaign and its matched manual run with the same brief, workload and scripted edge responses, record timings and source decisions and test the stated 16/20, two-report and reduced-minute criteria.
6. Report actual failures or insufficient data without claiming benchmark success; no benchmark model output is mocked.

#### PEG-069 — Preserve focus while repairing a slipping schedule

*Tier:* Core

**Requirement.** Agents combine permitted free/busy windows, task estimates/actuals, priorities, locks, dependencies and capacity to propose focus blocks and alternative recovery plans, show displaced work and quantify which commitments remain infeasible. A person’s own scheduling policy maintains their unlocked blocks; a team-affecting date change is standard with the affected people as facts, and the company’s policy decides it. Accepted plans are verified against actual calendar and work state until reconciled.

**Acceptance.**
1. Overrun a task while a meeting consumes its next block, lock a focus period and delay a shared milestone.
2. Under the schedule-approval policy, review alternative plans in Calendar/Timeline, approve one and inspect the provider events and task dates.
3. Hidden availability, stale proposals and capacity shortfalls remain explicit, with no overwritten lock or unapproved colleague deadline.

#### PEG-078 — Resolve resource conflicts across a portfolio

*Tier:* Core

**Requirement.** A scoped capacity agent reads the permitted nested portfolio’s commitments, dependency graph, estimates/actuals, role/skill requirements, working calendars and approved availability. It proposes ranked cross-project staffing/reassignment and schedule alternatives with affected people/tasks, preserved locks, total hours, displaced commitments and unresolved constraints; it does not call a solution feasible while any affected person remains over capacity or a deadline tradeoff is hidden. Reassignments and date changes are standard with the affected people as facts, and the company’s policy decides them; where it holds them for approval, a person with authority over the whole affected set approves the exact set, or approval routes to the relevant project owners. Accepted changes are applied once with fresh version/capacity checks, attributed history and undo, then verified against actual workload.

**Acceptance.**
1. Create a 30-project portfolio where two projects compete for one designer, a qualified alternate has space and a third project has a locked commitment.
2. Under the schedule-approval policy, run the agent through Portfolio capacity, compare two sourced alternatives, approve reassignment to the alternate and inspect conflict-free total workload, unchanged lock and one attributed application.
3. Change an estimate during review, remove a project grant and test a portfolio with no feasible staffing; require refreshed review/limited context or an explicit shortage without automatic reassignment or deadline movement.

#### PEG-070 — An agent helps prove the migration

*Tier:* Core

**Requirement.** Given authorized exports, source schema definitions, mappings and comparison results, an agent proposes field/person/status/dependency mappings, identifies fidelity and permission differences, explains missing history/assets and prepares repair/cutover steps. Its evidence links back to source rows and object IDs. It cannot invent data or mark migration complete; accepting a loss and selecting cutover are commitment, granting access is access and activating source automations is live, and the company’s policy decides each.

**Acceptance.**
1. Give a migration preview with an unknown status, expired file link, duplicate identity and conflicting owner change to the agent.
2. Under the held policy, the owner resolves the sourced repair suggestions and reruns reconciliation; cutover continues only after the test person approves it, and all unresolved losses remain visible in the final report.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | A person’s visual and screen-reader inspection of the browser journeys at 1440 and 390, over the daily, client review, form, export and admin flows | PEG-060 | not run | | |
| R-2 | A Section 508 conformance report (VPAT) for the web app | PEG-060 | not run | | |
| R-3 | Live provider qualification: provider app registration, consent and a real account or tenant for each named integration (Slack, Teams, Google Workspace, Microsoft 365, Zoom, Google Meet, Calendar, Drive, Dropbox, Box, Figma, Canva, Adobe, Jira, GitHub, Harvest, QuickBooks Time, Gauge, Tableau, Power BI and the help desks), recorded with timestamps | PEG-039, PEG-017, PEG-025, PEG-026, PEG-080, PEG-104, PEG-040, PEG-042, PEG-044 | not run | | |
| R-4 | Public App Store and Google Play listings, installs on stock iPhone and Android phones from those listings, and the production push relay through APNs and FCM | PEG-022, PEG-079 | not run | | |
| R-5 | Real Gmail and real Microsoft 365 inbox qualification with trusted SPF, DKIM and DMARC-pass headers for invitations, sign-in links and notices | PEG-118, PEG-084, PEG-119, PEG-056 | not run | | |
| R-6 | Zapier public app directory and Make public catalogue listings under Run Edit Run, with live round trips in real accounts on both platforms | PEG-026, PEG-085 | not run | | |
| R-7 | A non-technical tester’s timed browser-only runs, with screen recordings, of first setup, the four provider guides and a whole-account migration | PEG-080, PEG-081, PEG-109, PEG-112, PEG-055 | not run | | |
| R-8 | Real Okta, Microsoft Entra ID and Google identity tenants (BASE-SIGNIN-001) | PEG-021 | not run | | |
| R-9 | Receipts that the MCP door works in installed Claude, ChatGPT, Gemini, Cursor and Copilot clients | PEG-027, SURFACE-001 | not run | | |
| R-10 | Elapsed months and live people: a month of independent availability probes against the 99.9% target, and the coordination benchmark’s matched manual run with a real human reviewer | PEG-063, PEG-068 | not run | | |

## Boundaries

- This is one independent product. Workspaces are organizational divisions inside an owner-run business installation; a separate isolated business uses a separate installation. Reporting, workload, time tracking, unlimited guests and agent teammates are included, with no seat minimums or buckets. Difficulty, provider app approval, native mobile distribution and source export limitations are engineering obligations, never reasons to drop a clause.
- Dollar budgets, rates, margin and invoicing belong to Gauge; Pegboard's USD field is work metadata, not a billing ledger.
- These boundaries preserve complete business-work management and connect specialist products through explicit handoffs. A source-system failure becomes visible, accountable work in Pegboard; a sibling link is not a claim that an adapter already exists. Every sibling remains its own product.
- **Software engineering:** [Vector](https://github.com/just-every/run-vector) owns issues, cycles and code-host flow. PEG-040 links and reconciles Vector/Jira/GitHub state with business deliverables.
- **Arbitrary relational apps and tables:** [Cradle](https://github.com/just-every/run-cradle) owns Airtable/Smartsheet-style databases, interfaces and internal apps. PEG-002 keeps custom fields on a fixed work graph; PEG-053 migrates work rows and routes unrelated applications to Cradle.
- **Professional-services economics:** [Gauge](https://github.com/just-every/run-gauge) owns rates, dollar budgets, margin, utilization and invoicing. PEG-017/042 retain task effort and timesheets and reconcile approved entries with Gauge, Harvest or QuickBooks Time.
- **Knowledge base:** [Slate](https://github.com/just-every/run-slate) owns the wiki. PEG-010/048 link knowledge pages and preserve local project briefs and task descriptions.
- **Workplace chat:** [Nook](https://github.com/just-every/run-nook) owns channels/chat. PEG-008/026/037 capture tasks, unfurl and send approved updates/decisions in Nook, Slack and Teams; task comments stay in Pegboard.
- **Cross-app automation:** [Crank](https://github.com/just-every/run-crank) owns cross-app workflow composition. PEG-012 acts on Pegboard work and invokes webhooks/Crank; PEG-026 includes Zapier and Make adapters.
- **General forms and surveys:** [Pencil](https://github.com/just-every/run-pencil) owns surveys, payments and general forms. PEG-007 provides work-request intake and accepts authorized Pencil response handoffs.
- **Meeting booking:** [Dial](https://github.com/just-every/run-dial) owns public booking links. PEG-025 owns task dates, time blocks and calendar reconciliation.
- **File storage and sync:** [Chest](https://github.com/just-every/run-chest) and authorized external drives own shared file storage/sync. PEG-011/043 own task attachments, version-bound proofing and review results.
- **Sales and account health:** [Orbit](https://github.com/just-every/run-orbit) owns deals and [Buoy](https://github.com/just-every/run-buoy) owns customer success. PEG-041 turns a won deal or selected CS milestone into a delivery project with backlinks and controlled status return.
- **Service tickets and ticket SLAs:** [Linen](https://github.com/just-every/run-linen) and [HappyToHelp](https://github.com/just-every/run-happytohelp) own IT/customer help desks. PEG-041 handles escalations that become project work. PEG-007's triage deadline is not a ticketing product.
- **Campaign sending:** [Mango](https://github.com/just-every/run-mango) owns audience/campaign distribution. Pegboard runs the campaign project and its approval evidence; approved asset/link handoff does not duplicate a marketing sender.
- **Employment and time off:** [Willow](https://github.com/just-every/run-willow) owns HRIS, employee onboarding and time-off authority. PEG-016/026 read approved time off for capacity and link onboarding project work; Pegboard never changes leave entitlements.
- **Vertical practice work:** [Blotter](https://github.com/just-every/run-blotter), [Plinth](https://github.com/just-every/run-plinth) and [Satchel](https://github.com/just-every/run-satchel) own their trades' practice/construction operations and recurring client work. Pegboard stays horizontal and links cross-functional deliverables rather than taking over their systems of record.
- **Identity, mail, AI and mobile transport:** [Auth](https://github.com/just-every/run-auth), configured IdPs, mailbox providers, owner-approved models, APNs and FCM supply provider services. PEG-021/022/026/056/062 still require registration, consent, scoped execution and observable delivery; the provider is not a scope exemption.

## Homepage claims

| # | Section | Claim | Clauses |
| --- | --- | --- | --- |
| 1 | 01 Hero | 100% free, open source alternative to established work-management products | PEG-061, PEG-024 |
| 2 | 01 Hero | Turns briefs and requests into plans that fit everyone's week | PEG-029, PEG-007, PEG-016 |
| 3 | 01 Hero | Gets client sign-off on proofs | PEG-011, PEG-019, PEG-036 |
| 4 | 01 Hero | Writes the weekly status from real work | PEG-015, PEG-030 |
| 5 | 01 Hero | Run Pegboard on your own computer with one command | PEG-055 |
| 6 | 02 October | Six teams' work with owners, dates and due/done counts per week | PEG-001, PEG-003, PEG-018 |
| 7 | 02 October | Work moved to the next working day is shown as moved, not hidden | PEG-004 |
| 8 | 03 Intake | Requests from a form, email and Slack land in one triage queue | PEG-007, PEG-008, PEG-071 |
| 9 | 03 Intake | The agent fills in requests, links duplicates, drafts a first pass; a person accepts the triage | PEG-066, PEG-028 |
| 10 | 03 Intake | A rule routes holiday requests to a project and shows how often it ran | PEG-012 |
| 11 | 03 Intake | Triage due time and done time on each request | PEG-007 |
| 12 | 04 Brief | A pasted brief becomes a draft plan with phases, owners, dependencies and milestones | PEG-029, PEG-001, PEG-004 |
| 13 | 04 Brief | The plan is checked against nine people's workloads and calendars before anything is created | PEG-029, PEG-016, PEG-025 |
| 14 | 04 Brief | Nothing is created until a person approves the plan | PEG-029, PEG-062 |
| 15 | 04 Brief | A Jira issue is linked with its status synced | PEG-040 |
| 16 | 05 Workload | An hours board per person against capacity; dragging tasks to teammates evens it out | PEG-016, PEG-003 |
| 17 | 05 Workload | A Slack question becomes a task and the thread is updated when it is done | PEG-008, PEG-071 |
| 18 | 06 Proofing | Client guests join free, pin comments on a version and approve it, also from a phone | PEG-011, PEG-019, PEG-036, PEG-022 |
| 19 | 06 Proofing | Versions v1–v3 with every comment resolved on the next version | PEG-011, PEG-067 |
| 20 | 06 Proofing | Timesheets approved by a manager and sent to Gauge | PEG-017, PEG-042, PEG-088 |
| 21 | 07 Status | The agent drafts the weekly status from the week's updates, each line citing its tasks; a person edits and sends it | PEG-015, PEG-030 |
| 22 | 07 Status | The status reaches 14 people in Slack and email | PEG-015, PEG-071 |
| 23 | 08 Onboarding | A template sets every date from a start date in working days | PEG-006, PEG-004 |
| 24 | 08 Onboarding | The agent chases owners in Teams, reads time off from Outlook, and replies close the tasks | PEG-030, PEG-037, PEG-025, PEG-071 |
| 25 | 09 Re-plan | An email on a task, auto-shift of dependants over working days, baselines and a critical path | PEG-004, PEG-008 |
| 26 | 09 Re-plan | The agent sees the slip and proposes one change; a person approves before dates move for others | PEG-030, PEG-069, PEG-062 |
| 27 | 11 Next week | Time off from calendars, task work blocked into free hours, every week fitting capacity | PEG-025, PEG-016, PEG-073 |
| 28 | 12 Switching | 18 projects moved from one project-management source with guests, comments, history, fields and every dependency | PEG-024, PEG-046, PEG-081 |
| 29 | 12 Switching | Moves from supported board, workspace, creative-work and spreadsheet sources, including CSV | PEG-047, PEG-048, PEG-049, PEG-053 |
| 30 | 12 Switching | `npx -y @runeditrun/rer dev just-every/run-pegboard` starts Pegboard | PEG-055 |
| 31 | 13 Closing | 100% free and open source | PEG-061 |

## Status

Judged from the code and tests at commit `356a5cdc040760c51ce95c33e599606da0ee7867` (27 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 1 | 0 | 0 | 1 |
| Target and push further | 16 | 17 | 99 | 132 |
| All | 17 | 17 | 99 | 133 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `PEG-001` | One work graph | published | done | `tests/journeys/work-graph.journey.mjs` (1440 and 390 px: a campaign and a launch project built in Projects, one task hung in both, a subtask completed, its one ID and one history, the change seen from either project) and `tests/work-graph.test.mjs` “builds a campaign and a launch project, multi-homes one task and keeps one history”; guest: `tests/work-graph.test.mjs` “shows a guest on one project nothing of the other, through the API, exports and files” and the journey's guest pages and exports; personal task and references: `tests/work-graph.test.mjs` “keeps a personal task private and resolves every reference a task has had, to those allowed only” and the journey's prefix change through the link door; PEG-083 journeys: `tests/work-graph.test.mjs` “runs the PEG-083 public-team join and private-link request journeys on this graph” and the journey's join, refusal, request and inbox approval. |  |
| `PEG-002` | Fields, statuses and shared definitions | target | done | Recurring project field identity, independent copied values and a changed-definition hold: `tests/work-graph.test.mjs` “pins recurring work templates and generates one occurrence across restart, DST, exceptions and concurrent runners”; shared formula updates in task/report/settings and a pinned-definition hold at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Accountable recurring work”. Typed fields/library/statuses and consistent task/report/API results: `tests/work-graph.test.mjs` “creates all typed fields, shared identities and consistent task/report/API calculations”; safe calculation/type changes: “explains cycles, missing and hidden inputs and refuses lossy or stale type changes”; separate tags, three-project rename/filter and filtered counts: “keeps free-form campaign tags distinct, renames once and filters three projects without hidden counts”; role denials: “enforces Viewer values and tagging denial and Editor definition denial on every field/status door”, plus the guest cases in the previous two tests. `tests/journeys/work-graph.journey.mjs`, fields/tag journey at 1440/390, creates every type in Project Settings, adopts one identity across three projects, edits typed inputs, compares task/report results, shows cycle/hidden-input explanations, previews an incompatible type change and renames/filters a three-project campaign tag. |  |
| `PEG-003` | Every work view on the same records | target | missing |  | No implementation exists for every work view on the same records; the complete behavior and public-door acceptance journey remain required. |
| `PEG-004` | Dependencies and believable schedules | target | done | Point 1: `tests/schedule.test.mjs` “previews and applies all four dependency types over the July 4 holiday and a weekend, then a daylight-saving change, with the chain explained” proves all types, holiday, weekend, DST, historical baseline, variance and independently expected critical membership and slack; “computes exact branching slack, negative lead and milestone dates and refuses an impossible completed-dependent cascade atomically” proves the branching graph, lead, milestone and completed-dependent refusal. `tests/scenarios/schedule-calendar.mjs`, registered in the same file, “uses persisted working hours and personal time off for requested timed edits and dependent shifts across DST”, “preserves timed duration through partial time off and refuses stale calendars and leave revisions without partial writes” and “limits calendar configuration to administrators and personal leave to its owner without exposing private reasons” prove configured hours, leave, duration, stale calendar fencing and authority. Point 2: the schedule case “refuses a cycle and a stale plan and leaves every downstream date untouched” proves both refusals and unchanged dates. Point 3: “lets a project editor confirm a previewed set once, attributed to them, with undo and no second approval; a viewer and an agent cannot shift anything” and `tests/journeys/timeline.mjs` “timelineJourney” prove the editor, exact once-only shifts, attribution, undo, actual held pointer preview and confirming release. Point 4: that same editor case proves the agent pending proposal, eligible named human approval and viewer refusal; the stale-plan case proves stale edit refusal. Point 5: `tests/scenarios/schedule-rules.mjs`, registered in the schedule file, “applies a reviewed cross-project rule cascade once with assignment, work action, attribution and coherent undo” and “holds an inseparable hidden cascade without effects or disclosure and refuses a revoked activating Admin” prove current activation, exact scope, atomic propagation, hidden pending work, current authority, restart, replay, coherent undo and exact one-run human approval with stale and permission refusals. Point 6: `tests/scenarios/readiness.mjs`, registered in the schedule file, “notifies the current assignee once after two blockers including concurrent and replayed completion on the schedule graph”, “reroutes queued readiness to the current assignee and honors mute, quiet hours, digest and revoked access” and “keeps a scoped guest and hidden predecessors private and cancels obsolete readiness before a fresh graph transition” prove the named readiness cases, an actual rendered Inbox card, current audience, preferences, cancellation and fresh transition. Native preview and apply in all five views, working settings, personal leave, Inbox, rule scope and held-run approval at 1440 and 390: “timelineJourney”, including `tests/journeys/schedule-settings.mjs` “scheduleSettingsJourney”, invoked by the planning Verify shard through `tests/journeys/work-graph.journey.mjs`. API semantics: `docs/WORK-PLANNING-API.md`. Proof repair: the editor case explicitly refuses both an analyst and a guest nominated by the autonomous agent, despite their project Editor grants, and asserts every project schedule date and the pending proposal set unchanged before accepting the eligible human nominee. The native Timeline journey navigates to Preview and Apply with Tab, asserts focus on each submit control and activates each with Enter before asserting exact persisted dates and one attributed shift. |  |
| `PEG-005` | Recurring work and human decisions | target | done | Weekly task and monthly project recurrence, pinned templates, exceptions/end/completion schedules and one transactional occurrence across restart/concurrency/DST: `tests/work-graph.test.mjs` “pins recurring work templates and generates one occurrence across restart, DST, exceptions and concurrent runners”. Human changes/approve/reject, exact revisions, stale/self/agent refusal and no copied decisions: “attributes approval-task decisions to the reviewed revision and refuses copied, stale, self and agent sign-off”. Former/current/admin-owner refusal, waiting reasons and no notification: “never lets an approval task's owner, former owner or an approve-only grant decide it, says why it waits and notifies no one”. Every existing reopening door records its writer, while no-ops preserve sign-off: “attributes every existing sign-off reopening door to its writer without inventing a reopen for a no-op”. Pinned-home authority: “writes a recurring task only into projects where its activator still holds authority”. The recurrence assertion also proves shared library identities, independent occurrence values and a hold after a pinned definition changes. Weekly recurrence and approval states at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Recurring work and human decisions”; monthly project audience/restart: “Accountable recurring work”. PEG-089 proves occurrence audiences and oversight. Product API: `docs/WORK-PLANNING-API.md`. |  |
| `PEG-089` | Accountable recurring work | target | done | Monthly team-visible onboarding, selected direct Editor and internal team grants, guest exclusion, unreachable assignees in preview/occurrence, and one audience across restart/concurrent replay: `tests/work-graph.test.mjs` “reviews one standing internal recurring audience, names unreachable assignees and applies it once across restart and replay”. Lost activator authority, changed audience, visible cause/accountable owner, reviewed recovery and non-activator project Admin stop: “holds changed recurring audiences and lost authority without sharing, retains oversight and requires a fresh reviewed audience”. Pinned task homes after source removal: “writes a recurring task only into projects where its activator still holds authority”. UI monthly activation, audience/assignee disclosure, permitted team/Editor reads, guest refusal, restart, held generation, pinned-home refusal and project Admin oversight/stop at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Accountable recurring work”. |  |
| `PEG-006` | Useful reusable templates | target | done | Point 1: `tests/portfolios.test.mjs` “instantiates every gallery family with reviewed working dates, nested work, owners, fields, dependencies, pending approvals and inactive rules” and “captures task and project structures as scoped reusable templates and separately activates retained rules”; `tests/journeys/template-gallery.mjs` “templateGalleryJourney” at 1440 and 390. Point 2: the same test file, “requires an explicit missing-role choice and applies a new template version only after review while retaining human edits”, and the same browser journey. Point 3: `tests/work-graph.test.mjs` “duplicates only selected work with fresh identities and provenance, concrete original or relative dates, and no copied approvals, private context or active authority”, “preserves approve-only, restricted and assignee memberships when their staged grants are explicitly activated” and “refuses detached children, stale previews and revoked source membership at copy and activation time”; `tests/journeys/project-duplicate.mjs` “projectDuplicateJourney” at both widths. Point 4: `tests/portfolios.test.mjs` “applies activated pinned template dates and assignments before responding, with durable once-only runs and no recursive generation” and “holds a changed template or mapping until exact reactivation and rechecks the activating administrator before execution”; `tests/journeys/template-rules.mjs` “templateRuleJourney” at both widths. Point 5: the same file, “holds an agent-selected template and date for exact human review and refuses changed choices, replay after revocation and unauthorized settings”, plus the exact per-run AI date review in the changed-template rule test. `tests/journeys/templates.mjs` runs all three browser journeys through the native screens. |  |
| `PEG-087` | Convert work without losing its history | target | done | Point 1, both project conversions: `tests/scenarios/conversions.mjs`, registered by `tests/work-graph.test.mjs`, “converts a nested intake task to one linked project while conserving native evidence and scopes” and “converts a populated project with chosen nested work and explicit retained links while preserving inert configuration”; `tests/journeys/conversion-projects.mjs` “projectConversionJourney” at 1440 and 390. Point 2, old links and reconciliation: the same first API case compares native counts, authorship, exact durations, file and proof digests, historical aliases and scoped grants, including recurring source classification; the same browser journey opens original links and retained evidence. Point 3, hierarchy and refusals: the same API helper, “promotes and demotes the same task identities and refuses cycles, disclosure, stale review and unauthorized targets”; `tests/journeys/conversion-hierarchy.mjs` “hierarchyConversionJourney” at both widths. Point 4, inert settings, replay and selective undo: the populated-project case and “replays conversion once and selectively undoes structural effects without deleting later human edits or restoring sign-off”, plus both browser journeys. `tests/journeys/conversions.mjs` runs the two native journeys at both widths with reflow, browser-error and icon-control checks. Proof repair: the first API case asserts restricted capabilities, assignee and approve-only paths, retained expiry, expired-access refusal, complete preview membership and capacity values, and the exact historical-entry total including the attributed sign-off reopen. The hierarchy case asserts evidence and historical-entry conservation through both directions, maximum-depth refusal, stale-review atomicity, and target-only authority loss while source access remains current. The replay case races duplicate applies and proves one survivor. The project browser journey semantically asserts preview work, owner, dates, evidence values, audience, capacity and all six inert repair links, plus assigned-work screens before and after conversion; both browser journeys use keyboard activation and assert the accessible review structure. Independent proof repair: the first API case asserts exact comment, reference, field and collaborator totals and independently attributed task, comment, file, proof, time and history records. The hierarchy case edits only the target while its editor retains authority, refuses the old token and asserts all three records unchanged. The project journey asserts every preview total, the comment author, named collaborator link and all six original and current references. |  |
| `PEG-031` | Find and safely change work at scale | target | missing |  | No implementation exists for find and safely change work at scale; the complete behavior and public-door acceptance journey remain required. |
| `PEG-033` | Visual business-work planning | target | done | Point 1, two members rearranging the mind map, promoting a reviewed note and editing the same task in List: `tests/work-graph.test.mjs` “collaborates on a planning canvas and promotes a reviewed note once into the native List task”; `tests/journeys/work-graph.journey.mjs` “Planning canvas collaboration” (implemented in `tests/journeys/planning-canvas.mjs`), through both members’ browser forms at 1440 and 390. Point 2, current task identity and state, portable restored content and guest privacy: the same integration test proves one task and creation history, current title, owner and status, unchanged dates, restart, scoped guest edits, hidden-node refusal and filtered exports including a raised workspace export level; “restores exported canvas relationships and native task identity through the installation archive” proves exact native archive restoration with inactive old grants. The same browser journey’s “Planning canvas native archive restore” proves restored branches, task IDs, owner and state at 1440 and 390; its collaboration flow proves hidden guest content, filtered downloads and cleared context after revocation at both widths. Semantics: `docs/PLANNING-CANVAS.md`. |  |
| `PEG-034` | Reusable workflow bundles | target | done | `tests/portfolios.test.mjs` “applies all five bundle component types to three projects and runs their real fields, saved view, task template, rule and human approval stages” proves point 1 (three adoptions of fields, views, rules, templates and approval stages, with actual consumers); “previews upgrades, preserves local overrides and unchosen changes, refuses incompatible and stale adoption, and cancels obsolete queued actions on disable” proves point 1’s local rule and new-version preview and point 2’s selective compatible adoption, preserved override, task history and human decisions, and disabled queued actions. `tests/journeys/workflow-bundles.mjs` “workflowBundleJourney”, invoked by `tests/journeys/work-graph.journey.mjs`, proves both points through Settings, bundle authoring, adoption, upgrade, saved List, fresh template tasks and human approval stages at 1440 and 390 pixels. |  |
| `PEG-035` | Risks, decisions and change requests | target | done | `tests/portfolios.test.mjs` “carries an accountable dependency risk through rejected and accepted changes into linked work and the existing portfolio status” proves point 1 (accountable risk, mitigation and scope and date proposals) and point 2 (named human approval, retained rejected alternative and original baseline, actual dependency shifts, task links and portfolio status citations); “refuses stale changes and agents, and filters records against current linked-work access” proves current authority, stale-plan refusal and durable records. `tests/journeys/delivery-register.mjs` “deliveryRegisterJourney”, invoked by `tests/journeys/work-graph.journey.mjs`, proves both points through the project, register, task and existing portfolio status screens at 1440 and 390 pixels. |  |
| `PEG-007` | Request intake and triage | target | missing |  | No implementation exists for request intake and triage; the complete behavior and public-door acceptance journey remain required. |
| `PEG-082` | Attachment limits and pre-transfer checks | target | missing |  | No implementation exists for resumable attachments with owned byte custody; the complete behavior and public-door acceptance journey remain required. |
| `PEG-091` | Resumable transfer and owned byte custody | target | missing |  | No implementation exists for resumable transfer and owned byte custody; the complete behavior and public-door acceptance journey remain required. |
| `PEG-092` | Proof revision upload grants and migrated attachments | target | missing |  | No implementation exists for proof revision upload grants and migrated attachments; the complete behavior and public-door acceptance journey remain required. |
| `PEG-008` | Capture where the team already works | target | missing |  | No implementation exists for capture where the team already works; the complete behavior and public-door acceptance journey remain required. |
| `PEG-009` | My Tasks and useful notifications | target | missing |  | No implementation exists for my tasks and useful notifications; the complete behavior and public-door acceptance journey remain required. |
| `PEG-010` | Collaboration with a complete history | target | missing |  | No implementation exists for collaboration with a complete history; the complete behavior and public-door acceptance journey remain required. |
| `PEG-011` | Version-specific creative proofing | target | missing |  | No implementation exists for version-specific creative proofing; the complete behavior and public-door acceptance journey remain required. |
| `PEG-012` | Rule builder, run log and configuration authority | target | missing |  | No implementation exists for explainable local work rules; the complete behavior and public-door acceptance journey remain required. |
| `PEG-093` | Rule notices, posts and disclosures | target | missing |  | No implementation exists for rule notices, posts and disclosures; the complete behavior and public-door acceptance journey remain required. |
| `PEG-094` | Deterministic rule dates and reviewed activation | target | missing |  | No implementation exists for deterministic rule dates and reviewed activation; the complete behavior and public-door acceptance journey remain required. |
| `PEG-095` | Holiday calendar changes and bulk re-review | target | missing |  | No implementation exists for holiday calendar changes and bulk re-review; the complete behavior and public-door acceptance journey remain required. |
| `PEG-036` | Approval routing and external review custody | target | done | Sentences 1 and 2: `tests/work-graph.test.mjs` “routes ordered proof stages with independent named humans, delegates, and binds expiring revoked links to the exact replacement bytes” proves ordered stages, separate parallel-stage quorum with a later stage decided first, exact due dates, named authority, delegation, changes, attributed version-bound votes, link expiry, revocation, unshared and revoked metadata refusal, and stale replacement refusal. The same file, “refuses routing and sharing proof bytes from an unreadable project context”, proves current material-context authority at preview, configuration and sharing, revoked-context refusal and the authorized exact-byte share. Sentences 3 and 4: the same file, “sends a reviewed PDF-v2 reminder once through the mail seam without comments or an implicit approval and respects muted preferences”, proves exact recipient, safe text and HTML with the reviewed version and recipient link, due time, one submission, mute refusal and pending human decision through a Resend official-schema edge labelled schema-fake; no provider delivery or inbox acceptance is claimed. Sentences 5 and 6: the same file, “requires quorum on an approval task, refuses current and prior owners and agents, and never lets the old decision door bypass named capability checks”, proves task quorum, concurrent decisions, owner and prior-owner nomination and decision refusal, current capability checks, replay, stale revisions after tag and collaborator additions and removals, persistent invalidation after restoring their original values, retained attributed votes and fresh human review, distinct attributed reopening entries and actors for routing and withdrawal, and obsolete and repeated withdrawal refusal without state or history changes. `tests/journeys/approval-routing.mjs` “approvalRoutingJourney”, invoked by `tests/journeys/work-graph.journey.mjs` in push Verify, proves native proof and task configuration, visible exact due dates, named quorum, delegation, guest review and decisions at 1440 pixels, with the linked task title, description and visible reviewed revision, and manager and recipient pending and approved screens plus routing preview at 1440 and 390 pixels, and the reopened stale task route at both widths with the old guest link refused. |  |
| `PEG-037` | Reminders, escalation and delivery outcomes | target | missing |  | No implementation exists for durable follow-up and delivery outcomes; the complete behavior and public-door acceptance journey remain required. |
| `PEG-096` | Ready to start notice | target | missing |  | No implementation exists for ready to start notice; the complete behavior and public-door acceptance journey remain required. |
| `PEG-097` | Notice timing bars | target | missing |  | No implementation exists for notice timing bars; the complete behavior and public-door acceptance journey remain required. |
| `PEG-072` | Reply to ordinary notification email | target | missing |  | No implementation exists for reply to ordinary notification email; the complete behavior and public-door acceptance journey remain required. |
| `PEG-039` | Meetings become reviewed actions | target | done | `tests/work-graph.test.mjs` “imports authorized provider transcript exports and adopts each resolved cited action once” proves segment citations, ambiguity refusal, edited owner and date, exact reviewed adoption, concurrent deduplication and a pending human decision. “reads all three official provider boundaries and clears revoked source context” proves Zoom, Meet and Teams schema edges, outage refusal, revoked context removal and permanent fencing of proposals after a source revision changes. “requires capture consent and source authority, fences changed exports and keeps context private after restart” proves consent, source privacy, revision refusal, manual proposals, scoped-agent context denial and revoked-context removal after restart. `tests/journeys/work-graph.journey.mjs` “Meeting review” proves import, uncertainty, resolved review, adoption, task citations and revoked screens, plus direct provider reads and superseded-source refusal for all three services, at 1440 and 390. Semantics: `docs/MEETING-REVIEW.md`. |  |
| `PEG-013` | Portfolios that roll up truthfully | target | done | `tests/portfolios.test.mjs` “rolls up a two-level portfolio of 20 projects, counts shared tasks once and hides a private project from a stakeholder” (point 1 and the stakeholder's authorized totals, with no private project name in any tab, list or drill), “moves rollups when a blocker or completion changes through Tasks, with source drill-down” (point 2: a blocker's due date moved through Tasks flags negative slack, completion clears it, drill-down rows), “flags each default threshold independently at a pinned clock, explains it with source rows and recalculates when resolved or the policy changes” (point 3 at a pinned clock: exactly 20% overdue, exactly and just over seven days stale, resolve by the work, new policy version, and point 4's manual health beside the computed reason) and “shows timeline, workload and dashboard tabs for the nested portfolio with saved filters and no leakage” (point 5); the screens at 1440 and 390 px, including the policy change, a published project status, the three tabs, a limited stakeholder and an outsider's refusal: `tests/journeys/portfolios.mjs`, run by `tests/journeys/work-graph.journey.mjs`. |  |
| `PEG-014` | Goals and OKRs linked to execution | target | done | Point 1, creating company/team/personal goals, completing linked work, updating a numeric source and inspecting progress and check-ins through Goals and API reads: `tests/work-graph.test.mjs` “tracks company, team and personal goals with weighted deduplicated execution, numeric freshness and attributed overrides”, “lets a named company-goal owner check in and record observations, refuses agent, guest and analyst owners and never yields progress from an override over a flagged input”, “authorizes a single-goal numeric integration without a session, fences its sponsor and revocation, and never grants a data read” and “reviews a documented numeric CSV atomically, reconciles keyed replays and changed rows, and preserves stale observation times”; Goals at 1440/390, including the API-source door with an owner-chosen expiry and a once-shown credential, CSV review, ended-source cause, override hold and observation provenance: `tests/journeys/work-graph.journey.mjs`, “Goal visibility and accountable owners”. Point 2, replaying or aging the numeric event, changing permissions and inspecting deduplication, stale labeling and restricted rollups: the same integration test (keyed replay, a person's key never colliding with a source's, ended-source cause and history, ownership loss ending a source for good, expiry), the CSV test (stale original observation times; reviewed rows outliving a revoked source) and `tests/work-graph.test.mjs` “previews personal goal notes and permitted titles before sharing, revokes ordinary manager access and fences check-ins without hidden source metadata” (restricted rollups), with the weighted deduplicated subgoal rollup in the Goals journey. Source API schema and usage: `docs/WORK-PLANNING-API.md`. |  |
| `PEG-090` | Goal visibility and accountable goal owners | target | done | Company/default member and analyst reads, current team reads/non-member refusal, restricted named-person/team audiences, guest/agent refusal and team Admin/manager management: `tests/work-graph.test.mjs` “reads company defaults and current team goals, restricts named audiences and gives team Admins and managers only their goal management authority”. Reviewed owner/editor changes, owner/editor observations and check-ins, other-person refusal, invalid owner refusal and active-owner account guards: “reviews company goal ownership and editors, permits their observations and check-ins, and refuses invalid or stale authority”. Personal notes/title disclosure preview, manager share/revoke, administrator privacy, stale check-in refusal and restricted state without source titles/owners/counts: “previews personal goal notes and permitted titles before sharing, revokes ordinary manager access and fences check-ins without hidden source metadata”. Each acceptance flow through Goals at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Goal visibility and accountable owners”. |  |
| `PEG-015` | Stakeholder status drafts, publication and subscriptions | target | partial | `tests/portfolios.test.mjs` “keeps three-project drafts separate, refuses stale sources and changed reviews, and publishes exact content once with honest channel outcomes” proves native draft and publication separation, attributed rejection with a fresh edit required, source freshness, exact human review, replay, restart and truthful blocked connector outcomes; “requires current human authority and exact client recipients, excludes private sources and keeps a separate client draft unpublished” proves human authority, recipient binding and private source exclusion; “retains immutable corrections and revision-bound member and guest threads while hiding internal replies and refusing revoked access” proves API corrections, attributed threaded discussion, author-only versioned comment edits and tombstones, revision-bound follow and mute, mentions restricted to the reviewed audience, access-filtered discussion notices, hidden-parent refusal, guest revocation and an explicit retained-snapshot erasure hold. Native API semantics: `docs/STATUS-API.md`. `tests/portfolios.test.mjs` “tracks the exact structured copies and finite delegated custody without granting browsing or false erasure”, “escalates acknowledgment and disposition independently at a pinned clock and refuses indefinite or unsupported outcomes” and “records justified finite retention separately, requires timely permitted extension and revokes a former handler” prove native request tracking, restricted handler access, deadline evaluation, reasoned response records, finite retention review, expired handler refusal and inactive archive delegation. “accepts a departed attributed actor request without reactivating membership or exposing their snapshots” proves intake after removal without restoring authority. The controlled manual procedure and remaining qualification boundaries are documented in `docs/STATUS-RIGHTS.md`; eligible erasure and complete copy reconciliation are not established. | Partial: drafts, review and publication exist through the status API. Still required: browser drafting, review and correction history with browser proof at 1440 and 390 pixels; subscriptions and the internal notification policy with actual Inbox delivery and Slack, Teams, Nook and email schema-edge outcomes; actual-model on-demand project and portfolio drafting with sourced assertion rejection and editing; announcement history. |
| `PEG-098` | Discussion on published status updates | target | partial | `tests/portfolios.test.mjs` | Partial: revision-bound member and guest threads, hidden internal replies and revoked access exist through the API. Still required: member and guest discussion in the browser at 1440 and 390 pixels, discussion controls and queued notifications, authenticated inbound email and chat replies with replay refusal, and hidden-comment exclusion through the interface and digest. |
| `PEG-099` | Rights requests on retained status snapshots | target | partial | `tests/portfolios.test.mjs`, `docs/STATUS-RIGHTS.md` | Partial: the retained-copy blocker prevents false erasure claims, but it does not establish a lawful retention basis or discharge a rights request. Still required: reviewed retained-snapshot erasure, scoped privacy-administrator delegation and deadline-bound rights handling; the controlled manual resolution route, complete copy inventory, archive reconciliation and external-copy outcomes remain unproved. No legal compliance or provider-confirmed deletion qualification is claimed. |
| `PEG-016` | Capacity across all committed work | target | missing |  | No implementation exists for capacity across all committed work; the complete behavior and public-door acceptance journey remain required. |
| `PEG-017` | Task time and approved timesheets | target | partial | Timer/manual/reconnect and concurrent-tab deduplication: `tests/work-graph.test.mjs` “keeps one durable timer per person and reconnects without duplicate intent or entries”; submit/return/correct/approve/lock, attributed later adjustments and exact stable-ID CSV: “submits, returns, corrects and locks an exact timesheet, retaining attributed later adjustments and exact CSV”; private-work refusal and stale review: “fences stale time review and keeps private no-project work out of ordinary administrator review”. `tests/journeys/work-graph.journey.mjs`, time journey at 1440/390, starts/reconnects/stops a timer, records a second task, returns/corrects/re-submits, approves/locks and reconciles approved CSV. Reviewed Harvest and QuickBooks Time delivery against official-schema network-edge fakes (schema-fake results, not live accounts): owner/admin-only exact-revision sends, a refused credential that writes nothing, one acknowledged entry per approved entry, a replay without another create, an unknown job code rejected, repaired and resent alone, a lost response read back instead of recreated, exact read-before-write corrections, refusal to overwrite a provider-side edit, a misfiled provider record flagged unreconciled and never resent, a ledger and history without the credential, and calls to identity/time-entry endpoints only: `tests/work-graph.test.mjs` “sends reviewed approved time once to each official-schema time service, repairs a rejected job code, reads back a lost response and corrects exactly”. An owner's send, a refused job code, its repair and both acknowledgments through the timesheet UI at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Reviewed time service delivery”. Packet-only progress: Read-only native packets, current-work access, mapping repairs, exact official-schema readbacks, replay/duplicate/missing/rounded/mismatched/error/incomplete readback refusal and pending adjustments: `tests/work-graph.test.mjs` “prepares approved time service packets and reconciles official-schema readbacks without sending”. Approved packet downloads and pending mappings through the existing timesheet UI at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Read-only time service packets”. Schemas and limitations: `docs/TIME-SERVICE-PACKETS.md`. | Gauge export and reconciliation remain unproved. Gauge needs a scoped approved-time write/import door owned by the Gauge seed; its current bearer keys read only /api/gauge/state and its import target refuses imported approval (ec757ff2a929d3d3487ba92f2b67d9986c0ae60a), and transplanting a browser session is not an integration. Harvest and QuickBooks Time export and exact reconciliation are proved through official-schema network-edge fakes. Those are labelled schema-fake results: live accounts are not qualified (register R-3). This clause stays partial until the Gauge export and reconciliation pass. |
| `PEG-088` | Accountable timesheet reviewers | target | done | Delegated project/team Admin and manager coverage, mixed-project refusal, sole-reviewer/self and agent refusal, reviewer and logger revocation, expiry, private withdrawal/history and guest time: `tests/work-graph.test.mjs` “reviews whole sheets with delegated authority, refuses stale grants and withdraws unavailable returned entries without disclosure”. The same test asserts no inbox or provider-mail effect from approval; no time provider send door is invoked. UI decision, awaiting-reviewer state, stale reviewer refusal, private withdrawal/resubmission and guest review: `tests/journeys/work-graph.journey.mjs`, “Accountable delegated review” at 1440/390. Existing personal-time and approved-lock evidence remains under PEG-017. |  |
| `PEG-018` | Included reporting and export | target | missing |  | No implementation exists for included reporting and export; the complete behavior and public-door acceptance journey remain required. |
| `PEG-019` | Free guests and scoped client views | target | partial | `tests/access-control.test.mjs` “lets a guest Editor assign only shared participants, complete work and submit assigned time” and “keeps scoped comments private, exact guest roles limited and old file links revoked”; `tests/journeys/guests.mjs`, invoked by `tests/journeys/work-graph.journey.mjs` in push Verify, proves scoped assignment, member-only comments, current-share portal preview and revoked task reads at 1440 and 390. | Partial native foundation: current-share read previews, selectable scopes, Editor work and assigned time, role refusals, project-scoped and internal-only comment privacy, and immediate read revocation are proved. Still required: preview before initial sharing with recorded exclusions and historical signed asset decisions; explicit free-guest accounting; complete hidden-field and attachment exclusion matrix; guest actions through connected email and chat; one assignment email and push, comment notice, due reminder and digest under preferences without another approval; queued-send and reply-route cancellation; the held-policy agent chase and the outside-share rule disclosure waiting for review; the RL-102 participant chooser. PEG-082, PEG-091 and PEG-092 own the blocked 100-MB progress and resume, Base R2 custody, explicit external proof-uploader grant and web, iOS and Android upload proof; the current small native attachment door does not satisfy it. |
| `PEG-020` | Server-enforced roles and administration | target | partial | role matrix: `tests/access-control.test.mjs` “enforces the role matrix at every door” (task, project, settings, field, export, webhook, team, review and grant doors and the screens, ten kinds of person signed in); open tab, audit, last owner and aggregates: “applies a change of permission to an open tab at once and records it”, “refuses to remove the last owner and never leaks a private field through an aggregate” and `tests/journeys/work-graph.journey.mjs` (a stale tab refused at 1440 and 390 px); Viewer on A and Editor on B, direct Commenter with a team Editor then revoked, Editor against Admin, internal-only and personal work: “gives one person Viewer on A and Editor on B, and follows a team grant as it is granted and revoked”; PEG-083 matrix and exact rows across UI and API: “walks every access-request path to a grant or to nothing, with exact audit rows” and the journey's access review beside the API's audit; policy, scopes, files and retention: “holds workspace policy, scoped grants and file rights at the doors”, “keeps one workspace invisible to another’s people”. | Point 2’s formula response is not asserted in the cited files: they assert a Viewer refused an aggregate over a private field, while the formula case (a guest reading a formula over a hidden input) is asserted only in `tests/work-graph.test.mjs` (“explains cycles, missing and hidden inputs and refuses lossy or stale type changes”), which this clause does not cite. Every other point is asserted. |
| `PEG-083` | Team privacy, discovery and joining | target | partial | `tests/access-control.test.mjs` “walks every access-request path to a grant or to nothing, with exact audit rows”, `tests/work-graph.test.mjs` “runs the PEG-083 public-team join and private-link request journeys on this graph” and `tests/journeys/work-graph.journey.mjs` | Built and proved: team privacy and default levels, discovery and join, with inbox delivery and the audit. Not yet: the guest browse proof as its own 1440/390 journey, and private portfolio requests (PEG-013). |
| `PEG-100` | Access requests from refused links and their decisions | target | partial | `tests/access-control.test.mjs`, `tests/work-graph.test.mjs`, `tests/journeys/work-graph.journey.mjs` | Built and proved: blind and deduplicated requests, delegated decisions with preview, expiry, replay, stale and deactivation refusals, inbox delivery and the audit. Not yet: Slack and Teams unfurl and decisions (PEG-071), mobile delivery (PEG-079), a delivered email with signed-in decision on a real sender (PEG-084; local mail is suppressed) and private portfolio requests (PEG-013). |
| `PEG-101` | Imported team and project privacy settings | target | missing |  | Not yet built: project-management source team-privacy and share import (PEG-106, PEG-081). |
| `PEG-021` | Enterprise identity and US custody | target | missing |  | No implementation exists for enterprise identity and us custody; the complete behavior and public-door acceptance journey remain required. |
| `PEG-022` | Native iOS and Android daily work | target | missing |  | No implementation exists for native ios and android daily work; the complete behavior and public-door acceptance journey remain required. |
| `PEG-079` | Public mobile apps and Run Edit Run push service | target | missing |  | No implementation exists for public mobile apps and run edit run push service; the complete behavior and public-door acceptance journey remain required. |
| `PEG-076` | Installable desktop access and notification control | target | missing |  | No implementation exists for installable desktop access and notification control; the complete behavior and public-door acceptance journey remain required. |
| `PEG-023` | Speed and continuity at buyer scale | target | missing |  | No implementation exists for speed and continuity at buyer scale; the complete behavior and public-door acceptance journey remain required. |
| `PEG-073` | Private personal work and a predictable day | target | done | Privacy: `tests/work-graph.test.mjs` “keeps personal work and sections owner-only through lists, ID search, reads and writes”; ordering: “orders the local day by group, due instant, priority, creation time and immutable ID”; DST/ranks/reconnect and reversible rules: that ordering test plus “persists manual section/task ranks on reconnect and logs reversible deduplicated section rules”; reviewed project sharing: “shares personal work only against the reviewed current project audience and content”. `tests/journeys/work-graph.journey.mjs`, personal-work journey at 1440/390, creates the private task/section, tests ordinary-admin refusal, default/selected manual arrangement, DST promotion, open-day midnight refresh, reconnect and reviewed sharing. |  |
| `PEG-032` | People leave without orphaning work | target | partial | Points 1 and 2: `tests/access-control.test.mjs` “requires a current complete review, transfers responsibilities, stops delegated work and preserves human authorship” proves the affected sets, explicit dispositions, transfer, private unassignment, revoked sessions and analyst keys, canceled jobs, stopped recurrence and delegated grants, retained decisions and authorship, and refusal after a new assignment. `tests/journeys/member-removal.mjs` “memberRemovalJourney”, invoked by `tests/journeys/work-graph.journey.mjs`, proves Admin review, stale refusal, removal, accountable owners, pending approval and permanent audit at 1440 and 390 pixels. | Points 1 and 2 name queued sends and their cancellation; the cited files assert cancelled queued rule jobs, revoked sessions and keys, pending approvals and transfers, but no queued outbound send (scheduled status, chase, proof reminder or mail) cancelled at removal. Inherited when implemented: PEG-012 general rule activations and queues; PEG-015 and PEG-030 scheduled status and chase sends; PEG-026, PEG-027, PEG-038 and PEG-080 additional connector custody and outbound queues; PEG-062 and PEG-074 delegated agent execution; PEG-084 queued mail. |
| `PEG-045` | Identity lifecycle and access review | target | missing |  | No implementation exists for identity lifecycle and access review; the complete behavior and public-door acceptance journey remain required. |
| `PEG-025` | Calendars and task time blocks | target | missing |  | No implementation exists for calendars and task time blocks; the complete behavior and public-door acceptance journey remain required. |
| `PEG-026` | The full integrations hub | target | missing |  | No implementation exists for the full integrations hub; the complete behavior and public-door acceptance journey remain required. |
| `PEG-080` | Guided owner-registered provider apps and connections | target | missing |  | No implementation exists for guided owner-registered provider apps and first live connection; the complete behavior and public-door acceptance journey remain required. |
| `PEG-102` | Google sign-in for outside guests | target | missing |  | No implementation exists for google sign-in for outside guests; the complete behavior and public-door acceptance journey remain required. |
| `PEG-103` | Microsoft add-in deployment and propagation | target | missing |  | No implementation exists for microsoft add-in deployment and propagation; the complete behavior and public-door acceptance journey remain required. |
| `PEG-071` | Work inside chat and mail tools | target | missing |  | No implementation exists for work inside chat and mail tools; the complete behavior and public-door acceptance journey remain required. |
| `PEG-104` | Gmail and Outlook sidebars and chat connection states | target | missing |  | No implementation exists for gmail and Outlook sidebars and chat connection states; the complete behavior and public-door acceptance journey remain required. |
| `PEG-085` | Published Zapier and Make apps for every installation | target | missing |  | No implementation exists for published zapier and make apps for every installation; the complete behavior and public-door acceptance journey remain required. |
| `PEG-027` | Public API, events and MCP | target | partial | Sentence 1: `tests/scenarios/public-api.mjs`, registered in `tests/work-graph.test.mjs`, “creates and edits through the published REST and MCP doors with exact pages, reports and signed replay-safe events” proves activated-rule parity for native, REST and MCP task creation with exactly one queued effect per task, both task transports, stale revision refusal, exact project page IDs and independent effort totals, a signed task event, a real HTTP webhook send to the native schema receiver, forged payload refusal, durable replay deduplication and delivery history. Sentence 2: “connects named clients using the MCP schema and refuses widened scope, expired keys and agent approval” proves Claude, ChatGPT, Gemini and Cursor MCP schema-fake initialization and work reads, scoped project data, private-tag refusal without personal scope and visibility with it, unknown and hidden ID parity, expired and revoked credentials, read-only refusal, independent approval refusal and completion-bypass refusal. Sentence 3: “preserves personal privacy and guest Editor and Viewer decisions across the UI API, REST and MCP” proves owner-only personal lists with unchanged saved sections and no move receipts under either read-only or writable external credentials, administrator ID refusal, owner-only section reads, creation, rename, ranking and personal layout through both transports with stale native and external edit refusal and idempotent replay, guest edits and comments, Viewer comment refusal and next-request grant revocation. `tests/journeys/public-api.mjs`, “publicApiJourney”, invoked by the core push Verify journey, proves a native guest edit of the same MCP-created record, Viewer controls and externally arranged owner-only personal work at 1440; captures the task, Viewer and personal-section screens at 1440 and 390 in every run. Schemas, scope and honest limits: `docs/PUBLIC-WORK-API.md`. | Still required: task deletion and the complete view and search, portfolio and goal reporting, time, human approval, import and export, automation configuration, personal-section deletion and rule configuration, tag, cross-project view, announcement thread, duplicate-merge and custom-agent resource surface; bounded intent recovery and retention; complete event-kind coverage, automatic subscription dispatch, retries and redelivery controls. The named MCP clients are schema-fake results, not live installed-client qualification (register R-9). An adopted credential and webhook default awaits ct (`docs/contract/adopted-defaults.md`). PEG-062 inherits the nonhuman approval boundary and PEG-032 inherits permanent key cancellation. The clause stays partial pending remaining work and ct disposition. |
| `PEG-038` | Connector failures are recoverable work | target | missing |  | No implementation exists for connector failures are recoverable work; the complete behavior and public-door acceptance journey remain required. |
| `PEG-040` | Engineering handoff without a second issue tracker | target | partial | `tests/work-graph.test.mjs` “reconciles mapped issues at all three official boundaries without satisfying business acceptance” proves stable IDs, owner and status mappings, reviewed return updates and source backlinks for Vector, Jira and GitHub, including lost-response readback. The same test proves unmapped-status refusal, outage and revoked-context clearing, replay deduplication and a pending launch decision. “denies unapproved source capture, foreign writes, private context and stale reviewed returns” proves current authority, consent, stale review and restart fencing, plus clearing cached source context on a failed return-update or backlink preflight without an external write. `tests/journeys/work-graph.journey.mjs` “Engineering handoff” proves task entry, review, mapped returns, backlinks, stale and revoked screens, including failed-write preflight errors and cleared context, at 1440 and 390. Semantics: `docs/ENGINEERING-HANDOFF.md`. | Verified provider event delivery and replay, shared source-grant administration and live provider qualification remain unproved. Jira and GitHub source edits can race the final network interval; pull requests remain read-only. |
| `PEG-041` | Commercial and service work becomes delivery | target | missing |  | No implementation exists for commercial and service work becomes delivery; the complete behavior and public-door acceptance journey remain required. |
| `PEG-042` | Reconciled time handoff to specialist systems | target | partial | Reviewed Harvest and QuickBooks Time delivery against official-schema network-edge fakes (schema-fake results, not live accounts): owner/admin-only exact-revision sends, a refused credential that writes nothing, one acknowledged entry per approved entry, a replay without another create, an unknown job code rejected, repaired and resent alone, a lost response read back instead of recreated, exact read-before-write corrections, refusal to overwrite a provider-side edit, a misfiled provider record flagged unreconciled and never resent, a ledger and history without the credential, and calls to identity/time-entry endpoints only: `tests/work-graph.test.mjs` “sends reviewed approved time once to each official-schema time service, repairs a rejected job code, reads back a lost response and corrects exactly”. An owner's send, a refused job code, its repair and both acknowledgments through the timesheet UI at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Reviewed time service delivery”. Read-only native packets, current-work access, mapping repairs, exact official-schema readbacks, replay/duplicate/missing/rounded/mismatched/error/incomplete readback refusal and pending adjustments: `tests/work-graph.test.mjs` “prepares approved time service packets and reconciles official-schema readbacks without sending”. Approved packet downloads and pending mappings through the existing timesheet UI at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Read-only time service packets”. Schemas and limitations: `docs/TIME-SERVICE-PACKETS.md`. | PARTIAL: Harvest and QuickBooks Time delivery is proved only against official-schema network-edge fakes; live account qualification remains required (no sandbox receipt; register R-3). Gauge approved-time import/write support is an upstream dependency: Gauge main ec757ff2a929d3d3487ba92f2b67d9986c0ae60a offers bearer aggregate reads only, and its import refuses imported approval. So the Gauge export, Gauge acknowledgments and the complete restricted project-management source finance handoff (which also needs PEG-107) remain unimplemented. Choosing the authoritative system per field, and provider-side rejection or correction feeds, remain unbuilt. No monetary or payroll action exists. |
| `PEG-043` | File and creative-tool continuity | target | missing |  | No implementation exists for file and creative-tool continuity; the complete behavior and public-door acceptance journey remain required. |
| `PEG-077` | Agency and operations service handoffs | target | missing |  | No implementation exists for agency and operations service handoffs; the complete behavior and public-door acceptance journey remain required. |
| `PEG-044` | BI without private-data shortcuts | target | partial | `tests/work-graph.test.mjs` “reconciles scoped analyst snapshots and incremental removals across three projects” proves stable deduplicated task identities, inherited placements, frozen pagination, exact native task and approved-time totals, changed rows, erasure markers, restart and revoked fetches through the OData read subset. “denies analyst scope escalation and fences cached work after movement or credential expiry” proves explicit project and field scope, private-field refusal, cross-key snapshot refusal, scope movement, expiry and native role revocation. “keeps analyst credentials and cached export payloads out of native archives” proves native archive exclusion. Definitions and limitations: `docs/ANALYTICS-EXPORT.md`. | Tableau and Power BI client qualification (register R-3), analyst management UI with both viewport journeys, portfolio, goal, request and approval datasets, and scheduled-report reconciliation remain unproved. Current service is a limited OData read subset, not qualified BI connectors. |
| `PEG-074` | Ask, summarize and use AI in rules | target | missing |  | No implementation exists for ask, summarize and use ai in rules; the complete behavior and public-door acceptance journey remain required. |
| `PEG-105` | No-model and failed-model states | target | missing |  | No implementation exists for no-model and failed-model states; the complete behavior and public-door acceptance journey remain required. |
| `PEG-075` | Define and govern a custom teammate without code | target | missing |  | No implementation exists for define and govern a custom teammate without code; the complete behavior and public-door acceptance journey remain required. |
| `PEG-024` | Migration as a complete buyer journey | target | missing |  | No implementation exists for migration as a complete buyer journey; the complete behavior and public-door acceptance journey remain required. |
| `PEG-046` | project-management source account migration | target | missing |  | No implementation exists for project-management source account migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-106` | project-management source whole-account scope and privacy settings | target | missing |  | No implementation exists for project-management source whole-account scope and privacy settings; the complete behavior and public-door acceptance journey remain required. |
| `PEG-107` | project-management source rule authors and finance artifacts | target | missing |  | No implementation exists for project-management source rule authors and finance artifacts; the complete behavior and public-door acceptance journey remain required. |
| `PEG-081` | Whole-account project-management source extraction | target | missing |  | No implementation exists for whole-account project-management source extraction and accountable cutover; the complete behavior and public-door acceptance journey remain required. |
| `PEG-108` | project-management source accountable cutover and bulk invitations | target | missing |  | No implementation exists for project-management source accountable cutover and bulk invitations; the complete behavior and public-door acceptance journey remain required. |
| `PEG-047` | board-centric source account migration | target | missing |  | No implementation exists for board-centric source account migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-109` | board-centric source whole-account extraction | target | missing |  | No implementation exists for board-centric source whole-account extraction; the complete behavior and public-door acceptance journey remain required. |
| `PEG-110` | board-centric source cutover, delta and invitations | target | missing |  | No implementation exists for board-centric source cutover, delta and invitations; the complete behavior and public-door acceptance journey remain required. |
| `PEG-111` | board-centric source multi-assignee workload | target | missing |  | No implementation exists for board-centric source multi-assignee workload; the complete behavior and public-door acceptance journey remain required. |
| `PEG-048` | workspace-and-list source workspace migration | target | missing |  | No implementation exists for workspace-and-list source workspace migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-112` | workspace-and-list source whole-account extraction | target | missing |  | No implementation exists for workspace-and-list source whole-account extraction; the complete behavior and public-door acceptance journey remain required. |
| `PEG-113` | workspace-and-list source cutover, delta and invitations | target | missing |  | No implementation exists for workspace-and-list source cutover, delta and invitations; the complete behavior and public-door acceptance journey remain required. |
| `PEG-114` | workspace-and-list source multi-assignee workload | target | missing |  | No implementation exists for workspace-and-list source multi-assignee workload; the complete behavior and public-door acceptance journey remain required. |
| `PEG-049` | creative-work source creative-work migration | target | missing |  | No implementation exists for creative-work source creative-work migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-050` | calendar-scheduling source work and calendar migration | target | missing |  | No implementation exists for calendar-scheduling source work and calendar migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-051` | product-planning source workspace migration | target | missing |  | No implementation exists for product-planning source workspace migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-052` | project-and-workflow source project and workflow migration | target | missing |  | No implementation exists for project-and-workflow source project and workflow migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-053` | kanban-board source, grid-based source and spreadsheet migration | target | missing |  | No implementation exists for kanban-board source, grid-based source and spreadsheet migration; the complete behavior and public-door acceptance journey remain required. |
| `PEG-054` | Mid-stream cutover, reconciliation and rollback | target | missing |  | No implementation exists for mid-stream cutover, reconciliation and rollback; the complete behavior and public-door acceptance journey remain required. |
| `PEG-055` | Owner-run Cloudflare installation through Base | target | missing |  | No implementation exists for owner-run cloudflare installation through base; the complete behavior and public-door acceptance journey remain required. |
| `PEG-115` | Model connection during setup | target | missing |  | No implementation exists for model connection during setup; the complete behavior and public-door acceptance journey remain required. |
| `PEG-116` | Guided mobile, connection and migration setup | target | missing |  | No implementation exists for guided mobile, connection and migration setup; the complete behavior and public-door acceptance journey remain required. |
| `PEG-117` | Signed release notices and security patches | target | missing |  | No implementation exists for signed release notices and security patches; the complete behavior and public-door acceptance journey remain required. |
| `PEG-118` | Mail-verified setup within the 30-minute bar | target | missing |  | No implementation exists for mail-verified setup within the 30-minute bar; the complete behavior and public-door acceptance journey remain required. |
| `PEG-084` | Sender authentication and DNS evaluation | target | missing |  | No implementation exists for authenticated mail and a cutover that reaches inboxes; the complete behavior and public-door acceptance journey remain required. |
| `PEG-119` | Default delivery, optional placement holds and delayed sign-in notices | target | missing |  | No implementation exists for default delivery, optional placement holds and delayed sign-in notices; the complete behavior and public-door acceptance journey remain required. |
| `PEG-120` | Bounces, complaints and address suppression | target | missing |  | No implementation exists for bounces, complaints and address suppression; the complete behavior and public-door acceptance journey remain required. |
| `PEG-121` | Capacity-paced invitation and notice queue | target | missing |  | No implementation exists for capacity-paced invitation and notice queue; the complete behavior and public-door acceptance journey remain required. |
| `PEG-086` | Mail-independent owner recovery | target | missing |  | No implementation exists for mail-independent owner recovery and team continuity; the complete behavior and public-door acceptance journey remain required. |
| `PEG-122` | Team continuity during mail and DNS failures | target | missing |  | No implementation exists for team continuity during mail and DNS failures; the complete behavior and public-door acceptance journey remain required. |
| `PEG-123` | Second-person recovery and Cloudflare re-enrollment | target | missing |  | No implementation exists for second-person recovery and Cloudflare re-enrollment; the complete behavior and public-door acceptance journey remain required. |
| `PEG-056` | Native email sign-in and accountable sessions | target | missing |  | No implementation exists for native sign-in and accountable sessions; the complete behavior and public-door acceptance journey remain required. |
| `PEG-124` | Provider sign-in buttons and passkeys | target | missing |  | No implementation exists for provider sign-in buttons and passkeys; the complete behavior and public-door acceptance journey remain required. |
| `PEG-057` | Durable audit distinct from editable activity | target | partial | Role/task/native-account changes, redacted successful/refused authentication, private rule effects and scoped search/export: `tests/work-graph.test.mjs` “keeps permanent audit redacted and append-only across public changes, searches and exports”. Pinned real-byte proof approvals and stale/self refusal: “pins actual proof bytes and accepts only a current independent human decision”. Scoped signed agent actions: “fences scoped agent output custody on processor revocation, retention holds and replay after expiry”. Failed official-schema provider outcome without credential values: “sends reviewed approved time once to each official-schema time service, repairs a rejected job code, reads back a lost response and corrects exactly”. Erased actor/audit continuity: “anonymizes an erased inactive actor without losing the permanent audit chain” and “preserves permanent audit through native archive restore and refuses an old archive with the later erasure journal” (public restored audit, PDF bytes/version/decision, receipts and unresolved follow-ups). Administration/Audit/Data at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Data custody”. Semantics: `docs/DATA-CUSTODY.md`, `docs/DATA-RECORD-API.md`. | Complete product-import and autonomous agent-execution audit journeys remain unproved; PEG-024/046–054 and PEG-062/074/075 inherit this audit, as do remaining proof/guest (PEG-011/036), rule (PEG-012), API/MCP/webhook (PEG-027) and recovery (PEG-086) doors. |
| `PEG-058` | Whole-workspace portable archives and inactive restore | target | missing |  | No implementation exists for whole-workspace portable archives and inactive restore; the complete behavior and public-door acceptance journey remain required. |
| `PEG-059` | Erasure with honest external limits | target | partial | Owner-reviewed project removal with real PDF proof versions/decision/bytes, comments, permission-filtered task search, signed agent output and actual retrieval-copy cleanup, holds, stale/replayed writes, shared work and attributed reopened sign-off: `tests/work-graph.test.mjs` “reviews graph erasure, honors holds and stale previews, and retains only disclosed shared work”. Explicit proof scope/byte removal: “pins actual proof bytes and accepts only a current independent human decision”. Native old-archive/current-journal refusal and restored redacted audit/receipt/PDF reconciliation: “preserves permanent audit through native archive restore and refuses an old archive with the later erasure journal”. Actor anonymization/retained stores: “anonymizes an erased inactive actor without losing the permanent audit chain”. Data erasure/expiry/proof/index/agent outcomes and unresolved processor copies at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Data custody”. Semantics: `docs/DATA-CUSTODY.md`. | Unproved: real R2 originals/derivatives/incomplete parts, product intake/import replay, whole-workspace erasure and complete guest/member identity cleanup. Local authentication material and legacy access activity remain retained; those receipts and unconfirmed processor-copy outcomes stay partial. Time, recurring snapshots and shared-field dependent scopes currently report retained outcomes pending separate custody review. PEG-024/046–054 and PEG-058/082 must enforce the receiving journal and all byte-store fences. |
| `PEG-060` | US defaults and accessible daily use | target | missing |  | No implementation exists for us defaults and accessible daily use; the complete behavior and public-door acceptance journey remain required. |
| `PEG-061` | Included capabilities and measured operating costs | target | missing |  | No implementation exists for included capabilities and transparent operating costs; the complete behavior and public-door acceptance journey remain required. |
| `PEG-125` | The AI spending cap | target | missing |  | No implementation exists for the AI spending cap; the complete behavior and public-door acceptance journey remain required. |
| `PEG-126` | Published Run Edit Run price lines | target | missing |  | No implementation exists for published Run Edit Run price lines; the complete behavior and public-door acceptance journey remain required. |
| `PEG-062` | Agents are scoped credentials for a named sponsor | target | missing |  | No implementation exists for agents are scoped credentials with human accountability; the complete behavior and public-door acceptance journey remain required. |
| `PEG-063` | Restart-safe business operation and recovery | target | missing |  | No implementation exists for restart-safe business operation and recovery; the complete behavior and public-door acceptance journey remain required. |
| `PEG-064` | Trash, revisions and conflict-preserving undo | target | partial | Points 1 and 2, recovery and brief behavior: `tests/work-graph.test.mjs` “restores retained project, task and proof graphs while fencing stale review and erased content” proves archive and trash restoration, shared graph and child identity, preserved later work and history, proof bytes and digest, brief comparison and restoration as a new revision, current authority, stale review, erasure and public archive exclusion. Bulk behavior: “undoes unchanged bulk effects while preserving later human fields and independent approvals” proves selective date, owner and priority undo, retained later edits, explicit conflicts, stale and unauthorized refusal, retained approvals and erased-effect exclusion. `tests/journeys/recovery.mjs` “recoveryJourney”, invoked by `tests/journeys/work-graph.journey.mjs`, proves archive, task, proof, brief and bulk conflict screens at 1440 and 390 pixels. Native rule runs: `tests/portfolios.test.mjs` "records activated date and assignment effects once and undoes only unchanged fields with current authority" and "runs all six owned actions once and preserves later work and reintroduced relationships during scoped undo" prove definition version, activating Admin, run and effect identities, atomic execution, replay and restart, selective undo, current authority, stale refusal, separate approvals and later work. Standalone files: `tests/work-graph.test.mjs` "restores standalone attachment bytes and scope while fencing stale review, proof reuse and erasure". Shared field revisions: "restores a shared field revision as new history while retaining later values and refusing incompatible or stale restoration". Retained template and workflow components: `tests/portfolios.test.mjs` "compares and restores a retained component without replacing newer configuration, activated rules or dependent work". Graph repair: `tests/work-graph.test.mjs` "repairs only reviewed dangling dependencies while preserving live links and refusing a stale repair". `tests/journeys/workflow-bundles.mjs` "ruleRecoveryJourney" and "revisionRecoveryJourney", invoked by "workflowBundleJourney", prove native rule and revision screens at 1440 and 390 pixels. `tests/journeys/recovery.mjs` "recoveryJourney" also proves standalone files and reviewed dangling-link repair at both widths. | Remaining: full PEG-012 triggers and computed dates beyond activated new-task bundle rules, including status, form and section-move triggers, business-day and event-relative dates, dependency cascades and external delivery compensation; configuration trash beyond retained bundle components and current field revision snapshots; repair of missing parents, teams, sections and erased project placement; owner-reviewed trash expiry execution; undo of dependency cascades and delivery-register changes. Native date rules refuse dependency cascades before any effect applies. Removed template components restore into a new bundle revision; adopted project configuration and existing work require separate reviewed adoption. Field history begins with the definition retained at migration and records subsequent revisions. Project archive retains authorized direct reads. Erased content cannot be restored; no outside message recall is claimed. PEG-006 and PEG-012 inherit revision and undo obligations for future template and rule doors; PEG-065 retains expiry and processor custody qualification. |
| `PEG-065` | Retention and processor custody are explicit | target | partial | Different class periods, consequences, eligible byte expiry, holds and partial receipts: `tests/work-graph.test.mjs` “expires only reviewed eligible stores while keeping held content and independent class policies”. Whole-proof eligibility/holds: “expires proof versions together only after every version is eligible and no proof hold remains”. Approved declared processors, revocation, output/retrieval cleanup and honest unresolved follow-ups: “fences scoped agent output custody on processor revocation, retention holds and replay after expiry”. Separate expired-session cleanup: “cleans expired local authentication separately from held work retention”. Journal/backup and follow-up preservation: “preserves permanent audit through native archive restore and refuses an old archive with the later erasure journal”. Data settings, proof expiry, holds and processor outcomes at 1440/390: `tests/journeys/work-graph.journey.mjs`, “Data custody”. Semantics: `docs/DATA-CUSTODY.md`. | Unproved: R2 original/derived/incomplete-object propagation, import-original/trash and agent-prompt stores, provider-log eligible-record cleanup, outbound model execution’s selected sharing/training policy and provider-confirmed deletion. Declared processor copies are honest needs-owner-action follow-ups, not sent/confirmed deletions. PEG-024/054/064, PEG-058/082 and PEG-062/074/075 inherit their full storage/execution obligations. |
| `PEG-028` | Assignable teammates do the work | push-further | missing |  | No implementation exists for assignable teammates do the work; the complete behavior and public-door acceptance journey remain required. |
| `PEG-029` | Plan from a brief within real capacity | push-further | missing |  | No implementation exists for plan from a brief within real capacity; the complete behavior and public-door acceptance journey remain required. |
| `PEG-030` | Coordinate through actual updates and proposed re-plans | push-further | missing |  | No implementation exists for coordinate through actual updates and proposed re-plans; the complete behavior and public-door acceptance journey remain required. |
| `PEG-066` | Triage until work has an owner and a next step | push-further | missing |  | No implementation exists for triage until work has an owner and a next step; the complete behavior and public-door acceptance journey remain required. |
| `PEG-067` | Carry creative review to an accountable decision | push-further | missing |  | No implementation exists for carry creative review to an accountable decision; the complete behavior and public-door acceptance journey remain required. |
| `PEG-068` | Measure coordination and delivery outcomes honestly | push-further | missing |  | No implementation exists for measure coordination and delivery outcomes honestly; the complete behavior and public-door acceptance journey remain required. |
| `PEG-069` | Preserve focus while repairing a slipping schedule | push-further | missing |  | No implementation exists for preserve focus while repairing a slipping schedule; the complete behavior and public-door acceptance journey remain required. |
| `PEG-078` | Resolve resource conflicts across a portfolio | push-further | missing |  | No implementation exists for resolve resource conflicts across a portfolio; the complete behavior and public-door acceptance journey remain required. |
| `PEG-070` | An agent helps prove the migration | push-further | missing |  | No implementation exists for an agent helps prove the migration; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-001` | The registry equals this table and the Base harness passes | target | missing |  | No implementation exists for the registry equals this table and the Base harness passes; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-002` | Work, schedule and assignment changes carry standard with the affected people | target | missing |  | No implementation exists for work, schedule and assignment changes carry standard with the affected people; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-003` | Guest messages, publications, outside shares and provider writes carry external | target | missing |  | No implementation exists for guest messages, publications, outside shares and provider writes carry external; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-004` | Decisions carry commitment and are attributed truthfully | target | missing |  | No implementation exists for decisions carry commitment and are attributed truthfully; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-005` | Access, security, accounts, live and money calls | target | missing |  | No implementation exists for access, security, accounts, live and money calls; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-006` | Destructive calls, policy setup, Pause and audit | target | missing |  | No implementation exists for destructive calls, policy setup, Pause and audit; the complete behavior and public-door acceptance journey remain required. |
| `SURFACE-007` | A coordination week under two company policies | target | missing |  | No implementation exists for a coordination week under two company policies; the complete behavior and public-door acceptance journey remain required. |
