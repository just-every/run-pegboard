# Data custody

An installation owner opens **Data** to review retention, holds and irreversible
removal. Owners and installation administrators open **Audit** to search and
export permanent events. Workspace administrators see that workspace's events;
only an owner sees installation authentication events. Personal task, goal and
draft-time activity is not exposed by the workspace audit.

## Permanent audit

`peg_permanent_audit` is separate from work history and the older access-activity
store. Database triggers reject updates and deletes. Existing access events are
copied additively with their opaque identifiers and no free-text metadata; their
original activity is preserved. Current work-history and access changes append
redacted permanent events in the mutation transaction. Current signed-in API
writes and CSV exports also record started and success/failure outcomes. A
correlation identifier joins each API attempt to its outcome; a started event
alone is not a completion receipt. Native authentication admission and
configuration changes are recorded without challenge, session or credential
values. Pagination uses event IDs and exact action, actor and subject filters.

Permanent metadata accepts a closed vocabulary of enumerated values, counts,
booleans and generated identifiers. It never copies request bodies, comments,
file names/bodies, provider responses, email addresses or credentials. Erased
profiles are displayed as **Erased actor**, retaining the original opaque actor
identifier and historical action chain. Authorized activity screens may still
show work details according to their own permissions and retention.

This is coverage of current doors. PEG-011/036 proof decisions, PEG-012 rules,
PEG-024/046–054 imports, PEG-027 API/MCP/webhooks, PEG-062/074/075 agent execution
and PEG-086 recovery must append redacted permanent events when those doors are
built. Their complete acceptance journeys remain required.

## Retention and holds

The owner publishes separate periods for product history, trash, attachments and
proofs, import originals, agent prompts and outputs, provider logs, and transient
credentials/sessions. The conservative default keeps records until explicit
reviewed removal. A retention change previews the old/new period and does not
start an automatic destructive job. Expiry is a second exact-scope review with a
frozen cutoff. Supported current stores are work history, database attachment
bytes, time-provider delivery logs and expired local tokens/sessions. Missing
trash/import/proof/agent stores are explicitly reported as unavailable, rather
than reported successfully expired.

A hold records scope, authority, creator and expiry. Active workspace, project,
task, attachment and person holds prevent conflicting removal, including linked
project/task custody. Release requires an explicit owner confirmation. Every
retained or completed outcome has an immutable, redacted receipt. Existing time
records, recurring source snapshots and shared field-authority dependencies
require separate custody review and remain retained; they are not called deleted.
Shared tasks in another project are disclosed and remain there when one project
is erased.

Unlisted processors are denied. Approval, sharing and training each require an
explicit owner choice. Saving a policy neither connects a processor nor sends
content. Agent-processor enforcement, deletion requests and confirmed external
deletion receipts remain unimplemented. PEG-062/074/075 must enforce the selected
policy when they add execution; PEG-058/082 must extend cleanup to all registered
object originals, versions, derivatives and incomplete transfers.

## Erasure and archives

The review lists dependent records before a project, task or attachment is
removed. A revision/authority guard in the same database batch invalidates a
stale review. Work rows, comments, inline attachment bytes, history, values,
references, grants and current graph links are selected explicitly. Original
identifiers are fenced so later writes cannot revive them. Holds return a
retained receipt without deleting content. No R2 object versions, search-index
copies or agent-held retrieval stores exist yet, and their cleanup is not
claimed.

Member/guest profiles must first be deactivated and owned work transferred.
Current person removal anonymizes the profile and permanent-audit presentation,
removes its reviewed work dependents and fences the inactive identity. Local
authentication material and legacy access activity remain retained; the receipt
is **partial** and lists those stores. No claim of complete identity erasure is
made. The last owner requires an explicit installation reset or replacement.

The native `rer export` / `rer import` commands and `/api/portability` use one
seed-owned Base portability policy. Restored recurrences remain inactive, grants
revoked, numeric-source credentials absent and webhooks excluded. Restoration
requires an eligible empty destination. Erasure invalidates active archive
snapshots/staging, records Base tombstones for deleted keys and advances a
redaction checkpoint. Supply a later archive using
`rer import --input exports/old.rer --journal exports/later.rer --yes` to prevent
an older offline copy from resurrecting erased material. The downloaded current
journal identifies its source and epoch for inspection; the CLI's `--journal`
argument takes the later complete archive, not that JSON endpoint response.

An offline copy without the later journal cannot know about subsequent erasure.
Already downloaded files and messages held by external recipients need those
systems' deletion processes. Pegboard does not claim to recall them or confirm a
processor deletion it has not observed.

The owner-only destructive scope, explicit expiry, hold precedence, retained
shared-work/time/recurrence custody and deny-by-default processor choices are
conservative defaults pending CT disposition. PEG-057/059/065 remain partial;
these defaults do not narrow or replace their acceptance obligations.
