# Meeting review

From Engineering handoff, open **Review meeting actions**, or visit `/app/meetings`.
Only the importing owner or administrator can read the source and review its
proposals. Each import requires current source authority, organizer permission
and confirmation that required participant consent has been obtained. No recorder
is installed, invited or started.

Supply an authorized complete Zoom or Teams WebVTT export, or the Google Meet
transcript entries response as JSON. Alternatively provide a provider resource
path and a credential for that request only. Source paths have these forms:

- Zoom: `/meetings/MEETING_ID/recordings/RECORDING_FILE_ID` (omit the leading slash in the field).
- Meet: `/conferenceRecords/RECORD_ID/transcripts/TRANSCRIPT_ID` (omit the leading slash in the field).
- Teams: `/users/USER_ID/onlineMeetings/MEETING_ID/transcripts/TRANSCRIPT_ID` (omit the leading slash in the field).

Zoom reads its official recording manifest and only downloads a completed
transcript from an HTTPS Zoom host. Meet follows transcript-entry pagination,
refuses repeated cursors and requires a complete result within ten pages. Teams
reads transcript content from Microsoft Graph. Redirects are refused. Source
credentials, Zoom download credentials and complete provider response bodies are
never persisted. Local schema-edge origins apply only in local runtime mode.
Network-edge proof does not establish real tenant commissioning or live provider
qualification.

Each transcript segment keeps its timestamp and index. Explicit Action, Decision
and Follow-up lines prepare proposals, with unknown owner and date left
unresolved. Any other segment can supply a manually prepared cited proposal.
A person edits the proposed title, selects the accountable owner and explicitly
resolves the date, including choosing no deadline. This does not adopt the work.
A separate current-version human approval names the internal project audience.
The adoption transaction records its proposal identity and creates one native,
internal-only task with the chosen owner, date and source citation. A decision
proposal creates a pending approval task; meeting language never signs it off.
Concurrent adoption, retries and restart retain one task. Changed transcript
bytes under the same source identity refuse until a separate revision is reviewed.

Source context remains private to its importing administrator. Task readers do
not inherit it. Task citation links are returned only to that current source
administrator, and disappear after source revocation. Recheck source access with
a new credential; a provider refusal clears the transcript and all proposal
context. An administrator can also revoke an imported file source manually.
Already reviewed task titles and dates remain independent native work. No agent
has implicit access to this new source door. A provider outage never authorizes
new work, and imported source copies cannot detect later provider revocation
without an explicit recheck. No background source credential is held.

Archives clear transcript and proposal context and restore sources revoked.
Future PEG-027, PEG-038, PEG-062, PEG-065 and PEG-074 doors inherit the current
source authority, retention, consent, citation and exact-adoption obligations.
Native source context retention beyond explicit revocation and reviewed provider
connection custody remain unproved.

Protocol references:

- [Zoom meeting recordings](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/recordingGet)
- [Google Meet transcript entries](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries/list)
- [Microsoft Graph transcript content](https://learn.microsoft.com/en-us/graph/api/calltranscript-get)

Default adopted pending CT: owner or administrator only, source context private
to the importing person, explicit organizer and participant consent, no automatic
recording, no implicit agent reads and separate exact approval of each internal
project disclosure. PEG-039 stays partial pending CT and the remaining connection,
retention and live qualification work.
