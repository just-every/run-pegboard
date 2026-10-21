import { HydrationUnit } from '../base/hydration/unit'
import { AppBar } from './bar'
import { Arrow } from './icons'

// Any address the app does not have: the app's bar and wall, and one card hung on a peg.
export function NotFound() {
  return <div className="app">
    <HydrationUnit><AppBar home="/app" /></HydrationUnit>
    <main className="board lost" id="main">
      <HydrationUnit><section className="wall" aria-labelledby="lost-title">
        <div className="lost-card task">
          <span className="peg" aria-hidden="true" />
          <h1 id="lost-title">Page not found.</h1>
          <p>Nothing hangs at this address in Pegboard.</p>
          <a className="button primary" href="/app">Open Pegboard<Arrow /></a>
        </div>
      </section></HydrationUnit>
    </main>
  </div>
}
