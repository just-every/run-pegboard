import { appDocument } from '../../ui/document.server'
import { AppBar } from '../../ui/bar'

const sayings: Record<string, string> = {
  engineering_source_refused:'The engineering source refused access. Its cached context was cleared and this request sent no update.',
  engineering_source_unavailable:'The engineering source is unavailable. Its indicator is stale. Refresh the source before reviewing another update.',
  meeting_source_revision_changed:'The source transcript changed. Its old proposals are unavailable. Import the authorized new revision for fresh review.',

  task_revision_changed:'This approval or its access changed. Open the task again and review its current revision.',
  goal_owner_transfer_required:'An account change would leave owned work without an active human owner. Transfer company or team goals through a reviewed ownership change first.',
  goal_audience_preview_changed:'The goal, audience or access changed. Review the audience preview again.',
  goal_preview_changed:'The goal or its linked access changed. Review the current goal before checking in.',
  due_date:'Enter a valid calendar date or UTC date and time.', visibility_preview_required:'The work or its audience changed. Review the visibility preview again before sharing.',
  field_preview_required:'The field or its values changed. Open a fresh type-change preview.', incompatible_values_preserved:'That change would alter existing values. The values were preserved; choose a compatible type.',
  time_changed_or_timer_running:'Time changed while you were working, or you already have a running timer. Refresh the timesheet before continuing.', timesheet_preview_changed:'The time or its access changed. Review the current timesheet before deciding.',
  timesheet_locked:'This timesheet is submitted or approved. Returned entries can be corrected; approved entries need an attributed adjustment.', different_owner_or_admin:'A different owner or administrator with current project access must review this timesheet.',
  review_project_visibility_before_submission:'This includes personal time or project work you can no longer access. Keep personal time private and record submitted time against currently shared project work.',

  not_found: 'That is not available to you, or it does not exist.', forbidden: 'You do not have the access this needs.', cross_origin: 'That request did not come from this app.',
  last_owner: 'That would leave nobody responsible, so it did not happen.', share_preview_required: 'Review the share preview before widening who can see this.',
  stale_preview: 'The request changed after you opened it. Open it again.', stale: 'The settings changed since this was asked, so it grants nothing. They can ask again.',
  already_decided: 'That request was already decided.', expired: 'That request expired.', changed_try_again: 'Access changed while you were deciding. Open the request again.',
  prefix_taken: 'That prefix is already used in this installation.', invalid_json: 'That request was not understood.', internal_error: 'Something went wrong on our side.',
}
/** A plain refusal page for a form post: the saying, and the way back. */
export function errorDocument(status: number, code: string) {
  const response = appDocument('Not done', <>
    <AppBar />
    <main className="board" id="main"><section className="page"><article className="card note-card"><h1>Not done</h1><p>{sayings[code] ?? `That was refused (${code}).`}</p><p><a className="button quiet" href="/app">Back to Pegboard</a></p></article></section></main>
  </>)
  return response.then(page => new Response(page.body, { status, headers: page.headers }))
}
