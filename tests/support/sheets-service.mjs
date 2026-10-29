// schema-fake: official Drive v3 permissions and files, Sheets v4 spreadsheets and batchUpdate.
// Sources: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list
// https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
// https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
export const sheetsCredential = 'synthetic-pegboard-771', spreadsheetId = 'synthetic-pegboard-770'
export async function startSheetsService() {
 const address = n => ['synthetic-pegboard-' + n, 'example.test'].join(String.fromCharCode(64))
 const state = { calls: [], tabs: new Map(), denied: false, readOnly: false, trashed: false, unavailable: false, unknownAudience: false, loseNextWrite: false, failNextWrite: false, name: 'Agency delivery workbook', permissions: [{ id: 'synthetic-pegboard-772', type: 'user', role: 'owner', emailAddress: address(772) }, { id: 'synthetic-pegboard-773', type: 'user', role: 'reader', emailAddress: address(773) }] }
 const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), chunks = []; for await (const c of req) chunks.push(c)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
  state.calls.push({ method: req.method, path: url.pathname, body })
  const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  try {
   if (state.denied || req.headers.authorization !== 'Bearer ' + sheetsCredential) return send(403, { error: { code: 403, message: 'Permission denied', status: 'PERMISSION_DENIED' } })
   if (state.unavailable) return send(503, { error: { code: 503, message: 'Unavailable', status: 'UNAVAILABLE' } })
   const drive = '/drive/v3/files/' + spreadsheetId, sheets = '/v4/spreadsheets/' + spreadsheetId
   if (req.method === 'GET' && url.pathname === drive) return send(200, { id: spreadsheetId, name: state.name, mimeType: 'application/vnd.google-apps.spreadsheet', trashed: state.trashed, capabilities: { canEdit: !state.readOnly } })
   if (req.method === 'GET' && url.pathname === drive + '/permissions') {
    assert.ok(url.searchParams.get('fields').includes('nextPageToken'))
    const records = state.unknownAudience ? [{ id: 'synthetic-pegboard-774', type: 'group', role: 'reader', emailAddress: address(774) }] : state.permissions
    return send(200, url.searchParams.get('pageToken') === 'second' ? { permissions: records.slice(1) } : { permissions: records.slice(0, 1), nextPageToken: 'second' })
   }
   if (req.method === 'GET' && url.pathname === sheets) return send(200, { spreadsheetId, sheets: [...state.tabs.values()].map(t => ({ properties: { sheetId: t.id, title: t.title } })) })
   if (req.method === 'GET' && url.pathname.startsWith(sheets + '/values/')) {
    assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE')
    const range = decodeURIComponent(url.pathname.slice((sheets + '/values/').length)), match = /^'((?:[^']|'')*)'!A1:([A-Z]+)(\d+)$/.exec(range)
    assert.ok(match, range)
    const tab = [...state.tabs.values()].find(t => t.title === match[1].replaceAll("''", "'")); assert.ok(tab)
    const columns = [...match[2]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
    return send(200, { range, majorDimension: 'ROWS', values: tab.values.slice(0, Number(match[3])).map(r => r.slice(0, columns)) })
   }
   if (req.method === 'POST' && url.pathname === sheets + ':batchUpdate') {
    assert.deepEqual(Object.keys(body), ['requests']); assert.ok(body.requests.length >= 1)
    const tabs = structuredClone(state.tabs)
    for (const request of body.requests) {
     if (request.addSheet) { const p = request.addSheet.properties; assert.ok(Number.isInteger(p.sheetId)); assert.ok(!tabs.has(p.sheetId)); tabs.set(p.sheetId, { id: p.sheetId, title: p.title, values: [] }); continue }
     assert.deepEqual(Object.keys(request), ['updateCells'])
     const update = request.updateCells; assert.equal(update.fields, 'userEnteredValue'); const tab = tabs.get(update.range.sheetId); assert.ok(tab)
     assert.equal(update.range.startRowIndex, 0); assert.equal(update.range.startColumnIndex, 0)
     assert.equal(update.rows.length, update.range.endRowIndex)
     tab.values = update.rows.map(r => r.values.map(c => { assert.deepEqual(Object.keys(c.userEnteredValue), ['stringValue']); assert.equal(typeof c.userEnteredValue.stringValue, 'string'); return c.userEnteredValue.stringValue }))
    }
    if (state.failNextWrite) { state.failNextWrite = false; return send(503, { error: { code: 503 } }) }
    state.tabs = tabs
    if (state.loseNextWrite) { state.loseNextWrite = false; return send(503, { error: { code: 503 } }) }
    return send(200, { spreadsheetId, replies: body.requests.map(r => r.addSheet ? { addSheet: { properties: r.addSheet.properties } } : {}) })
   }
   return send(404, { error: { code: 404, message: 'Unknown schema edge' } })
  } catch (error) { state.error = String(error); return send(500, { error: { code: 500 } }) }
 })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 return { state, origin: `http://127.0.0.1:${server.address().port}`, async stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } }
}
