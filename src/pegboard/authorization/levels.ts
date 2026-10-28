// Access levels and the capabilities each grants. Pure: every door asks for a capability, never for a role name.
export const levels = ['viewer', 'commenter', 'editor', 'admin'] as const
export type Level = typeof levels[number]
export const rank = (level: Level | null | undefined): number => level ? levels.indexOf(level) + 1 : 0
export const isLevel = (value: unknown): value is Level => typeof value === 'string' && (levels as readonly string[]).includes(value)
export const maxLevel = (a: Level | null, b: Level | null): Level | null => rank(a) >= rank(b) ? a : b

export const capabilities = ['read', 'export', 'comment', 'edit', 'manage_settings', 'manage_fields', 'manage_rules', 'manage_templates', 'manage_shares', 'delegate_admin', 'approve'] as const
export type Capability = typeof capabilities[number]

const byLevel: Record<Level, Capability[]> = {
  viewer: ['read', 'export'],
  commenter: ['read', 'export', 'comment'],
  editor: ['read', 'export', 'comment', 'edit'],
  admin: ['read', 'export', 'comment', 'edit', 'manage_settings', 'manage_fields', 'manage_rules', 'manage_templates', 'manage_shares', 'delegate_admin', 'approve'],
}
export const capabilitiesOf = (level: Level): Capability[] => byLevel[level]
export const capabilityNames: readonly string[] = capabilities

export const label = (level: Level) => level[0].toUpperCase() + level.slice(1)

/** Workspace roles. Owner and admin come from Base's operators; the rest from workspace membership. */
export const workspaceRoles = ['owner', 'admin', 'manager', 'member', 'analyst', 'guest', 'agent'] as const
export type WorkspaceRole = typeof workspaceRoles[number]
export const memberRoles = ['manager', 'member', 'analyst', 'guest', 'agent'] as const
/** The highest level a kind of person can hold anywhere, whatever is granted. */
export const roleCeiling: Record<WorkspaceRole, Level> = { owner: 'admin', admin: 'admin', manager: 'admin', member: 'admin', analyst: 'viewer', guest: 'admin', agent: 'editor' }
export const isAdministrator = (role: WorkspaceRole | null) => role === 'owner' || role === 'admin'
/** People who see what the workspace shares with everyone: never guests, never agents. */
export const sharesWithWorkspace = (role: WorkspaceRole | null) => role === 'owner' || role === 'admin' || role === 'manager' || role === 'member' || role === 'analyst'
