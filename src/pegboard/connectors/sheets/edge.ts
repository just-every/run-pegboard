// Official Drive v3 and Sheets v4 HTTP schemas. Local schema-fake origins require AUTH_LOCAL.
import type { Bindings } from '../../../auth.server'
import { invalid, PegError } from '../../db'
export class SheetsFailure extends PegError {}
export type Audience = { id: string; address: string; role: string }[]
export function sheetsEdge(env: Bindings, spreadsheet: string, credential: unknown) {
 if (typeof credential !== 'string' || !credential || credential.length > 4096 || /[\r\n\x00]/.test(credential)) throw invalid('sheets_credential_required')
 const local = env.AUTH_LOCAL === 'true' ? env.PEGBOARD_LOCAL_SHEETS_ORIGIN : undefined
 const drive = local ? new URL(local).origin : 'https://www.googleapis.com'
 const sheets = local ? new URL(local).origin : 'https://sheets.googleapis.com'
 async function call(origin: string, method: string, path: string, body?: unknown) {
  let response: Response
  try { response = await fetch(origin + path, { method, headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json', accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000) }) }
  catch { throw new SheetsFailure(503, 'sheets_outcome_uncertain') }
  if (!response.ok) throw new SheetsFailure([401, 403].includes(response.status) ? 403 : response.status === 404 ? 409 : 503, [401, 403].includes(response.status) ? 'sheets_provider_permission_refused' : response.status === 404 ? 'sheets_destination_deleted' : 'sheets_outcome_uncertain')
  try { return await response.json() as any } catch { throw new SheetsFailure(503, 'sheets_schema_incomplete') }
 }
 const base = '/v4/spreadsheets/' + encodeURIComponent(spreadsheet)
 return {
  async destination() {
   const file = await call(drive, 'GET', '/drive/v3/files/' + encodeURIComponent(spreadsheet) + '?fields=id,name,mimeType,trashed,driveId,capabilities(canEdit)')
   if (file.driveId || file.id !== spreadsheet || file.trashed !== false || file.mimeType !== 'application/vnd.google-apps.spreadsheet' || file.capabilities?.canEdit !== true || typeof file.name !== 'string') throw new SheetsFailure(403, 'sheets_destination_not_writable')
   const audience: Audience = [], seen = new Set<string>()
   let page = ''
   for (let n = 0; n < 20; n++) {
    const query = new URLSearchParams({ fields: 'nextPageToken,permissions(id,type,role,emailAddress,deleted,pendingOwner)', pageSize: '100', ...(page ? { pageToken: page } : {}) })
    const result = await call(drive, 'GET', '/drive/v3/files/' + encodeURIComponent(spreadsheet) + '/permissions?' + query)
    if (!Array.isArray(result.permissions)) throw new SheetsFailure(409, 'sheets_audience_unknown')
    for (const p of result.permissions) {
     if (p.deleted === true) continue
     // A group or link audience cannot establish its exact current recipients here.
     if (p.type !== 'user' || typeof p.id !== 'string' || !p.id || typeof p.emailAddress !== 'string' || !p.emailAddress || !['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'].includes(p.role) || p.pendingOwner) throw new SheetsFailure(409, 'sheets_audience_unknown')
     if (audience.some(a => a.id === p.id)) throw new SheetsFailure(409, 'sheets_audience_unknown')
     audience.push({ id: p.id, address: p.emailAddress, role: p.role })
    }
    if (!result.nextPageToken) break
    if (typeof result.nextPageToken !== 'string' || seen.has(result.nextPageToken) || n === 19) throw new SheetsFailure(409, 'sheets_audience_unknown')
    page = result.nextPageToken; seen.add(page)
   }
   if (!audience.length) throw new SheetsFailure(409, 'sheets_audience_unknown')
   const book = await call(sheets, 'GET', base + '?fields=spreadsheetId,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))')
   if (book.spreadsheetId !== spreadsheet || !Array.isArray(book.sheets) || book.sheets.some((s: any) => !Number.isInteger(s.properties?.sheetId) || typeof s.properties?.title !== 'string')) throw new SheetsFailure(503, 'sheets_schema_incomplete')
   return { id: file.id as string, name: file.name as string, url: 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(spreadsheet) + '/edit', audience: audience.sort((a, b) => a.id.localeCompare(b.id)), tabs: (book.sheets as any[]).map((s: any) => ({ id: s.properties.sheetId as number, title: s.properties.title as string, rows: Number(s.properties.gridProperties?.rowCount ?? 0), columns: Number(s.properties.gridProperties?.columnCount ?? 0) })) }
  },
  async read(title: string, rows: number, columns: number): Promise<string[][]> {
   const end = (n: number): string => n ? end(Math.floor((n - 1) / 26)) + String.fromCharCode(65 + (n - 1) % 26) : ''
   const range = "'" + title.replaceAll("'", "''") + "'!A1:" + end(columns) + rows
   const data = await call(sheets, 'GET', base + '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE')
   if (data.values !== undefined && (!Array.isArray(data.values) || data.values.some((r: any) => !Array.isArray(r) || r.some((c: any) => !['string', 'number', 'boolean'].includes(typeof c))))) throw new SheetsFailure(503, 'sheets_readback_incomplete')
   return Array.from({ length: rows }, (_, i) => Array.from({ length: columns }, (_, j) => String(data.values?.[i]?.[j] ?? '')))
  },
  async write(sheetId: number, title: string, capacity: { rows: number; columns: number } | null, values: string[][]) {
   await call(sheets, 'POST', base + ':batchUpdate', { requests: [
    ...(!capacity ? [{ addSheet: { properties: { sheetId, title, gridProperties: { rowCount: Math.max(1000, values.length), columnCount: values[0].length } } } }] : []),
    ...(capacity && values.length > capacity.rows ? [{ appendDimension: { sheetId, dimension: 'ROWS', length: values.length - capacity.rows } }] : []),
    ...(capacity && values[0].length > capacity.columns ? [{ appendDimension: { sheetId, dimension: 'COLUMNS', length: values[0].length - capacity.columns } }] : []),
    { updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: values[0].length }, rows: values.map(row => ({ values: row.map(value => ({ userEnteredValue: { stringValue: value } })) })), fields: 'userEnteredValue' } },
   ] })
  },
 }
}
