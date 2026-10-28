import { AppBar } from '../../../ui/bar'
import { Heading } from '../../../ui/heading'
import { homeTabs } from '../../../ui/home'
import type { Viewer } from '../../../ui/viewer'
import { Card, Area, Form, Pick, Submit, levelOptions } from '../shell'

/** The one refusal for a link that does not open: the same for a missing id and a private one, naming nothing. A member may ask; a guest may not. */
export function RefusalPage({ viewer, target, canAsk, asked }: { viewer: Viewer; target: string; canAsk: boolean; asked: boolean }) {
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer, '')} />
    <main className="board" id="main">
      <Heading title="You can’t open this" facts={['It may not exist, or it may not be shared with you']} />
      <section className="page">
        {asked ? <Card title="Request sent"><p>If this can be shared with you, the people who decide have been told. Approved access will appear in your inbox.</p><p><a className="button quiet" href="/app/inbox">Open your inbox</a></p></Card>
          : canAsk ? <Card title="Ask for access">
            <p>Choose the level you need and add a message. Asking shares nothing; a person who can decide will see the exact grant before approving it.</p>
            <Form action="/api/v1/access-requests" next={`/app/link/${encodeURIComponent(target)}?asked=1`} label="Request access">
              <input type="hidden" name="targetId" value={target} />
              <Pick label="Level you are asking for" name="level" value="viewer" options={levelOptions(target.startsWith('pf_') ? ['viewer'] : ['viewer', 'commenter', 'editor'])} />
              <Area label="Message (optional)" name="message" />
              <Submit>Request access</Submit>
            </Form>
          </Card> : <Card title="No access"><p>This is not available to you.</p></Card>}
      </section>
    </main>
  </>
}
