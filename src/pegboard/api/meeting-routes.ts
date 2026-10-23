import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import { refreshMeetingSource,proposeMeetingAction,meetings,meetingView,ingestMeeting,reviseMeetingProposal,adoptMeetingProposal,revokeMeeting } from '../meetings/review'
export function meetingRoutes(app:Hono<{Bindings:Bindings}>){
  app.get('/meetings',door(d=>meetings(d.db,d.actor,d.workspace)))
  app.post('/meetings',door(d=>ingestMeeting(d.db,d.actor,d.workspace,d.input,d.env),{next:r=>`/app/meetings/${r.meeting.id}`}))
  app.get('/meetings/:id',door(d=>meetingView(d.db,d.actor,d.params.id)))
  app.get('/meetings/:id/context',door(d=>meetingView(d.db,d.actor,d.params.id)))
  app.post('/meetings/:id/proposals',door(d=>proposeMeetingAction(d.db,d.actor,d.params.id,d.input)))
  app.post('/meetings/:id/refresh',door(d=>refreshMeetingSource(d.db,d.env,d.actor,d.params.id,d.input)))
  app.post('/meetings/:id/revoke',door(d=>revokeMeeting(d.db,d.actor,d.params.id),{next:(_,d)=>`/app/meetings/${d.params.id}`}))
  app.post('/meeting-proposals/:id/revise',door(d=>reviseMeetingProposal(d.db,d.actor,d.params.id,d.input)))
  app.post('/meeting-proposals/:id/adopt',door(d=>adoptMeetingProposal(d.db,d.actor,d.params.id,d.input),{next:r=>`/app/tasks/${r.taskId}`}))
}
