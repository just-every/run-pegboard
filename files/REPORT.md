# sx-pegboard-c-f119

Product candidate: `177c6538d45a9e290f53c04f647cb17b0926a945` on `cloud/sx-pegboard-c-f119`, pushed to the declared Pegboard repository through the fleet guard. No PR is required by this repository’s branch Verify entry point and none was created. Main was fetched and merged before the candidate push; it remained `672a7a6fa8c98ed804e629dcf7fb4868b75d4f61`. Published history was not rebased or force pushed.

CLAIM PEG-010 PARTIAL points=none tests=tests/work-graph.test.mjs#publishes exact human-reviewed project messages and permission-scoped threaded Inbox deliveries; tests/work-graph.test.mjs#preserves holds, exact erasure review and inactive archive journal custody; tests/journeys/project-messages.mjs#projectMessagesJourney

DEFAULT PEG-010: Follow the planner’s conservative internal-human project scope: current project settings authority, the current explicit or configured participant directory, exactly reviewed text and audience, no role-only directory discovery, no guest or agent publication, no outbound mail, no membership or approval authority, and no mention-based notice expansion. This is a partial native implementation, not approval of a broader team or provider policy.

GAP PEG-010: Team publisher and audience policy, guest announcements, actual email delivery and authenticated email replies, complete browser status-history integration, named provider embeds, Slate continuity, rich collaboration and live-edit qualification, PEG-082 upload limits and interrupted or duplicate finalization and byte custody, and PEG-023’s actual Core i5-8250U and Pixel 6a measurements for 100 real remote comment and brief edits remain unproved. Preserve PEG-012’s off-limits restriction, the shared product-import prerequisite, the unchanged PEG-082, PEG-011 and PEG-007 restriction and all existing mail, account, Base, device and ct holds. No provider, model, upload, installed-client or fixed-device qualification is claimed.

The source PEG-010 row remains MISSING exactly as on main. The requested builder claim describes the new native slice only. No full acceptance sentence is marked closed because the announcement sentence also requires the held team and email outcomes. Counts before and after are **22 DONE, 19 PARTIAL, 51 MISSING, 92 total**, with zero new DONE. No plan row, status cell, gap cell, evidence cell, homepage, brand, header, theme, Base pin or workflow file was changed. The lane should attach this slice’s evidence to the existing PEG-010 plan row while preserving its held remainder.

## Product result

The project’s Messages entry opens actual scoped announcements and the current publisher’s drafts. Inbox’s chip and facts count actual announcement notices. Compose captures subject, text body, selected current participants and readable project work. Exact review shows the actual named audience and work before explicit confirmation. A publication is immutable; separately reviewed corrections retain the original and the same audience. Replies carry stable publication, parent, author and revision identities. Only their current authorized author can edit or delete them, with earlier revisions retained.

Native Inbox renders persisted, unique publication and reply notices. It does not treat an available status receipt as delivery. Every notice and thread read rechecks active internal participation, current effective capability and linked-work access. Follow and mute constrain notices. An unselected publisher and out-of-audience mention gain no notice delivery. Revoked notices remain cancelled after a grant is renewed. Concurrent and replayed operations refuse without duplicate effects, and stale source, audience, draft and reply revisions preserve later work.

Draft review keeps internal linked-task membership fingerprints out of the response; a scoped publisher cannot learn a task’s other private project identity. Existing task-comment edit, deletion, reaction and replay guards were not modified.

Exact owner erasure includes whole affected conversation groups: drafts, immutable copied publications, comments, history, notices and preferences. The preview explicitly identifies those groups. Related people, projects and linked tasks participate in hold review. Person erasure preserves shared work and honestly reports retained identity stores as partial. Permanent audit keeps opaque identities and revision numbers rather than message text. A current settings administrator can publish and read their own announcement without becoming a selectable recipient or reading somebody else’s thread. Explicitly shared internal analysts retain read-only access and cannot publish or reply. Actual native archives preserve conversation identities inactive and notices cancelled; later erasure journals refuse older archives. Status snapshot and rights-request restrictions are unchanged.

