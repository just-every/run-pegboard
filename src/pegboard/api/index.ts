import { reportingRoutes } from './reporting-routes'
import {searchRoutes} from './search-routes'
import {mergeRoutes} from './merge-routes'
import { calendarRoutes } from './calendar-routes'
import { publicRoutes } from './public-routes'
import { capacityRoutes } from './capacity-routes'
import {statusRoutes} from './status-routes'
import {approvalRoutes} from './approval-routes'
import {availabilityRoutes} from './availability-routes'
import {noticeRoutes} from './notice-routes'
import {ruleRoutes} from './rule-routes'
import {bulkRoutes} from './bulk-routes'
import {templateRoutes} from './template-routes'
import {duplicateRoutes} from './duplicate-routes'
import {conversionRoutes} from './conversion-routes'
import {templateRuleRoutes} from './template-rule-routes'
import {briefRoutes} from './brief-routes'
import { recoveryRoutes } from './recovery-routes'
import {bundleRoutes} from './bundle-routes'
import { registerRoutes } from './register-routes'
import { canvasRoutes } from './canvas-routes'
import { portfolioRoutes } from './portfolio-routes'
import { scheduleRoutes } from './schedule-routes'
import { analyticsRoutes } from './analytics-routes'
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
mergeRoutes(pegboardApi)
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

analyticsRoutes(pegboardApi)

canvasRoutes(pegboardApi)

portfolioRoutes(pegboardApi)

scheduleRoutes(pegboardApi)

registerRoutes(pegboardApi)

bundleRoutes(pegboardApi)

recoveryRoutes(pegboardApi)

briefRoutes(pegboardApi)

bulkRoutes(pegboardApi)

templateRoutes(pegboardApi)
duplicateRoutes(pegboardApi)
conversionRoutes(pegboardApi)
templateRuleRoutes(pegboardApi)

availabilityRoutes(pegboardApi)
capacityRoutes(pegboardApi)
noticeRoutes(pegboardApi)

publicRoutes(pegboardApi)
statusRoutes(pegboardApi)
approvalRoutes(pegboardApi)
ruleRoutes(pegboardApi)

calendarRoutes(pegboardApi)

reportingRoutes(pegboardApi)
searchRoutes(pegboardApi)
