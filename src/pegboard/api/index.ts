import {meetingRoutes} from './meeting-routes'
import { engineeringRoutes } from './engineering-routes'
import { recordRoutes } from './record-routes'
import { dataRoutes } from './data-routes'
import {goalRoutes} from './goal-routes'
import {recurrenceRoutes} from './recurrence-routes'
import {timeRoutes} from './time-routes'
import {fieldRoutes} from './field-routes'
// Pegboard's versioned JSON API: mounted at /api/v1 by the Worker's Hono app.
import { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { accessRoutes } from './access-routes'
import { taskRoutes } from './task-routes'
import { workspaceRoutes } from './workspace-routes'

export const pegboardApi = new Hono<{ Bindings: Bindings }>()
workspaceRoutes(pegboardApi)
taskRoutes(pegboardApi)
accessRoutes(pegboardApi)

fieldRoutes(pegboardApi)

timeRoutes(pegboardApi)

recurrenceRoutes(pegboardApi)

goalRoutes(pegboardApi)

dataRoutes(pegboardApi)

recordRoutes(pegboardApi)

engineeringRoutes(pegboardApi)

meetingRoutes(pegboardApi)
