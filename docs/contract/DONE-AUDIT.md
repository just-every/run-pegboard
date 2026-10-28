Carried-done audit against main `3e41cbf87796900b33fda5f9a5f0f5c87446bf58`.

Every acceptance point of every clause done at that commit, one row per outcome the point names, with the line of the assertion in a file the clause's Evidence cell lists. `asserted` means that line asserts the outcome; `none` means no cited file asserts it, so the clause is partial and its Gap names the outcome; `moved` means a pointer or proof boundary left the point. Helper lines (`ok`, `pass`, `call`) assert the expected HTTP status of the call on the cited line. Points carry their old acceptance text; where standard 13 required rewording an agent sentence, the row says so.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| PEG-001 | 1 | Campaign and launch projects built in Projects, the task in both (browser) | `tests/journeys/work-graph.journey.mjs:81` | asserted |
| PEG-001 | 1 | The task moved and added to both projects (API) | `tests/work-graph.test.mjs:74` | asserted |
| PEG-001 | 1 | The subtask completed and seen as done | `tests/work-graph.test.mjs:75` | asserted |
| PEG-001 | 1 | One task ID in both projects | `tests/work-graph.test.mjs:70` | asserted |
| PEG-001 | 1 | The shared change seen from either project's view | `tests/journeys/work-graph.journey.mjs:93` | asserted |
| PEG-001 | 1 | One history (created once, two project additions) | `tests/work-graph.test.mjs:77` | asserted |
| PEG-001 | 2 | A guest cannot discover the other project's name (UI) | `tests/journeys/work-graph.journey.mjs:126` | asserted |
| PEG-001 | 2 | A guest cannot discover the other project's name (API) | `tests/work-graph.test.mjs:95` | asserted |
| PEG-001 | 2 | A guest cannot discover private fields (UI) | `tests/journeys/work-graph.journey.mjs:130` | asserted |
| PEG-001 | 2 | A guest cannot discover private fields (API) | `tests/work-graph.test.mjs:97` | asserted |
| PEG-001 | 2 | A guest cannot discover the other project's attachments (API) | `tests/work-graph.test.mjs:101` | asserted |
| PEG-001 | 2 | A guest cannot discover the other project through exports | `tests/work-graph.test.mjs:106` | asserted |
| PEG-001 | 3 | A no-project personal task is private to its owner | `tests/work-graph.test.mjs:114` | asserted |
| PEG-001 | 3 | A prefix change keeps old and current references on the same task | `tests/work-graph.test.mjs:122` | asserted |
| PEG-001 | 3 | The moved, multi-homed task keeps its references through the link door (browser) | `tests/journeys/work-graph.journey.mjs:113` | asserted |
| PEG-001 | 3 | References reveal nothing to others | `tests/work-graph.test.mjs:128` | asserted |
| PEG-001 | 4 | PEG-083 public-team join at the team default | `tests/work-graph.test.mjs:141` | asserted |
| PEG-001 | 4 | The team project opens at the project's default and no wider | `tests/work-graph.test.mjs:143` | asserted |
| PEG-001 | 4 | PEG-100's private-link request reads the same as an invented target and reaches the owner | `tests/work-graph.test.mjs:148` | asserted |
| PEG-001 | 4 | The approved request grants Commenter only | `tests/work-graph.test.mjs:156` | asserted |
| PEG-002 | 1 | Every field type created (text, number, currency, date, people, single, multiple, checkbox, formula, rollup) | `tests/work-graph.test.mjs:264` | asserted |
| PEG-002 | 1 | Each definition created through Project Settings (browser) | `tests/journeys/work-graph.journey.mjs:257` | asserted |
| PEG-002 | 1 | One library field identity in three projects | `tests/work-graph.test.mjs:262` | asserted |
| PEG-002 | 1 | Formula and rollup results through task reads | `tests/work-graph.test.mjs:274` | asserted |
| PEG-002 | 1 | Formula and rollup results through report reads | `tests/work-graph.test.mjs:270` | asserted |
| PEG-002 | 1 | Formula and rollup results through API reads | `tests/work-graph.test.mjs:271` | asserted |
| PEG-002 | 2 | A cycle gets a safe explanation | `tests/work-graph.test.mjs:292` | asserted |
| PEG-002 | 2 | A hidden input gets a safe explanation and is not leaked | `tests/work-graph.test.mjs:306` | asserted |
| PEG-002 | 2 | An incompatible type change is refused | `tests/work-graph.test.mjs:298` | asserted |
| PEG-002 | 2 | No data is lost by a refused change | `tests/work-graph.test.mjs:304` | asserted |
| PEG-002 | 3 | A campaign tag exists as its own record, separate from fields | `tests/work-graph.test.mjs:317` | asserted |
| PEG-002 | 3 | Work in three projects tagged and the tag renamed once | `tests/work-graph.test.mjs:316` | asserted |
| PEG-002 | 3 | Filtering by the tag (browser) | `tests/journeys/work-graph.journey.mjs:330` | asserted |
| PEG-002 | 4 | A Viewer cannot tag | `tests/work-graph.test.mjs:324` | asserted |
| PEG-002 | 4 | A Viewer cannot edit values | `tests/work-graph.test.mjs:332` | asserted |
| PEG-002 | 4 | An Editor cannot alter definitions | `tests/work-graph.test.mjs:334` | asserted |
| PEG-002 | 4 | A guest cannot enumerate internal or personal tags | `tests/work-graph.test.mjs:323` | asserted |
| PEG-004 | 1 | Finish-to-start over the July 4 holiday and weekend | `tests/schedule.test.mjs:39` | asserted |
| PEG-004 | 1 | Start-to-start, finish-to-finish and start-to-finish | `tests/schedule.test.mjs:46` | asserted |
| PEG-004 | 1 | DST boundary | `tests/schedule.test.mjs:62` | asserted |
| PEG-004 | 1 | Critical path | `tests/schedule.test.mjs:50` | asserted |
| PEG-004 | 1 | Baseline variance | `tests/schedule.test.mjs:57` | asserted |
| PEG-004 | 1 | The reviewed shift applied | `tests/schedule.test.mjs:54` | asserted |
| PEG-004 | 1 | Through Timeline (browser) | `tests/journeys/timeline.mjs:59` | asserted |
| PEG-004 | 2 | A cycle is rejected | `tests/schedule.test.mjs:66` | asserted |
| PEG-004 | 2 | A stale plan is rejected | `tests/schedule.test.mjs:71` | asserted |
| PEG-004 | 2 | No unapproved downstream date changes | `tests/schedule.test.mjs:71` | asserted |
| PEG-004 | 3 | The Editor drags after the visible knock-on preview | `tests/journeys/timeline.mjs:72` | asserted |
| PEG-004 | 3 | Dependants shift exactly once | `tests/schedule.test.mjs:83` | asserted |
| PEG-004 | 3 | Attributed to that Editor | `tests/schedule.test.mjs:83` | asserted |
| PEG-004 | 3 | Undo | `tests/schedule.test.mjs:110` | asserted |
| PEG-004 | 3 | No second approval | `tests/schedule.test.mjs:77` | asserted |
| PEG-004 | 4 | An agent without a grant to apply others' schedule changes leaves its set pending, with no date changed (point reworded per standard 13) | `tests/schedule.test.mjs:105` | asserted |
| PEG-004 | 4 | The named eligible person approves the exact set and the shift is theirs | `tests/schedule.test.mjs:116` | asserted |
| PEG-004 | 4 | The policy-decided class of an agent's shift | | moved (to SURFACE-002, a new clause) |
| PEG-004 | 4 | A viewer cannot shift any task | `tests/schedule.test.mjs:88` | asserted |
| PEG-004 | 4 | A stale edit cannot shift any task | `tests/schedule.test.mjs:71` | asserted |
| PEG-004 | 5 | PEG-012 in-scope date propagation applies once | `tests/scenarios/schedule-rules.mjs:30` | asserted |
| PEG-004 | 5 | The out-of-scope hidden dependant stays pending without disclosure | `tests/scenarios/schedule-rules.mjs:66` | asserted |
| PEG-004 | 5 | No unauthorized partial schedule | `tests/scenarios/schedule-rules.mjs:61` | asserted |
| PEG-004 | 6 | Two blockers: no premature readiness notice | `tests/scenarios/readiness.mjs:35` | asserted |
| PEG-004 | 6 | Concurrent and replayed completion give one notice | `tests/scenarios/readiness.mjs:39` | asserted |
| PEG-004 | 6 | A hidden predecessor stays private | `tests/scenarios/readiness.mjs:123` | asserted |
| PEG-005 | 1 | A weekly recurring task generates its next occurrence on completion | `tests/work-graph.test.mjs:738` | asserted |
| PEG-005 | 1 | An onboarding project recurs | `tests/work-graph.test.mjs:708` | asserted |
| PEG-005 | 1 | A restart during generation leaves one next occurrence | `tests/work-graph.test.mjs:695` | asserted |
| PEG-005 | 2 | Request changes, revise and approve, each attributed | `tests/work-graph.test.mjs:823` | asserted |
| PEG-005 | 2 | A copied revision cannot inherit sign-off | `tests/work-graph.test.mjs:698` | asserted |
| PEG-005 | 2 | A changed revision cannot inherit sign-off | `tests/work-graph.test.mjs:809` | asserted |
| PEG-089 | 1 | A monthly onboarding project activated from a team-visible source with a direct Editor (API) | `tests/work-graph.test.mjs:756` | asserted |
| PEG-089 | 1 | The guest share is not selectable | `tests/work-graph.test.mjs:758` | asserted |
| PEG-089 | 1 | Activation through the UI at 1440 and 390 | `tests/journeys/work-graph.journey.mjs:474` | asserted |
| PEG-089 | 2 | The occurrence reaches the team at its default level | `tests/work-graph.test.mjs:766` | asserted |
| PEG-089 | 2 | The occurrence reaches the direct Editor | `tests/work-graph.test.mjs:767` | asserted |
| PEG-089 | 2 | The occurrence does not reach the guest | `tests/work-graph.test.mjs:768` | asserted |
| PEG-089 | 2 | The unreachable assignee is named in the preview | `tests/work-graph.test.mjs:757` | asserted |
| PEG-089 | 2 | The unreachable assignee is named in the occurrence | `tests/work-graph.test.mjs:765` | asserted |
| PEG-089 | 3 | After the activator loses authority the next occurrence is held with its cause | `tests/work-graph.test.mjs:795` | asserted |
| PEG-089 | 3 | Nothing is generated or shared | `tests/work-graph.test.mjs:786` | asserted |
| PEG-089 | 4 | Restart and replay produce one occurrence | `tests/work-graph.test.mjs:763` | asserted |
| PEG-089 | 4 | That occurrence has one audience | `tests/work-graph.test.mjs:770` | asserted |
| PEG-089 | 5 | A task source moved out of a project where the activator lost authority is held, not written there | `tests/work-graph.test.mjs:873` | asserted |
| PEG-089 | 6 | A project Admin who did not activate the schedule sees it | `tests/work-graph.test.mjs:796` | asserted |
| PEG-089 | 6 | That Admin stops it | `tests/work-graph.test.mjs:798` | asserted |
| PEG-006 | 1 | Each gallery family instantiated through New project | `tests/portfolios.test.mjs:342` | asserted |
| PEG-006 | 1 | Correct dates from the start date | `tests/portfolios.test.mjs:348` | asserted |
| PEG-006 | 1 | Owners from the role mapping | `tests/portfolios.test.mjs:357` | asserted |
| PEG-006 | 1 | Fields | `tests/portfolios.test.mjs:352` | asserted |
| PEG-006 | 1 | Dependency edges | `tests/portfolios.test.mjs:366` | asserted |
| PEG-006 | 1 | Rules staged inactive | `tests/portfolios.test.mjs:371` | asserted |
| PEG-006 | 2 | An unresolved role requires an explicit choice | `tests/portfolios.test.mjs:380` | asserted |
| PEG-006 | 2 | A template update leaves the existing project unchanged until reviewed | `tests/portfolios.test.mjs:397` | asserted |
| PEG-006 | 3 | Duplicate with chosen work, assignees and dates | `tests/work-graph.test.mjs:2097` | asserted |
| PEG-006 | 3 | New IDs and source backlinks | `tests/work-graph.test.mjs:2093` | asserted |
| PEG-006 | 3 | Staged shares and rules reviewed before activation | `tests/work-graph.test.mjs:2107` | asserted |
| PEG-006 | 3 | No copied sign-off | `tests/work-graph.test.mjs:2101` | asserted |
| PEG-006 | 3 | No duplicate notification | `tests/work-graph.test.mjs:2120` | asserted |
| PEG-006 | 3 | No broadened visibility | `tests/work-graph.test.mjs:2092` | asserted |
| PEG-006 | 4 | An activated rule applies the pinned template's new-task dates and assignments at once | `tests/portfolios.test.mjs:482` | asserted |
| PEG-006 | 4 | A changed template or mapping keeps the next run pending until the Admin reactivates | `tests/portfolios.test.mjs:515` | asserted |
| PEG-006 | 5 | An agent without a grant to apply templates is refused the apply, and nothing is created until a person applies the exact reviewed template and date (point reworded per standard 13) | `tests/portfolios.test.mjs:436` | asserted |
| PEG-006 | 5 | A changed date or template after review is refused | `tests/portfolios.test.mjs:439` | asserted |
| PEG-006 | 5 | The policy-decided class of an agent's template choice | | moved (to SURFACE-002, a new clause) |
| PEG-087 | 1 | An intake task with nested work, files, proof versions, comments, time, a dependency and an alias converts into one linked project | `tests/scenarios/conversions.mjs:92` | asserted |
| PEG-087 | 1 | A populated project converts into a task with reviewed nested mapping | `tests/scenarios/conversions.mjs:162` | asserted |
| PEG-087 | 2 | Old links resolve to the authorized survivor | `tests/scenarios/conversions.mjs:112` | asserted |
| PEG-087 | 2 | Counts reconcile | `tests/scenarios/conversions.mjs:70` | asserted |
| PEG-087 | 2 | Authorship reconciles | `tests/scenarios/conversions.mjs:74` | asserted |
| PEG-087 | 2 | Durations reconcile | `tests/scenarios/conversions.mjs:80` | asserted |
| PEG-087 | 2 | Version digests reconcile | `tests/scenarios/conversions.mjs:79` | asserted |
| PEG-087 | 2 | Scopes reconcile | `tests/scenarios/conversions.mjs:99` | asserted |
| PEG-087 | 3 | A subtask promoted keeping its ID and history | `tests/scenarios/conversions.mjs:202` | asserted |
| PEG-087 | 3 | A task demoted keeping its ID and history | `tests/scenarios/conversions.mjs:226` | asserted |
| PEG-087 | 3 | A cycle is refused | `tests/scenarios/conversions.mjs:204` | asserted |
| PEG-087 | 3 | Private-scope disclosure is refused | `tests/scenarios/conversions.mjs:240` | asserted |
| PEG-087 | 3 | A stale preview is refused | `tests/scenarios/conversions.mjs:209` | asserted |
| PEG-087 | 3 | An unauthorized target is refused | `tests/scenarios/conversions.mjs:258` | asserted |
| PEG-087 | 4 | Unrepresentable settings stay visible as linked inert repair items | `tests/scenarios/conversions.mjs:167` | asserted |
| PEG-087 | 4 | Replay gives one conversion | `tests/scenarios/conversions.mjs:267` | asserted |
| PEG-087 | 4 | Undo after a human edit keeps that edit | `tests/scenarios/conversions.mjs:279` | asserted |
| PEG-087 | 4 | Undo does not resurrect an old approval | `tests/scenarios/conversions.mjs:281` | asserted |
| PEG-033 | 1 | Two members rearrange the mind map | `tests/work-graph.test.mjs:1777` | asserted |
| PEG-033 | 1 | A task created from a note once | `tests/work-graph.test.mjs:1781` | asserted |
| PEG-033 | 1 | That task edited in List | `tests/work-graph.test.mjs:1788` | asserted |
| PEG-033 | 2 | The canvas reflects one task ID and its state | `tests/work-graph.test.mjs:1787` | asserted |
| PEG-033 | 2 | Exported content restores | `tests/work-graph.test.mjs:1811` | asserted |
| PEG-033 | 2 | A guest cannot see internal-only notes | `tests/work-graph.test.mjs:1790` | asserted |
| PEG-034 | 1 | A campaign bundle applied to three projects | `tests/portfolios.test.mjs:209` | asserted |
| PEG-034 | 1 | One rule locally modified | `tests/portfolios.test.mjs:230` | asserted |
| PEG-034 | 1 | A new version previewed | `tests/portfolios.test.mjs:230` | asserted |
| PEG-034 | 2 | Only chosen compatible changes adopted, the override preserved | `tests/portfolios.test.mjs:233` | asserted |
| PEG-034 | 2 | Work history preserved | `tests/portfolios.test.mjs:235` | asserted |
| PEG-034 | 2 | Decisions preserved | `tests/portfolios.test.mjs:234` | asserted |
| PEG-034 | 2 | Disabling during queued work executes no obsolete action | `tests/portfolios.test.mjs:238` | asserted |
| PEG-035 | 1 | A dependency risk raised with owner, impact, mitigation and review date | `tests/portfolios.test.mjs:162` | asserted |
| PEG-035 | 1 | A scope and date change proposed without applying it | `tests/portfolios.test.mjs:165` | asserted |
| PEG-035 | 2 | The right human accepts it | `tests/portfolios.test.mjs:168` | asserted |
| PEG-035 | 2 | The rejected alternative is retained | `tests/portfolios.test.mjs:171` | asserted |
| PEG-035 | 2 | The original baseline is retained | `tests/portfolios.test.mjs:169` | asserted |
| PEG-035 | 2 | The risk traces into linked work | `tests/portfolios.test.mjs:172` | asserted |
| PEG-035 | 2 | The risk traces into the portfolio update | `tests/portfolios.test.mjs:175` | asserted |
| PEG-036 | 1 | A proof routed through internal then external reviewers | `tests/work-graph.test.mjs:2227` | asserted |
| PEG-036 | 1 | An unauthorized reviewer is denied | `tests/work-graph.test.mjs:2219` | asserted |
| PEG-036 | 1 | An external link expires | `tests/work-graph.test.mjs:2243` | asserted |
| PEG-036 | 1 | An external link is revoked | `tests/work-graph.test.mjs:2245` | asserted |
| PEG-036 | 1 | A stage is delegated | `tests/work-graph.test.mjs:2235` | asserted |
| PEG-036 | 1 | Changes are submitted | `tests/work-graph.test.mjs:2234` | asserted |
| PEG-036 | 2 | Quorum | `tests/work-graph.test.mjs:2254` | asserted |
| PEG-036 | 2 | Human identity, time and exact version on each vote | `tests/work-graph.test.mjs:2235` | asserted |
| PEG-036 | 2 | A stale tab or replay cannot approve a replacement asset | `tests/work-graph.test.mjs:2249` | asserted |
| PEG-036 | 2 | Other project content is not revealed | `tests/work-graph.test.mjs:2225` | asserted |
| PEG-036 | 3 | The ordinary proof reminder is received once at its configured time | `tests/work-graph.test.mjs:2338` | asserted |
| PEG-036 | 3 | Without a per-message review | `tests/work-graph.test.mjs:2339` | asserted |
| PEG-036 | 4 | Only the permitted version and safe fields are identified | `tests/work-graph.test.mjs:2340` | asserted |
| PEG-036 | 4 | The hidden internal comment is absent and the decision stays pending | `tests/work-graph.test.mjs:2343` | asserted |
| PEG-036 | 5 | A named approver on a PEG-005 approval task | `tests/work-graph.test.mjs:2261` | asserted |
| PEG-036 | 5 | Quorum on the approval task | `tests/work-graph.test.mjs:2289` | asserted |
| PEG-036 | 5 | A delegate decides | `tests/work-graph.test.mjs:2290` | asserted |
| PEG-036 | 5 | An approve-only guest decides only with approval permission | `tests/work-graph.test.mjs:2282` | asserted |
| PEG-036 | 5 | Through the UI | `tests/journeys/approval-routing.mjs:65` | asserted |
| PEG-036 | 6 | The owner is refused as approver | `tests/work-graph.test.mjs:2264` | asserted |
| PEG-036 | 6 | A former owner since the previous decision is refused | `tests/work-graph.test.mjs:2267` | asserted |
| PEG-036 | 6 | The decision door asks PEG-020's capability check | `tests/work-graph.test.mjs:2282` | asserted |
| PEG-039 | 1 | Each meeting service connected at its official-schema boundary (Zoom, Meet, Teams) | `tests/work-graph.test.mjs:1606` | asserted |
| PEG-039 | 1 | An authorized transcript with uncertain ownership is ingested and actions prepared | `tests/work-graph.test.mjs:1579` | asserted |
| PEG-039 | 2 | A person edits and approves the actions once | `tests/work-graph.test.mjs:1588` | asserted |
| PEG-039 | 2 | Tasks link back to the source | `tests/work-graph.test.mjs:1589` | asserted |
| PEG-039 | 2 | Duplicate delivery does not duplicate work | `tests/work-graph.test.mjs:1590` | asserted |
| PEG-039 | 2 | Revoked access removes context from later agent reads | `tests/work-graph.test.mjs:1640` | asserted |
| PEG-013 | 1 | A two-level portfolio of 20 projects with shared tasks and a private project | `tests/portfolios.test.mjs:42` | asserted |
| PEG-013 | 2 | A blocker change through Tasks moves the live rollup | `tests/portfolios.test.mjs:67` | asserted |
| PEG-013 | 2 | At-risk flags follow | `tests/portfolios.test.mjs:78` | asserted |
| PEG-013 | 2 | Source drill-down | `tests/portfolios.test.mjs:71` | asserted |
| PEG-013 | 2 | Completion moves the rollup | `tests/portfolios.test.mjs:82` | asserted |
| PEG-013 | 2 | A limited stakeholder sees only authorized totals | `tests/portfolios.test.mjs:51` | asserted |
| PEG-013 | 2 | No private project names | `tests/portfolios.test.mjs:53` | asserted |
| PEG-013 | 3 | Each default threshold crossed independently at a pinned clock | `tests/portfolios.test.mjs:101` | asserted |
| PEG-013 | 3 | Exactly 20% overdue flags | `tests/portfolios.test.mjs:103` | asserted |
| PEG-013 | 3 | Just over seven days stale flags | `tests/portfolios.test.mjs:111` | asserted |
| PEG-013 | 3 | Resolved by the work | `tests/portfolios.test.mjs:120` | asserted |
| PEG-013 | 3 | A policy change recalculates | `tests/portfolios.test.mjs:125` | asserted |
| PEG-013 | 4 | Manual health compared separately | `tests/portfolios.test.mjs:116` | asserted |
| PEG-013 | 5 | Timeline, workload and dashboard tabs for the nested portfolio | `tests/portfolios.test.mjs:132` | asserted |
| PEG-013 | 5 | No double-counted work | `tests/portfolios.test.mjs:133` | asserted |
| PEG-013 | 5 | No hidden-project leakage | `tests/portfolios.test.mjs:138` | asserted |
| PEG-014 | 1 | Company, team and personal goals created | `tests/work-graph.test.mjs:932` | asserted |
| PEG-014 | 1 | Completing linked work moves progress | `tests/work-graph.test.mjs:910` | asserted |
| PEG-014 | 1 | A numeric source updates progress | `tests/work-graph.test.mjs:918` | asserted |
| PEG-014 | 1 | Check-ins are inspected | `tests/work-graph.test.mjs:922` | asserted |
| PEG-014 | 1 | Through Goals (browser) | `tests/journeys/work-graph.journey.mjs:666` | asserted |
| PEG-014 | 2 | A replayed numeric event deduplicates | `tests/work-graph.test.mjs:916` | asserted |
| PEG-014 | 2 | An aged event is labeled stale | `tests/work-graph.test.mjs:927` | asserted |
| PEG-014 | 2 | A permission change gives a restricted rollup | `tests/work-graph.test.mjs:938` | asserted |
| PEG-090 | 1 | A member reads a company goal and its permitted links (API) | `tests/work-graph.test.mjs:987` | asserted |
| PEG-090 | 1 | Through Goals at 1440 and 390 | `tests/journeys/work-graph.journey.mjs:716` | asserted |
| PEG-090 | 2 | A team member reads the team goal | `tests/work-graph.test.mjs:992` | asserted |
| PEG-090 | 2 | A non-member is refused it | `tests/work-graph.test.mjs:992` | asserted |
| PEG-090 | 3 | A guest, an agent and an unnamed member are refused a restricted company goal | `tests/work-graph.test.mjs:998` | asserted |
| PEG-090 | 4 | A named member owner checks in and records an observation | `tests/work-graph.test.mjs:1016` | asserted |
| PEG-090 | 4 | Another member cannot | `tests/work-graph.test.mjs:1023` | asserted |
| PEG-090 | 4 | Naming an agent or guest owner is refused | `tests/work-graph.test.mjs:946` | asserted |
| PEG-090 | 4 | Naming an analyst owner is refused | `tests/work-graph.test.mjs:968` | asserted |
| PEG-090 | 5 | A personal goal shared with a manager after its preview | `tests/work-graph.test.mjs:1048` | asserted |
| PEG-090 | 5 | The share revoked | `tests/work-graph.test.mjs:1055` | asserted |
| PEG-090 | 5 | An administrator's ordinary session never reads it | `tests/work-graph.test.mjs:1052` | asserted |
| PEG-090 | 6 | A check-in after the reader's grant is revoked is refused | `tests/work-graph.test.mjs:1058` | asserted |
| PEG-090 | 6 | The restricted state shows no hidden titles or counts | `tests/work-graph.test.mjs:1062` | asserted |
| PEG-088 | 1 | A project-B Admin approves a single-project sheet (API; the `decision` helper asserts 200) | `tests/work-graph.test.mjs:584` | asserted |
| PEG-088 | 1 | Through the UI | `tests/journeys/work-graph.journey.mjs:403` | asserted |
| PEG-088 | 2 | That Admin is refused a sheet that also carries project-A time | `tests/work-graph.test.mjs:588` | asserted |
| PEG-088 | 2 | A manager covering both approves it | `tests/work-graph.test.mjs:586` | asserted |
| PEG-088 | 3 | The only owner's self-approval is refused | `tests/work-graph.test.mjs:615` | asserted |
| PEG-088 | 3 | The awaiting-another-reviewer state is shown | `tests/work-graph.test.mjs:616` | asserted |
| PEG-088 | 4 | A reviewer whose grant is revoked between preview and decision is refused | `tests/work-graph.test.mjs:607` | asserted |
| PEG-088 | 5 | A returned sheet's unreachable entry is withdrawn | `tests/work-graph.test.mjs:600` | asserted |
| PEG-088 | 5 | The sheet is resubmitted and approved | `tests/work-graph.test.mjs:610` | asserted |
| PEG-088 | 6 | A guest Editor's time is submitted and approved (the `decision` helper asserts 200) | `tests/work-graph.test.mjs:625` | asserted |
| PEG-088 | 7 | An agent whose grant does not cover the sheet is refused an approve attempt (point reworded per standard 13) | `tests/work-graph.test.mjs:591` | asserted |
| PEG-088 | 7 | The policy-decided class of an agent's timesheet decision | | moved (to SURFACE-004, a new clause) |
| PEG-088 | 8 | No provider call or notification leaves the organization | `tests/work-graph.test.mjs:585` | asserted |
| PEG-020 | 1 | The role matrix through real sign-in, task and project routes, API, exports and webhook registration | `tests/access-control.test.mjs:53` | asserted |
| PEG-020 | 2 | An open tab is refused at once after a permission change | `tests/access-control.test.mjs:71` | asserted |
| PEG-020 | 2 | The change is in the audit | `tests/access-control.test.mjs:74` | asserted |
| PEG-020 | 2 | Removing the last owner is refused | `tests/access-control.test.mjs:80` | asserted |
| PEG-020 | 2 | A private field is not exposed through an aggregate | `tests/access-control.test.mjs:90` | asserted |
| PEG-020 | 2 | A private field is not exposed through a formula response | none | none |
| PEG-020 | 3 | Viewer on A is denied comments and edits | `tests/access-control.test.mjs:101` | asserted |
| PEG-020 | 3 | Editor on B edits | `tests/access-control.test.mjs:103` | asserted |
| PEG-020 | 4 | A direct Commenter with a team Editor grant has Editor access | `tests/access-control.test.mjs:111` | asserted |
| PEG-020 | 4 | Revoking the team grant restores Commenter limits at once | `tests/access-control.test.mjs:113` | asserted |
| PEG-020 | 5 | A B Editor cannot edit rules, fields, templates or settings | `tests/access-control.test.mjs:120` | asserted |
| PEG-020 | 5 | Personal and internal-only work stays undiscoverable through either grant | `tests/access-control.test.mjs:122` | asserted |
| PEG-020 | 6 | PEG-083's join and PEG-100's request, approve, deny, expiry, replay and deactivation matrix with exact audit rows (API) | `tests/access-control.test.mjs:140` | asserted |
| PEG-020 | 6 | The same rows through the UI access review | `tests/journeys/work-graph.journey.mjs:169` | asserted |
| PEG-073 | 1 | A private no-project task and custom section through My Tasks; only the owner reads or finds it | `tests/work-graph.test.mjs:164` | asserted |
| PEG-073 | 1 | The owner reads it | `tests/work-graph.test.mjs:170` | asserted |
| PEG-073 | 2 | The default order (Overdue, Today, Upcoming, Later) | `tests/work-graph.test.mjs:192` | asserted |
| PEG-073 | 2 | Equal-date priorities and the tie breakers | `tests/work-graph.test.mjs:197` | asserted |
| PEG-073 | 2 | A manual Today mark | `tests/work-graph.test.mjs:191` | asserted |
| PEG-073 | 3 | Local midnight across DST promotes due-tomorrow work once | `tests/work-graph.test.mjs:201` | asserted |
| PEG-073 | 3 | A manual section rank persists after reconnect | `tests/work-graph.test.mjs:216` | asserted |
| PEG-073 | 4 | Adding the private task to a project requires a visibility preview | `tests/work-graph.test.mjs:238` | asserted |
| PEG-073 | 4 | Only the reviewed access is granted | `tests/work-graph.test.mjs:244` | asserted |
| PEG-032 | 1 | A manager with active projects removed through Admin | `tests/access-control.test.mjs:325` | asserted |
| PEG-032 | 1 | The manager has queued sends | none | none |
| PEG-032 | 1 | The manager has pending approvals | `tests/access-control.test.mjs:346` | asserted |
| PEG-032 | 2 | Each affected set reviewed and work transferred | `tests/access-control.test.mjs:332` | asserted |
| PEG-032 | 2 | Sessions and keys revoked | `tests/access-control.test.mjs:348` | asserted |
| PEG-032 | 2 | Old sends canceled | none | none |
| PEG-032 | 2 | New accountable owners | `tests/access-control.test.mjs:333` | asserted |
| PEG-032 | 2 | History preserved | `tests/access-control.test.mjs:340` | asserted |
| PEG-032 | 2 | A concurrently added assignment forces a fresh review | `tests/access-control.test.mjs:321` | asserted |
