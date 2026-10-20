// Read only repository Markdown, at site build time. No installation files enter the site.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Doc = { file: string; path: string; title: string; summary: string; group: string; markdown: string; origin?: { path: string; revision: string; repository: string } }
type Copies = { copies: { path: string; originPath: string; revision: string }[] }
type Edition = { components: { id: string; source: { origin?: { repository: string } } }[] }
const guides: Record<string, [string, string, string]> = {
  'README.md': ['getting-started', 'Getting started', 'Start Pegboard, sign in as the owner and understand what is available today.'],
  'RUN-LOCALLY.md': ['run-locally', 'Run locally', 'The complete local workflow, runtime requirements and command options.'],
  'ONBOARDING.md': ['setup', 'Setup', 'The foundation setup adapter, owner inputs and installation lifecycle.'],
  'OPERATIONS.md': ['operations', 'Operations', 'Deployment, local data, installation archives and recovery.'],
  'SEED-COMMAND-CONTRACT.md': ['commands', 'Command reference', 'The public command contract: flags, effects, state and exit behavior.'],
  'VERIFY-WORKFLOW.md': ['verification', 'Verification', 'How the repository checks its source, build and runtime.'],
  'CONTRACT.md': ['contract', 'Product contract', 'The destination contract, clause statuses and required acceptance journeys.'],
  'ACCEPTANCE.md': ['acceptance', 'Acceptance journeys', 'The public-door journeys required to prove each product clause.'],
}
export const groups = ['Start here', 'Operate & develop', 'Product & design', 'Technical reference']

function excerpt(markdown: string): string {
  const paragraph = markdown.split(/\n\s*\n/).find(block => block.trim() && !/^(?:#|\||```|~~~|>|- )/.test(block.trim())) ?? ''
  const plain = paragraph.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim()
  return plain.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || plain
}

function markdownFiles(root: string, directory: string, recursive: boolean): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = directory ? `${directory}/${entry.name}` : entry.name
    return entry.isDirectory() && recursive ? markdownFiles(root, file, true) : entry.isFile() && entry.name.endsWith('.md') ? [file] : []
  }).sort()
}

export function readDocs(root: string): Doc[] {
  const copies: Copies = JSON.parse(readFileSync(join(root, 'base-copies.json'), 'utf8'))
  const edition: Edition = JSON.parse(readFileSync(join(root, 'edition.json'), 'utf8'))
  const repository = edition.components.find(component => component.id === 'runeditrun/base')?.source.origin?.repository.replace(/\.git$/, '')
  if (!repository) throw new Error('Docs need the recorded Base source repository.')
  const files = [...markdownFiles(root, '', false), ...markdownFiles(root, 'src', true), ...markdownFiles(root, 'public', true)]
  const order = Object.keys(guides)
  return files.map(file => {
    const markdown = readFileSync(join(root, file), 'utf8')
    const guide = guides[file]
    const copy = copies.copies.find(copy => copy.path === file)
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1].replace(/[`*_]/g, '')
    const title = guide?.[1] ?? heading ?? file.replace(/\.md$/, '')
    const slug = guide?.[0] ?? file.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/^-|-$/g, '')
    const group = ['README.md', 'RUN-LOCALLY.md', 'ONBOARDING.md'].includes(file) ? groups[0]
      : ['OPERATIONS.md', 'SEED-COMMAND-CONTRACT.md', 'VERIFY-WORKFLOW.md'].includes(file) ? groups[1]
        : ['CONTRACT.md', 'ACCEPTANCE.md', 'HOMEPAGE-VARIANTS.md'].includes(file) ? groups[2] : groups[3]
    return { file, path: `/docs/${slug}`, title, summary: guide?.[2] ?? excerpt(markdown), group, markdown,
      ...(copy ? { origin: { path: copy.originPath, revision: copy.revision, repository } } : {}) }
  }).sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group)
    || (order.indexOf(a.file) < 0 ? 99 : order.indexOf(a.file)) - (order.indexOf(b.file) < 0 ? 99 : order.indexOf(b.file))
    || a.file.localeCompare(b.file))
}
