import {fieldRevisionView,fieldRevisionPreview,restoreFieldRevision} from '../revisions/fields'
import type { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { door, flag } from './door'
import { adopt, catalogue } from '../fields/definitions'
import { changePreview, changeDefinition } from '../fields/values'
import { fieldReport } from '../fields/report'
import {
  createTag,
  updateTag,
  tagCatalogue,
  tagTask,
  tagFilter,
} from '../tags/tags'
import { addSection, openProject, need } from '../workspace/projects'
export function fieldRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/fields/:id/revisions',door(({db,actor,params})=>fieldRevisionView(db,actor,params.id)))
  app.post('/fields/:id/revisions/preview',door(({db,actor,params,input})=>fieldRevisionPreview(db,actor,params.id,input)))
  app.post('/fields/:id/revisions/restore',door(({db,actor,params,input})=>restoreFieldRevision(db,actor,params.id,input),{next:(_,d)=>`/app/fields/${d.params.id}/revisions`}))
  app.get(
    '/field-library',
    door(async ({ actor, db, workspace }) => ({
      fields: await catalogue(db, actor, workspace),
    })),
  )
  app.post(
    '/projects/:id/fields/adopt',
    door(
      ({ actor, db, params, input }) =>
        adopt(db, actor, params.id, input.fieldId),
      { next: (_, d) => `/app/projects/${d.params.id}/settings` },
    ),
  )
  app.post(
    '/projects/:id/statuses',
    door(
      async ({ actor, db, params, input }) => {
        need(
          (await openProject(db, actor, params.id)).effective,
          'manage_fields',
        )
        return addSection(db, actor, params.id, {
          name: input.name,
          mapsTo: input.mapsTo,
        })
      },
      { next: (_, d) => `/app/projects/${d.params.id}/settings` },
    ),
  )
  app.get(
    '/fields/:id/change-preview',
    door(({ actor, db, params, query }) =>
      changePreview(db, actor, params.id, Object.fromEntries(query)),
    ),
  )
  app.post(
    '/fields/:id/change',
    door(({ actor, db, params, input }) =>
      changeDefinition(db, actor, params.id, input),
    ),
  )
  app.get(
    '/projects/:id/field-report',
    door(({ actor, db, params, query }) =>
      fieldReport(db, actor, params.id, query.get('tag') ?? undefined),
    ),
  )
  app.get(
    '/tags',
    door(async ({ actor, db, workspace }) => ({
      tags: await tagCatalogue(db, actor, workspace),
    })),
  )
  app.post(
    '/tags',
    door(
      ({ actor, db, workspace, input }) =>
        createTag(db, actor, workspace, input),
      { next: () => '/app/tags' },
    ),
  )
  app.post(
    '/tags/:id',
    door(
      ({ actor, db, params, input }) => updateTag(db, actor, params.id, input),
      { next: () => '/app/tags' },
    ),
  )
  app.get(
    '/tags/:id/tasks',
    door(({ actor, db, params }) => tagFilter(db, actor, params.id)),
  )
  app.post(
    '/tasks/:id/tags',
    door(
      async ({ actor, db, params, input }) => {
        await tagTask(db, actor, params.id, input.tagId, flag(input.remove))
      },
      { next: (_, d) => `/app/tasks/${d.params.id}` },
    ),
  )
}
