# Local development observations

The first isolated Worker run failed at owner bootstrap with `invalid_host` because setup had left a private local settings file in the checkout. That file was moved outside the checkout without reading or publishing its contents; the test harness then used its own explicit isolated origin. No authentication guard was changed.

The initial new fixture attempted to grant an agent Admin. The existing public door correctly returned `agent_cannot_admin`. The fixture now gives the agent its supported Editor scope and verifies that announcement publication remains refused.

The first browser edit assertion read the API before navigation completed and observed revision 1. The keyboard helper now waits for the actual form navigation before reconciling persisted records. The full browser journey then passed.

The first custody scenario reached its final audit assertion but used a nonexistent audit URL and received 404. It now uses the existing administrator audit door and requires the actual publication event before checking redaction.

An added person-erasure probe initially expected a nested task object. The existing task read door returns the task at the top level; the assertion was corrected to compare the actual stable task identity. The erasure itself had already completed as a truthful partial outcome and preserved that task.

Inspection found that internal linked-task membership fingerprints were returned in draft review JSON. They are now kept inside the review token calculation. A scoped publisher with no access to a task’s other private project proves that neither the draft nor its exact review exposes that project identity.

No existing test assertion, authentication rule, permission guard, workflow or contract status was weakened to resolve these observations.

Final screen inspection found that the existing Inbox chip still displayed CLEAR while a new announcement card was present. The final UI correction makes the chip and facts count those actual notices.