The sole forward migration is `migrations/core/0090_project_messages.sql`. All 93 previous migrations are byte-identical. Product documentation is in `docs/PROJECT-MESSAGES.md`. All fleet plans, reports, screenshots and receipts live outside the product tree and are transported only on the evidence ref.

## Public-door evidence

The frozen scope rubric is in `RUBRIC.md`. Both supported and refused cases execute against actual isolated migrated installations using native sign-in and API or form doors.

| Scope row | Proof location | Observed result |
| --- | --- | --- |
| R1 authority and directory | `tests/scenarios/project-messages.mjs:31` | Only selected active internal project participants are selectable; Viewer, Commenter, agent, guest and role-only audience attempts refuse |
| R2 exact draft and review | `tests/scenarios/project-messages.mjs:44`; `tests/journeys/project-messages.mjs:27` | Draft delivers nothing; review audience, content and source IDs match the submitted records |
| R3 linked privacy and source freshness | `tests/scenarios/project-messages.mjs:36`; `tests/scenarios/project-messages.mjs:52` | Hidden other-project identity absent from draft and review; unrelated work and stale source refuse |
| R4 immutable publication and correction | `tests/scenarios/project-messages.mjs:58`; `tests/scenarios/project-messages.mjs:104` | Exactly one concurrent publication succeeds; replay refuses; correction preserves original text and lineage |
| R5 current-permission threaded replies | `tests/scenarios/project-messages.mjs:71`; `tests/scenarios/project-messages.mjs:84` | Viewer refusal and permitted nested reply reconcile exact publication and parent IDs |
| R6 author-only revision history | `tests/scenarios/project-messages.mjs:86`; `tests/scenarios/project-messages.mjs:108` | Nonauthor and stale writes refuse; supported edit and delete retain revisions 1, 2 and 3 |
| R7 follow, mute and exact notice audience | `tests/scenarios/project-messages.mjs:74`; `tests/scenarios/project-messages.mjs:82` | No notice expansion from mention or publisher status; mute and unfollow suppress later events; refollow receives later reply |
| R8 actual Inbox delivery | `tests/scenarios/project-messages.mjs:63`; `tests/journeys/project-messages.mjs:56` | Persisted notice, publication, event and recipient IDs reconcile with actual rendered Inbox content |
| R9 atomic refusal and restart | `tests/scenarios/project-messages.mjs:48`; `tests/scenarios/project-messages.mjs:76`; `tests/scenarios/project-messages.mjs:120` | Later text survives stale writes; concurrent replies yield one success; replay remains refused after restart |
| R10 current privacy after revocation | `tests/scenarios/project-messages.mjs:112`; `tests/scenarios/project-messages.mjs:123`; `tests/journeys/project-messages.mjs:107` | Changed audience, removed linked-work context, revoked browser and inactive session disclose nothing; renewed grant does not revive cancelled notices |
| R11 exact erasure, hold and audit | `tests/scenarios/project-messages.mjs:144`; `tests/scenarios/project-messages.mjs:171` | Active holds retain actual conversation identities; fresh owner review removes them, preserves shared tasks and reports partial identity custody; permanent publication audit contains no body |
| R12 archive and journal custody | `tests/scenarios/project-messages.mjs:186` | Imported rows reconcile original identities but are inactive; later journal refuses older archive and erased thread remains absent in the restored installation |

The test registrations are `tests/work-graph.test.mjs:2539` and `tests/work-graph.test.mjs:2540`. The browser journey is `tests/journeys/project-messages.mjs:8` and is loaded by the existing work-graph journey runner and push verification shard. Functional assertions run at desktop width; the 11 changed states are captured at 1440 and 390, 22 images total. There are no new icon-only controls. The existing shell’s avatar is presentation rather than an actionable control. Fields and text use the existing LOOK components; changed screens fit the viewport, have text above 13 pixels and introduce no one-sided rounded border or global configuration surface.

