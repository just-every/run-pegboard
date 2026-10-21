// Pegboard currently has only owner access and first-run setup. No product
// samples exist to copy; keep the demo faithful to the foundation. The demo's
// owner skips first-run setup, so it takes the cast's name the app pick shows,
// Wes Holloway, in place of Base's default "Owner".
import type { Bindings } from './auth.server'

export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO oa_first_run (singleton, completed_by, completed_at) SELECT 1, id, ? FROM oa_operators WHERE email = ? AND role = 'owner' ON CONFLICT(singleton) DO NOTHING").bind(now.getTime(), ownerEmail),
    env.DB.prepare("UPDATE oa_operators SET display_name = 'Wes Holloway' WHERE email = ? AND role = 'owner'").bind(ownerEmail),
  ])
}
