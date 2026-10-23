/** Version 1 has an explicit allowlist: no arbitrary task fields or source context. */
export const schema = {
  Projects: { id: 'String', name: 'String', status: 'String' },
  Tasks: { id: 'String', title: 'String', status: 'String', estimateHours: 'Double' },
  TaskProjects: { id: 'String', taskId: 'String', projectId: 'String' },
  TimeEntries: { id: 'String', taskId: 'String', projectId: 'String', sheetId: 'String', seconds: 'Int64', adjustmentOf: 'String' },
} as const
export type Dataset = keyof typeof schema
export type Fields = Partial<Record<Dataset, string[]>>
export const datasets = Object.keys(schema) as Dataset[]
export function metadata(fields: Fields) {
  const names = datasets.filter(name => fields[name])
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="Pegboard" xmlns="http://docs.oasis-open.org/odata/ns/edm">' +
    names.map(name => `<EntityType Name="${name}"><Key><PropertyRef Name="id"/></Key>${fields[name]!.map(field => `<Property Name="${field}" Type="Edm.${(schema[name] as Record<string,string>)[field]}" Nullable="${field === 'id' ? 'false' : 'true'}"/>`).join('')}</EntityType>`).join('') +
    '<EntityContainer Name="Analytics">' + names.map(name => `<EntitySet Name="${name}" EntityType="Pegboard.${name}"/>`).join('') + '</EntityContainer></Schema></edmx:DataServices></edmx:Edmx>'
}
