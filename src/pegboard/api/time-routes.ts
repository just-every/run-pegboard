import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door } from './door'
import {
  createSheet,
  listSheets,
  sheetView,
  addEntry,
  stopTimer,
  editEntry,
  decide,
  adjust,
  exportSheet,
} from '../time/time'
export function timeRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get(
    '/timesheets',
    door(async ({ actor, db, workspace }) => ({
      sheets: await listSheets(db, actor, workspace),
    })),
  )
  app.post(
    '/timesheets',
    door(
      ({ actor, db, workspace, input }) =>
        createSheet(db, actor, workspace, input),
      { next: (r) => `/app/time/${r.id}` },
    ),
  )
  app.get(
    '/timesheets/:id',
    door(({ actor, db, params }) => sheetView(db, actor, params.id)),
  )
  app.post(
    '/timesheets/:id/entries',
    door(
      ({ actor, db, params, input }) => addEntry(db, actor, params.id, input),
      { next: (_, d) => `/app/time/${d.params.id}` },
    ),
  )
  app.post(
    '/timesheets/:id/timer',
    door(
      ({ actor, db, params, input }) =>
        addEntry(db, actor, params.id, input, true),
      { next: (_, d) => `/app/time/${d.params.id}` },
    ),
  )
  app.post(
    '/time/:id/stop',
    door(({ actor, db, params }) => stopTimer(db, actor, params.id)),
  )
  app.post(
    '/time/:id/correct',
    door(({ actor, db, params, input }) =>
      editEntry(db, actor, params.id, input),
    ),
  )
  app.post(
    '/time/:id/adjust',
    door(({ actor, db, params, input }) => adjust(db, actor, params.id, input)),
  )
  app.post(
    '/timesheets/:id/decision',
    door(
      ({ actor, db, params, input }) => decide(db, actor, params.id, input),
      {
        next: (_, d) =>
          d.input.action === 'return'
            ? '/app/time'
            : `/app/time/${d.params.id}`,
      },
    ),
  )
  app.get(
    '/timesheets/:id/export.csv',
    door(
      async ({ actor, db, params }) =>
        new Response((await exportSheet(db, actor, params.id)).csv, {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="${params.id}.csv"`,
            'cache-control': 'private, no-store',
          },
        }),
    ),
  )
}
