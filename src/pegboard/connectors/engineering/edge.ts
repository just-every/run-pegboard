// Provider schemas are normalized only at this network boundary. No provider body or credential is persisted.
import type { Bindings } from '../../../auth.server'
import { invalid, PegError } from '../../db'
export type Service = 'vector' | 'jira' | 'github'
export interface Source { id: string; status: string; owner: string | null; version: string; url: string }
export interface Target { service: Service; origin: string; locator: string }
export function target(env: Bindings, input: Record<string, any>): Target {
  const service = input.service as Service
  if (!['vector', 'jira', 'github'].includes(service)) throw invalid('engineering_service_invalid')
  const locator = String(input.locator ?? '')
  if (!(service === 'github' ? /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/(issues|pulls)\/[1-9][0-9]*$/ : /^[A-Z]{2,10}-[1-9][0-9]*$/).test(locator)) throw invalid('engineering_locator_invalid')
  const origin = service === 'github' ? 'https://api.github.com' : service === 'vector' ? env.PEGBOARD_VECTOR_ORIGIN : String(input.origin ?? '')
  let url: URL
  try { url = new URL(origin ?? '') } catch { throw invalid('engineering_origin_required') }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (service === 'jira' && !/^[a-z0-9-]+\.atlassian\.net$/.test(url.hostname)) || (service === 'vector' && (!url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) || url.hostname.includes(':')))) throw invalid('engineering_origin_invalid')
  return { service, origin: url.origin, locator }
}
export function provider(env: Bindings, t: Target, credential: unknown) {
  if (typeof credential !== 'string' || !credential.trim() || credential.length > 4096 || /[\r\n]/.test(credential)) throw invalid('engineering_credential_required')
  const override = env.AUTH_LOCAL === 'true' && env.PEGBOARD_LOCAL_ENGINEERING_ORIGINS ? JSON.parse(env.PEGBOARD_LOCAL_ENGINEERING_ORIGINS)[t.service] : null
  const origin = override ? new URL(override).origin : t.origin
  const path = t.service === 'github' ? '/repos/' + t.locator : t.service === 'jira' ? '/rest/api/3/issue/' + encodeURIComponent(t.locator) : '/api/v1/issues/' + encodeURIComponent(t.locator)
  async function call(method: string, suffix = '', body?: unknown, absolute?: string) {
    let response: Response
    try { response = await fetch(origin + (absolute ?? path + suffix), { method, headers: { authorization: (t.service === 'jira' ? 'Basic ' : 'Bearer ') + credential, accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'Pegboard', ...(t.service === 'github' ? {'x-github-api-version': '2022-11-28'} : {}) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000) }) } catch { throw new PegError(503, 'engineering_source_unavailable') }
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new PegError(403, 'engineering_source_refused')
    if (response.status < 200 || response.status >= 300) throw new PegError(503, 'engineering_source_unavailable')
    return response.status === 204 ? null : response.json().catch(() => null)
  }
  return {
    async hasBacklink(text: string) {
      let cursor: string | null=null
      for(let page=0;page<5;page++){
        const commentsPath=t.service==='vector'?'/api/v1/comments?issue='+encodeURIComponent(t.locator)+'&limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''):t.service==='jira'?path+'/comment?maxResults=100&startAt='+page*100:path.replace('/pulls/','/issues/')+'/comments?per_page=100&page='+(page+1)
        const value: any=await call('GET','',undefined,commentsPath)
        const comments=t.service==='github'?value:value?.comments
        if(!Array.isArray(comments))throw new PegError(502,'engineering_source_incomplete')
        if(comments.some((c:any)=>t.service==='jira'?c.body?.content?.some((p:any)=>p.content?.some((v:any)=>v.text===text)):c.body===text))return true
        if(t.service==='vector'){cursor=value.nextCursor;if(!cursor)return false}
        else if(t.service==='jira'){if(value.startAt+comments.length>=value.total)return false}
        else if(comments.length<100)return false
      }
      throw new PegError(409,'engineering_comment_scan_incomplete')
    },
    async backlink(text: string) {
      const suffix=t.service==='jira'?'/comment':'/comments',endpoint=t.service==='github'?path.replace('/pulls/','/issues/')+suffix:path+suffix
      await call('POST','',t.service==='jira'?{body:{type:'doc',version:1,content:[{type:'paragraph',content:[{type:'text',text}]}]}}:{body:text},endpoint)
    },
    async read(): Promise<Source> {
      const value: any = await call('GET')
      let source: Source
      if (t.service === 'github') source = { id: String(value?.id ?? ''), status: value?.merged_at ? 'merged' : value?.state, owner: value?.assignee?.id ? String(value.assignee.id) : null, version: value?.updated_at, url: 'https://github.com/' + t.locator.replace('/pulls/', '/pull/') }
      else if (t.service === 'jira') source = { id: String(value?.id ?? ''), status: value?.fields?.status?.id, owner: value?.fields?.assignee?.accountId ?? null, version: value?.fields?.updated, url: t.origin + '/browse/' + t.locator }
      else source = { id: value?.id, status: value?.status?.id, owner: value?.assignee?.id ?? null, version: String(value?.version ?? ''), url: t.origin + '/app/issues/' + t.locator }
      if (!source.id || !source.status || !source.version || ![source.id, source.status, source.version, source.owner ?? ''].every(v => typeof v === 'string' && v.length < 256)) throw new PegError(502, 'engineering_source_incomplete')
      return source
    },
    // Jira transition IDs are checked against current transitions; Vector requires an exact source version.
    async update(status: string, version: string, transition?: string) {
      if (t.service === 'github') {
        if (!t.locator.includes('/issues/') || !['open','closed'].includes(status)) throw invalid('engineering_github_transition_invalid')
        await call('PATCH', '', { state: status })
      } else if (t.service === 'jira') {
        if (!transition || !/^[0-9]+$/.test(transition)) throw invalid('engineering_jira_transition_required')
        const available: any = await call('GET','/transitions')
        if (!available?.transitions?.some((t:any) => t.id === transition && t.to?.id === status)) throw invalid('engineering_jira_transition_invalid')
        await call('POST', '/transitions', { transition: {id: transition} })
      } else await call('PATCH', '', { expectedVersion: Number(version), statusId: status })
    },
  }
}
