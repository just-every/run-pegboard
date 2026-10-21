import type { tagCatalogue, tagFilter } from '../../tags/tags'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit } from '../shell'
export function TagsPage({
  viewer,
  tags,
  filtered,
  projects,
}: {
  viewer: Viewer
  tags: Awaited<ReturnType<typeof tagCatalogue>>
  filtered: Awaited<ReturnType<typeof tagFilter>> | null
  projects: { value: string; label: string }[]
}) {
  const here = '/app/tags'
  return (
    <Shell
      viewer={viewer}
      current="/app/projects"
      title="Tags"
      facts={['Only tags and task counts you may read']}
    >
      <Card title="Tag catalogue">
        <ul className="rows">
          {tags.map((t) => (
            <li key={t.id}>
              <span className="grow">
                <a href={`${here}?tag=${t.id}`}>{t.name}</a> · {t.count} tasks ·{' '}
                {t.color}
                {t.owner_id ? ' · Personal' : ''}
                {t.archived ? ' · Archived' : ''}
                {t.canEdit && (
                  <Form
                    action={`/api/v1/tags/${t.id}`}
                    next={here}
                    label={`Edit tag ${t.name}`}
                  >
                    <div className="inline">
                      <Field label="Name" name="name" value={t.name} />
                      <Field
                        label="Color"
                        name="color"
                        type="color"
                        value={t.color}
                      />
                      <Pick
                        label="Availability"
                        name="archived"
                        value={t.archived ? 'true' : 'false'}
                        options={[
                          { value: 'false', label: 'Active' },
                          { value: 'true', label: 'Archived' },
                        ]}
                      />
                      <Submit quiet>Save tag</Submit>
                    </div>
                  </Form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Create a tag">
        <Form action="/api/v1/tags" next={here} label="Create tag">
          <Field label="Tag name" name="name" required />
          <Pick
            label="Catalogue scope"
            name="projectId"
            options={projects}
            blank="Personal: only you"
          />
          <Pick
            label="Audience"
            name="visibility"
            value="internal"
            options={[
              { value: 'internal', label: 'Internal members' },
              { value: 'project', label: 'Project readers, including guests' },
            ]}
          />
          <Field label="Color" name="color" type="color" value="#287bc1" />
          <Submit>Create tag</Submit>
        </Form>
      </Card>
      {filtered && (
        <Card title={`Tagged: ${filtered.tag.name}`}>
          <ul className="rows">
            {filtered.tasks.map((t) => (
              <li key={t.id}>
                <a href={`/app/tasks/${t.id}`}>{t.title}</a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Shell>
  )
}
