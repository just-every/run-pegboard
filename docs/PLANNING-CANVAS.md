# Project planning canvas

Open a project and choose **Planning canvas**. Project readers see permitted
phases, notes and task links. Internal notes are omitted from guest pages,
API responses and canvas downloads. Unreadable task nodes and their relationships
are omitted; a visible child of a hidden node appears at the project root.

Human project editors can add permitted notes and phases,
change a title, or rearrange a branch with **Parent branch** and **Position**.
The controls are keyboard accessible. Each edit names the saved node revision;
a stale edit refuses rather than overwriting another person's work. The live
map refreshes independently of the editor so a draft and its focus stay intact.
A connection failure labels the map stale. Losing permission clears its content.

**Promote note to task** names an accountable owner and requires the editor's
explicit confirmation of the current project audience. Promotion preserves an
internal note's visibility and atomically creates one native task with no date.
Concurrent approval and a repeated submission return that same task. It neither
approves work nor changes any existing task's dates. Task nodes resolve their
current title, owner and status from the native task record. Use **Task List**
to edit that record; rearranging its representation creates no second task.

**Export canvas JSON** is a permission-filtered snapshot for inspection, governed
by the workspace export level. Restore uses the installation's native archive:
`rer export --output exports/installation.rer`, followed by
`rer import --input exports/installation.rer --yes` in an empty destination.
The archive preserves node IDs, branches, positions and task references. Existing
native archive policy restores grants inactive; sharing must be reviewed again.
It does not restore active source credentials or broaden project access.

Canvas nodes participate in exact project and task erasure, including the
current-revision and legal-hold checks. Removing a task node leaves its surviving
child branches at the root rather than deleting unrelated notes. No external
provider, general knowledge base, date planner or autonomous agent execution is
introduced by this door. Future PEG-003 views and PEG-024 importers inherit the
single task identity, project privacy and portable graph boundaries.
