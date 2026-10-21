// The signed-in person as the app shows them: name, initials and role.
export interface Viewer { displayName: string; email: string; role: string }

const roles: Record<string, string> = { owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member', analyst: 'Analyst', guest: 'Guest', agent: 'Agent' }
export const roleLabel = (role: string) => roles[role] ?? role

/** "Wes Holloway" → "WH"; a single name gives one letter. */
export const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => [...part][0].toUpperCase()).join('') || '?'
