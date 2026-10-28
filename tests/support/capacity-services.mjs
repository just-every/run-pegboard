// Willow's versioned calendar and BambooHR's time-off request schemas, at the network edge only.
import { createServer } from 'node:http'
export async function startCapacityServices() {
  const rows = { willow: [], bamboohr: [] }, refused = new Set(), reads = { willow: 0, bamboohr: 0 }
  const servers = [], origins = {}
  for (const service of Object.keys(rows)) {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      const expected = service === 'willow' ? 'Bearer synthetic-pegboard-1600' : 'Basic ' + Buffer.from('synthetic-pegboard-1600:x').toString('base64')
      if (request.method !== 'GET' || request.headers.authorization !== expected || refused.has(service)) { response.writeHead(403); response.end(JSON.stringify({ error: 'refused' })); return }
      const url = new URL(request.url, 'http://localhost')
      if (service === 'willow') {
        if (url.pathname !== '/api/willow/v1/calendar' || url.searchParams.get('limit') !== '100') { response.writeHead(400); response.end('{}'); return }
        const cursor = Number(url.searchParams.get('cursor') ?? 0)
        if (!Number.isInteger(cursor) || cursor < 0 || cursor > rows.willow.length) { response.writeHead(400); response.end('{}'); return }
        reads.willow++
        response.end(JSON.stringify({ apiVersion: '1', data: rows.willow.slice(cursor, cursor + 1), nextCursor: cursor + 1 < rows.willow.length ? String(cursor + 1) : null, syncCursor: null, resetRequired: false }))
      } else {
        if (url.pathname !== '/api/gateway.php/synthetic-pegboard/v1/time_off/requests' || !url.searchParams.get('start') || !url.searchParams.get('end')) { response.writeHead(400); response.end('{}'); return }
        reads.bamboohr++; response.end(JSON.stringify(rows.bamboohr))
      }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    origins[service] = 'http://127.0.0.1:' + server.address().port; servers.push(server)
  }
  return { origins: JSON.stringify(origins), rows, refused, reads, stop: () => Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))) }
}
