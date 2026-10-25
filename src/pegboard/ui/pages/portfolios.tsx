import type { listPortfolios } from '../../portfolios/portfolios'
import type { Viewer } from '../../../ui/viewer'
import { Card, Field, Form, Pick, Shell, Submit } from '../shell'

type Listing = Awaited<ReturnType<typeof listPortfolios>>
/** Portfolios the person can open, nested under their parents; a portfolio they cannot open is not listed and leaves no gap. */
export function PortfoliosPage({ viewer, portfolios, query, canCreate, workspace }: { viewer: Viewer; portfolios: Listing; query: string; canCreate: boolean; workspace: string }) {
  const level = (id: string | null, depth = 0): { id: string; name: string; depth: number }[] => portfolios.filter(p => p.parentId === id).flatMap(p => [{ id: p.id, name: p.name, depth }, ...level(p.id, depth + 1)])
  const rows = level(null)
  return <Shell viewer={viewer} current="/app/portfolios" title="Portfolios" chip={rows.length ? `${rows.length} OPEN` : 'NONE'} facts={[`${rows.length} portfolio${rows.length === 1 ? '' : 's'} you can open`]}>
    <Card title="Your portfolios">
      <form method="get" action="/app/portfolios" className="inline" aria-label="Search portfolios"><Field label="Search portfolios" name="q" value={query} /><button type="submit" className="button quiet">Search</button></form>
      {rows.length === 0 ? <p className="muted">No portfolio matches. Portfolios you create, or are named on, hang here.</p> : <ul className="rows">
        {rows.map(row => <li key={row.id} style={{ paddingLeft: row.depth * 24 }}><span className="grow"><a href={`/app/portfolios/${row.id}`}>{row.name}</a></span><span className="tagline">{portfolios.find(p => p.id === row.id)!.level}</span></li>)}
      </ul>}
    </Card>
    {canCreate && <Card title="Start a portfolio">
      <Form action="/api/v1/portfolios" next="/app/portfolios" label="Start a portfolio">
        <input type="hidden" name="workspaceId" value={workspace} />
        <Field label="Portfolio name" name="name" required />
        <Pick label="Inside portfolio" name="parentId" blank="Top level" options={portfolios.filter(p => p.level === 'admin').map(p => ({ value: p.id, label: p.name }))} />
        <Submit>Create portfolio</Submit>
      </Form>
    </Card>}
  </Shell>
}
