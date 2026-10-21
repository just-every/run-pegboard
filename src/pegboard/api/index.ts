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
