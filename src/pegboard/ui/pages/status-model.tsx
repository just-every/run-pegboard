import type { Viewer } from '../../../ui/viewer'
import type { statusModelConnection } from '../../status/model-connection'
import { Card, Check, Field, Form, Shell, Submit } from '../shell'

export function StatusModelPage({viewer,state}: {viewer:Viewer;state:Awaited<ReturnType<typeof statusModelConnection>>}) {
  return <Shell viewer={viewer} current="/auth/settings/identity" title="Settings: status model" facts={['Model access is separate from human publication approval.']}>
    <Card title="Model connection"><p>{state.connected ? `Configured model: ${state.model}` : 'No AI model connected'}</p><p>A generated update is always a private draft. It has no recipients until an authorized human edits and reviews the exact publication.</p>
      {viewer.role==='owner' ? <>
        <Form action="/api/v1/status-model" next="/app/settings/status-model" label="Connect status model"><input type="hidden" name="version" value={state.version}/><Field label="Exact OpenAI model" name="model" value={state.model} required/><Field label="OpenAI API key" name="apiKey" type="password" required/><Check label="Approve OpenAI to process explicitly selected status sources with training off" name="processorConsent"/><p>Connect and test makes one small model request without work content. The key is encrypted for this installation and omitted from archives. Every draft request still requires selected-source consent.</p><Submit>Connect and test model</Submit></Form>
        <Form action="/api/v1/status-model" next="/app/settings/status-model" label="Disconnect status model"><input type="hidden" name="version" value={state.version}/><input type="hidden" name="disconnect" value="true"/><Submit quiet>Disconnect model</Submit></Form>
      </> : <p>Ask the installation owner to connect or repair the model. You can continue ordinary work while it is disconnected.</p>}
    </Card>
  </Shell>
}
