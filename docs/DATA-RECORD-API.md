# Native custody records

These signed-in `/api/v1` doors use current task/project grants. Writes require the
same origin. Proofs and outputs are native stored records; these APIs do not call
a model or substitute a provider.

| Door | Behavior |
| --- | --- |
| `GET /search?q=TEXT&after=ID` | Returns only currently readable tasks with matching indexed title/description, current visible titles and an authorized-row cursor; no hidden counts. |
| `POST /tasks/:id/proofs` | An internal editor pins an existing attachment using `attachmentId`; returns a proof/version ID and SHA-256 of the actual bytes. Personal/guest/agent proof creation is denied pending their complete review doors. |
| `GET /proofs/:id` | Current readable version history and immutable decisions; an inaccessible current file hides the proof. |
| `POST /proofs/:id/versions` | Pins another actual attachment with `attachmentId` and the reviewed `currentVersion`; prior decisions do not approve the new version. |
| `GET /proofs/:id/decision-preview` | Returns the current version, exact preview token and independent-human administrator eligibility. |
| `POST /proofs/:id/decisions` | Takes `versionId`, `token`, `action` (`approve`, `changes`, `reject`) and `reason`. Stale, self/agent and unauthorized decisions are denied. It approves only that version, never the task automatically. |
| `POST /tasks/:id/agent-outputs` | An active scoped agent supplies `projectId`, approved declared `processor`, `body` and an idempotent `key`. The current policy is checked; changed-key replays and erased keys are denied. |
| `GET /agent-outputs/:id` | Returns the submitted body only within its current project/task grants. |
| `GET /agent-outputs/:id/retrieval` | Reads the actual derived retrieval copy under the same grants and current processor policy. |

Proof additions and agent outputs reopen an existing task sign-off with the
writer and cause recorded. Removing reviewed content through Data settings does
the same where fresh review is needed. Full proof viewers/annotations, external
approval capabilities, sponsored model execution, prompt storage, search scale
qualification and R2/resumable upload qualification remain with their owning
clauses; their completion is not claimed here.

The current ordinary attachment door retains its existing 524,288-byte database
limit. PEG-082’s and PEG-091’s larger guarantees require the complete registered R2 upload
implementation; these custody APIs do not lower that contractual requirement.
