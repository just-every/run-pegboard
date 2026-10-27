const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false })
const text = { type: 'string' }, integer = { type: 'integer', minimum: 1 }, task = { taskId: text }
export const tools = [
 { name: 'task_read', description: 'Read permitted work and its exact revision.', inputSchema: object(task, ['taskId']) },
 { name: 'task_create', description: 'Create one task. Requires an idempotency key.', inputSchema: object({ projectId: text, title: text, description: text, estimateHours: { type: 'number' }, kind: { enum: ['task', 'approval'] }, intent: text }, ['title', 'intent']) },
 { name: 'task_update', description: 'Edit permitted work at its exact reviewed revision.', inputSchema: object({ ...task, revision: text, intent: text, patch: object({ title: text, description: text, status: { enum: ['todo', 'doing', 'done'] }, priority: { enum: ['low', 'normal', 'high', 'urgent'] }, estimateHours: { type: 'number' } }) }, ['taskId', 'revision', 'patch', 'intent']) },
 { name: 'task_comment', description: 'Comment under the current project role.', inputSchema: object({ ...task, body: text, intent: text }, ['taskId', 'body', 'intent']) },
 { name: 'project_tasks', description: 'Read a cursor page of permitted project tasks.', inputSchema: object({ projectId: text, cursor: text, limit: integer }, ['projectId']) },
 { name: 'project_report', description: 'Read the permission-filtered project report.', inputSchema: object({ projectId: text }, ['projectId']) },
 { name: 'personal_tasks', description: 'List only your own no-project work.', inputSchema: object({}) },
 { name: 'personal_sections', description: 'Read your own saved personal sections and their current edit revision.', inputSchema: object({}) },
 { name: 'personal_section_save', description: 'Create or edit your own personal section at the reviewed revision.', inputSchema: object({ id: text, name: text, position: {type: 'number'}, revision: text, intent: text }, ['name', 'revision', 'intent']) },
 { name: 'personal_task_place', description: 'Place your own personal task in a saved section. An empty section ID clears the section.', inputSchema: object({ ...task, sectionId: text, position: {type: 'number'}, today: {type: 'boolean'}, revision: text, intent: text }, ['taskId', 'revision', 'intent']) },
 { name: 'task_approve', description: 'Requires a human decision in Pegboard; external agents cannot approve.', inputSchema: object(task, ['taskId']), annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
 { name: 'events_list', description: 'Read signed identifier-only events for currently permitted work.', inputSchema: object({ cursor: text, limit: integer }) },
 { name: 'event_receive', description: 'Verify a signed event and record its receipt once.', inputSchema: object({ envelope: { type: 'object' }, signature: text }, ['envelope', 'signature']) },
]
export const restOperations = [
 ['get', '/tasks/{taskId}', 'task_read'], ['post', '/tasks', 'task_create'], ['patch', '/tasks/{taskId}', 'task_update'],
 ['post', '/tasks/{taskId}/comments', 'task_comment'], ['get', '/projects/{projectId}/tasks', 'project_tasks'],
 ['get', '/projects/{projectId}/report', 'project_report'], ['get', '/personal-tasks', 'personal_tasks'],
 ['get', '/personal-sections', 'personal_sections'], ['post', '/personal-sections', 'personal_section_save'], ['patch', '/personal-tasks/{taskId}/layout', 'personal_task_place'],
 ['post', '/tasks/{taskId}/approve', 'task_approve'], ['get', '/events', 'events_list'], ['post', '/events/receive', 'event_receive'],
] as const
export function openapi() {
 const paths: Record<string, Record<string, unknown>> = {}
 for (const [method, path, name] of restOperations) {
  const tool = tools.find(tool => tool.name === name)!
  const parameters: unknown[] = [...path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: text }))
  if (method === 'get') for (const [key, schema] of Object.entries(tool.inputSchema.properties)) if (!path.includes(`{${key}}`)) parameters.push({ name: key, in: 'query', schema, required: tool.inputSchema.required.includes(key) })
  const bodyProperties = Object.fromEntries(Object.entries(tool.inputSchema.properties).filter(([key]) => !path.includes(`{${key}}`)))
  ;(paths[path] ??= {})[method] = { operationId: name, description: tool.description, parameters,
   ...(method === 'get' ? {} : { requestBody: { required: true, content: { 'application/json': { schema: object(bodyProperties, tool.inputSchema.required.filter(key => !path.includes(`{${key}}`))) } } } }),
   responses: { '200': { description: 'Authorized result' }, '400': { description: 'Invalid input' }, '401': { description: 'Credential unavailable' }, '403': { description: 'Operation refused' }, '404': { description: 'Unavailable resource' }, '409': { description: 'Stale revision or reused intent' } } }
 }
 return { openapi: '3.1.0', info: { title: 'Pegboard scoped work API', version: '1.0.0' }, servers: [{ url: '/api/v1/public' }], security: [{ bearer: [] }], components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } }, paths }
}

/** Validate the declared native schemas before reserving a mutation intent. */
export function validateTool(name: string, value: unknown) {
 const tool = tools.find(tool => tool.name === name)
 if (!tool) return 'unknown_tool'
 const walk = (schema: any, value: any): boolean => {
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'object') {
   if (!value || typeof value !== 'object' || Array.isArray(value)) return false
   if ((schema.required ?? []).some((key: string) => !Object.hasOwn(value, key))) return false
   if (schema.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(schema.properties ?? {}, key))) return false
   for (const [key, child] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key) && !walk(child, value[key])) return false
  } else if (schema.type === 'string' && typeof value !== 'string') return false
  else if (schema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false
  else if (schema.type === 'boolean' && typeof value !== 'boolean') return false
  else if (schema.type === 'integer' && !Number.isSafeInteger(value)) return false
  if (schema.minimum !== undefined && value < schema.minimum) return false
  return true
 }
 return walk(tool.inputSchema, value) ? null : 'tool_arguments'
}
