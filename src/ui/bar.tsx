import { Fragment } from 'react'
import branding from '../branding.json'
import { initials, roleLabel, type Viewer } from './viewer'

/** `fold`: where the bar is too narrow for every view, views with fold 1 move into More first, then fold 2; a view
 *  without one always stays a tab (public/look/shell.css sets the widths). */
export interface Tab { label: string; href: string; current?: boolean; fold?: 1 | 2 }

// The app's one white bar (owner pick A): mark 9 and the wordmark, the breadcrumb, the views as azure tabs, the person.
// The dot between the views is drawn outside the links, so no link's name or focus ring carries it. A project's views
// (Wall, Timeline, Path, Workload, List, Calendar) take the tabs when projects exist (docs/LOOK.md). The views that can
// fold are written twice, as a tab and in More's list; the stylesheet shows exactly one of the two at any width. More's
// list sits beside its <details>, not inside it: a closed list is then simply not displayed, where links inside a closed
// <details> would report no text at all.
export function AppBar({ viewer, crumbs = [], tabs = [], home = '/app' }: { viewer?: Viewer; crumbs?: Tab[]; tabs?: Tab[]; home?: string }) {
  const folding = tabs.filter(tab => tab.fold)
  return <header className="bar">
    <a className="lockup" href={home}><img src="/brand/mark.svg" alt="" width={44} height={44} /><span data-rer-name>{branding.name}</span></a>
    {crumbs.length > 0 && <nav className="crumbs" aria-label="Breadcrumb"><ol>{crumbs.map(crumb => <li key={crumb.href}><a href={crumb.href} aria-current={crumb.current ? 'page' : undefined}>{crumb.label}</a></li>)}</ol></nav>}
    {tabs.length > 0 && <nav className="tabs" aria-label="Views">{tabs.map((tab, i) => <Fragment key={tab.href}>
      {i > 0 && <span className="sep" aria-hidden="true" data-fold={tab.fold} />}
      <a href={tab.href} aria-current={tab.current ? 'page' : undefined} data-fold={tab.fold}>{tab.label}</a>
    </Fragment>)}
    {folding.length > 0 && <>
      <span className="sep tabs-more-sep" aria-hidden="true" />
      <span className="tabs-more">
        <details><summary>More</summary></details>
        <ul>{folding.map(tab => <li key={tab.href} data-fold={tab.fold}><a href={tab.href} aria-current={tab.current ? 'page' : undefined}>{tab.label}</a></li>)}</ul>
      </span>
    </>}</nav>}
    {viewer && <p className="person"><span className="avatar" aria-hidden="true">{initials(viewer.displayName)}</span><span className="person-text"><b>{viewer.displayName}</b><small>{roleLabel(viewer.role)}</small></span></p>}
  </header>
}