## Full acceptance boundaries

| Acceptance sentence | Round result |
| --- | --- |
| 1: rich brief and task collaboration, mention, file and reaction across two browsers | Unchanged and not claimed complete; rich collaboration and upload qualification remain held |
| 2: live field history and reconnect conflict handling | New announcement revision fencing is proven; complete collaboration outcome remains unproved |
| 3: complete restricted-guest interface, API, export and mention privacy | Native announcements explicitly exclude guests; this is not proof of the complete guest outcome |
| 4: reviewed project and team announcements, in-app and email delivery and email replies | Native project announcement and actual Inbox slice proven; team and authenticated email outcomes remain held |
| 5: every named provider embed and revoked-source alternative | Not implemented or claimed by this round |
| 6: PEG-082 limits, interruption and no-duplicate finalization | Not implemented or claimed by this round |
| 7: actual fixed-profile remote collaboration measurement | External device proof remains held; width screenshots do not supply it |

## DONE-RIDERS and pre-READY check

| Rider | Result for this handoff |
| --- | --- |
| 1 | PASS for native rubric R1–R12 (both exact-head scenarios and browser journey exit 0); FAIL for whole-clause completion, so no DONE claim |
| 2 | PASS native: real seeded publications and replies, nonempty Inbox, dangerous allowed and refused paths, exact erasure and holds |
| 3 | CI NOT ESTABLISHED: exact-SHA push Verify `42252802997` ended cancelled. Seventeen product shards succeeded, core was cancelled near the job limit and the aggregate coverage gate failed. No DONE promotion. |
| 4 | Exact-head local scenarios and browser proof are recorded in `RESULTS.json`; no subsequent product edit is allowed |
| 5 | Existing clause duties for permissions, history and PEG-082 are retained; receiving custody uses existing PEG-059, PEG-065 and PEG-057 services without adding an exemption |
| 6 | Contract generator write and check pass; generated views restored and not committed; source Status and counts unchanged |
| 7 | PASS: no acceptance sentence or ct ruling changed, and no coverage rewrite attempted |
| 8 | PASS native: current publisher, nonauthor, Viewer, revoked reader and inactive recipient paths execute both supported and refused outcomes |
| 9 | PASS boundary: native Inbox only; no mail, provider, device, legal-compliance or complete identity-erasure claim |
| 10 | PARTIAL scope only: planner-prescribed conservative authority and participant boundaries; no broader policy counted as approved |
| 11 | PENDING FLEET: candidate is branch-only; main equality, full-history publication scan, guarded landing and exact-main Run site are not established here |

Pre-READY checks: native behaviors have public-door assertions and the full-clause holds stay explicit; no existing assertion was removed, weakened, skipped or hidden behind a new condition; revocation, erasure, hold and replay paths execute; changed controls use existing readable text components with no new icon-only controls; lock, views and forward migration checks pass. Exact candidate CI is tracked separately from local proof and landing custody.

Main’s baseline Verify `42236954438` and Run site `42236954685` were completed successfully on `672a7a6fa8c98ed804e629dcf7fb4868b75d4f61`. Those runs are not claimed as candidate proof. Candidate main equality is false; it has not landed. Publication scan at `177c6538d45a9e290f53c04f647cb17b0926a945`: **NOT RUN in cloud**, complete=false, historyScanned=unestablished, findings=unestablished. The fleet must run its complete full-history scan before landing. The first published save had two bare prose slash expressions in probe log strings; the candidate normalizes both. Published history has been preserved for the fleet’s scan, rather than rewritten.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node scripts/contract-docs.mjs write PEG-010 then check PEG-010 exit=0; ledger=node /tmp/pegboard-ledger-check.mjs exit=0

The complete plan is `PLAN.md`, the mechanical record and executable ledger check are included, and `LOCAL-ITERATIONS.md` records development observations without private setup data. Final test logs, browser screenshots, provenance, CI and result receipts are explicit evidence selections. Product push custody and evidence publication are separate; the evidence ref does not imply READY, acceptance or landing.

