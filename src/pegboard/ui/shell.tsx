// The frame every Pegboard screen shares: the app's bar with its views, then the board's heading band and the page under it.
import type { ReactNode } from 'react'
import { AppBar, type Tab } from '../../ui/bar'
import { Flap } from '../../ui/flap'
import { Heading } from '../../ui/heading'
import { homeTabs } from '../../ui/home'
import type { Viewer } from '../../ui/viewer'

export interface ShellProps { viewer: Viewer; current: string; crumbs?: Tab[]; title: string; chip?: string; facts?: string[]; children: ReactNode }
export function Shell({ viewer, current, crumbs, title, chip, facts = [], children }: ShellProps) {
  return <>
    <AppBar viewer={viewer} tabs={homeTabs(viewer, current)} crumbs={crumbs} />
    <main className="board" id="main">
      <Heading title={title} chip={chip ? <Flap text={chip} tone="quiet" /> : undefined} facts={facts} />
      <section className="page">{children}</section>
    </main>
  </>
}

/** A white card on the wall; `id` anchors it. */
export const Card = ({ title, children, id }: { title?: string; children: ReactNode; id?: string }) => <article className="card panel" id={id}><span className="peg" aria-hidden="true" />{title && <h2>{title}</h2>}{children}</article>

/** A form that posts to the JSON API's own door and returns to `next`; the server does the checking. */
export function Form({ action, next, children, label }: { action: string; next: string; children: ReactNode; label?: string }) {
  return <form method="post" action={action} className="stack" aria-label={label}><input type="hidden" name="_next" value={next} />{children}</form>
}
export const Field = ({ label, name, type = 'text', value, required, placeholder, step }: { label: string; name: string; type?: string; value?: string | number | null; required?: boolean; placeholder?: string;step?:string|number }) =>
  <label className="field">{label}<input className="input" name={name} type={type} defaultValue={value ?? undefined} required={required} placeholder={placeholder} step={step} /></label>
export const Area = ({ label, name, value }: { label: string; name: string; value?: string }) => <label className="field">{label}<textarea className="input" aria-label={label} name={name} rows={3} defaultValue={value} /></label>
export function Pick({ label, name, options, value, blank }: { label: string; name: string; options: { value: string; label: string }[]; value?: string | null; blank?: string }) {
  return <label className="field">{label}<select className="select" aria-label={label} name={name} defaultValue={value ?? ''}>{blank !== undefined && <option value="">{blank}</option>}{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}
export const Check = ({ label, name, checked }: { label: string; name: string; checked?: boolean }) => <label className="checkbox"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label>
export const Submit = ({ children, quiet }: { children: ReactNode; quiet?: boolean }) => <button type="submit" className={quiet ? 'button quiet' : 'button primary'}>{children}</button>

export const when = (at: number | null | undefined) => at ? new Date(at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : '—'
export const levelLabel = (level: string | null | undefined) => level ? level[0].toUpperCase() + level.slice(1) : 'No access'
export const levelOptions = (max: string[] = ['viewer', 'commenter', 'editor', 'admin']) => max.map(level => ({ value: level, label: levelLabel(level) }))
