# Text request intake

A current workspace owner or administrator configures forms from project Settings,
then reviews the exact prompts, fixed title and description mappings, destination,
owner, priority, working calendar and audience before publication. Internal forms
require a current signed-in member with project edit access. A public capability
permits only submission to one published version; it grants no membership, work
read access or permission to act as a person. Public work is attributed to
“Public intake”, separately from the publisher who authorized the mapping.

Only text and bounded choices are supported. A branch can depend on an earlier
choice; required validation runs independently on the server. Unknown fields,
hidden-branch answers, attachments and identity or mapping overrides refuse
without creating work. Files are explicitly unsupported, including multipart
requests; this does not implement PEG-082 attachment custody.

Publication stores only a capability digest. The raw public link is displayed once.
Changing a draft invalidates publication. Revocation or a publisher account change
permanently invalidates its old link. Every submission rechecks the publisher and
fixed owner's current authority. Republish explicitly to obtain a new link.

A source request key and exact payload fingerprint bind one persisted task and
one acknowledgment. Concurrent retries and receiver restart retain those identities;
a changed payload refuses. An erased task leaves an opaque source tombstone and
cannot be recreated by replay. Explicit project erasure removes its forms and
submission records through the existing reviewed custody door; person erasure
anonymizes intake attribution. Public receipts contain no task ID, project metadata,
member identity or submitted field contents. They provide the receipt and triage
deadline on the page; no mail delivery is implied.

The triage deadline consumes the reviewed workspace working hours, timezone and
US federal holidays. Its calendar is snapshotted on publication and recorded with
each submission. There is no manual pause. After the deadline, the authorized
queue visibly requires project administrator attention; the scheduled worker
records escalation without sending mail. Marking a request triaged ends that state.
Public POST attempts are bounded by a durable capability and address window, and
request bodies have an independent byte bound. No address is stored in plaintext.

Archives preserve form configuration and opaque submission identities, with all
publications inactive on restore. Capabilities, rate windows and execution guards
supply no restored authority. Restoring an archive does not publish a form.

PEG-007 remains partial: attachments, resumable transfer, device and byte custody,
signed Pencil responses, template mappings, broader routing and duplicate-candidate
review, and the PEG-012 fixed-designer and AI-proposal acceptance remain unproved.
The conservative workspace owner or administrator publication floor is adopted
pending ct approval; scoped publisher delegation remains unproved. No provider
or mail qualification is claimed, and PEG-012 behavior is unchanged.
