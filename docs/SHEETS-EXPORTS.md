# Reviewed Google Sheets exports

The installation owner configures explicit projects and fields under Settings,
then reviews the spreadsheet identity, current individual recipients, dedicated
tab and every outgoing cell before each send or manual refresh. The current
conservative authority floor is owner only, with separate review for every send.
Scoped delegation and provider qualification remain open under PEG-077 and
PEG-080. No standing outbound policy or automatic refresh is introduced.

The adapter uses Google Drive v3 files and paginated permissions, and Google
Sheets v4 spreadsheet metadata, values and atomic batchUpdate requests. Tests
use an official-schema HTTP edge labelled schema-fake. No Google registration,
OAuth consent or live provider qualification is claimed. The credential is used
only for the current invocation and is never persisted or included in an archive.

A group, domain, public link, published-to-web view, incomplete audience or
non-writable destination is refused. The Drive permissions request includes the
published view on every page, so ordinary sharing settings cannot conceal a
publicly published spreadsheet. This also applies to uncertain-send readback.
The send rechecks current source export rights, selected field access,
source content and the reviewed destination audience. Changed content or an
unknown audience requires a fresh exact review. Source reads reuse the native
task and field permission services. Personal work outside the selected projects
is excluded. Unselected fields and notes are not sent.

Each task has one stable spreadsheet row even when it belongs to several
selected projects. New tasks append. Removed or erased tasks leave a deletion
marker with cleared content in their original row. The first spreadsheet row
contains the export identity, operation identity and refresh watermark. The
second contains the exact selected column headings. All cells use stringValue,
so captured formula-shaped text stays literal. Spreadsheet edits never write
Pegboard; a separately reviewed refresh replaces the managed export range.

The durable operation is claimed before the single Google write. A lost response
is pending, never an automatic retry. Readback compares the exact operation and
cells, then records confirmed, not applied or conflict. Only a new human review
can authorize another write after a reconciled non-success. Process restart and
replayed submissions retain the same operation and row identities. Revocation
blocks future sends and old reviews, clears saved review content and leaves
already exported external copies honestly disclosed. Erasure invalidates saved
review payloads before an old send can replay. Export grants, mappings and review
packets are excluded from native archives, so restoring an archive cannot revive
external authority. Refusal and uncertain-response pages link back to Sheets
settings, where pending operations offer readback instead of another send.

Portfolio export, scheduled refresh and the other service handoffs in PEG-077
remain required. Google app registration, owner consent and live qualification
remain PEG-080 obligations.
