// Thin D1 helpers and the one error type every Pegboard door answers with.
export class PegError extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail?: Record<string, unknown>) { super(code) }
}
export const notFound = () => new PegError(404, 'not_found')
export const forbidden = (needs?: string) => new PegError(403, 'forbidden', needs ? { needs } : undefined)
export const invalid = (code: string) => new PegError(400, code)
export const conflict = (code: string) => new PegError(409, code)

export const now = () => Date.now()
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`

export type Param = string | number | null
export const bound = (db: D1Database, sql: string, args: Param[]) => db.prepare(sql).bind(...args)
export async function all<T>(db: D1Database, sql: string, ...args: Param[]): Promise<T[]> {
  return (await bound(db, sql, args).all<T>()).results
}
export async function first<T>(db: D1Database, sql: string, ...args: Param[]): Promise<T | null> {
  return bound(db, sql, args).first<T>()
}
export async function run(db: D1Database, sql: string, ...args: Param[]) {
  return bound(db, sql, args).run()
}
/** One transaction: D1 applies a batch atomically. */
export const batch = (db: D1Database, statements: D1PreparedStatement[]) => db.batch(statements)

export const placeholders = (values: unknown[]) => values.map(() => '?').join(',') || 'NULL'