PROBE PEG-010 publication: native draft, exact review and concurrent confirm -> one immutable publication, unique selected-recipient Inbox identities; replay returns 409 and draft alone delivers nothing.
PROBE PEG-010 privacy: scoped publisher and linked task in a second private project -> private project identity excluded; current audience or source loss refuses publication and thread disclosure.
PROBE PEG-010 replies: current Commenter, Viewer and nonauthor paths -> permitted threaded reply and author revision history; unsupported, stale and replayed writes refuse without duplicates or lost later text.
PROBE PEG-010 subscriptions: out-of-audience mention, unselected publisher, mute, unfollow and refollow -> notices stay inside the reviewed set and only permitted later events deliver.
PROBE PEG-010 custody: owner review with an active related hold -> retained; fresh review after release -> exact conversation rows removed, shared tasks survive, person outcome honestly partial; restart and native archive journal cannot restore erased text.
PROBE PEG-010 browser: project entry, keyboard compose, review, publication, recipient Inbox, thread edit, correction, mute and stale or revoked states -> independently reconciled API identities and visible states at 1440, with 390 proof captures.

Final local result at `177c6538d45a9e290f53c04f647cb17b0926a945`: 2 scenario registrations passed, 0 failed, 0 skipped; browser journey exit 0 with 22 screenshots; Node 22.20.0 build, typecheck, first-party check, source lock, contract generator and migration ledger checks exit 0. Candidate CI remains a separate recorded gate in CI.json.

CI observation 2026-11-06T16:40:42Z: Verify 42252802997 is still in progress on the exact final SHA. No success from another SHA is substituted. GitHub REST calls used: 6 of 10.

Evidence transport was independently fetched at its published report head and all 41 selected files matched their manifest bytes and SHA-256 hashes. The product head and worktree remained unchanged.


## Terminal CI disposition

BLOCKED branch=cloud/sx-pegboard-c-f119 head=177c6538d45a9e290f53c04f647cb17b0926a945: Verify core cancellation did not reproduce locally. The brief’s Verify repair rule says, “If it does not reproduce, stop BLOCKED with that output; do not guess a fix.” No speculative repair, test weakening, workflow edit, CI dispatch or rerun was made.

Exact-SHA Verify `42252802997` ended cancelled. Seventeen product shards succeeded, including the source and every browser shard. Core job `128012377100` ran from 16:29:48 to 16:42:03 UTC and its command output ended with “The operation was canceled.” The new announcement lifecycle had passed at 16:38:15; its archive scenario was still running when the job was cancelled. The aggregate `verify` job `128019068799` consequently failed “Require the selected coverage and its proof.” The failed-step-only log command returned no failed assertions; the complete cancelled-job archive was read once, then only the runtime excerpt was selected for evidence, with automatic environment sections excluded.

The exact local command, with Node 22.20.0, the same shard and CI environment, completed in 691,963.909892 ms with 20 tests passed, zero failed, and real exit 0. `VERIFY-REPRODUCTION.json` and `verify-reproduction.log` record the result. It did not reproduce the cancellation, so no VERIFY_REPRODUCED claim or invented nonzero exit is made. The required comparison on main also completed successfully: 18 tests, exit 0, in 358,247.490523 ms on 672a7a6fa8c98ed804e629dcf7fb4868b75d4f61. Its actual receipt and log are included.

All 10 permitted GitHub calls have been used. The candidate stays pushed and unlanded. Its local native product proofs remain valid, but neither a green candidate Verify nor main landing is claimed. The lane needs to resolve the CI execution budget under its existing rules; moving the archive proof to a lighter existing push shard is a possible follow-up, rather than a change made without the required reproduced failure.

Final disposition: BLOCKED by the brief’s non-reproduction rule, rather than a claimed native product assertion failure. Product head 177c6538d45a9e290f53c04f647cb17b0926a945 remains pushed; no product edit followed the cancelled CI run. Counts remain 22 DONE, 19 PARTIAL, 51 MISSING.
