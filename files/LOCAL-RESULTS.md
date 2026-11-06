# Local validation record

- Launcher refreshed; Git reads the authorized decrypted bundle at use time. No alternate credential was sought.
- Setup and production build completed through cloud_run. The build used the project Node 22.20.0. Private setup output is deliberately not an evidence selection.
- Typecheck passed on Node 22.20.0 / pnpm 10.12.4.
- First-party command-contract check passed.
- Contract generator check passed unchanged: 22 done, 20 partial, 50 missing.
- Workflow permission validation, JavaScript syntax, unchanged workflow/planner/concurrency diff and exhaustive coverage mapping passed.
- Runner fixture checks passed: separate inputs and dependencies, private settings excluded, sibling directories independent, every sibling awaited after an intentional exit 7, nonzero failure propagation and temporary-directory cleanup. The fixture is outside the product; no permanent test was added.
- The VM's initial direct shell selected Node 24.19.0. An exploratory old-core diagnostic there failed Worker startup and was stopped along with only its owned descendants; its partial log is retained, never counted as a passing test or a performance baseline. Repeating the lifecycle assertion with pinned Node 22.20.0 passed. All subsequent application tests explicitly prepend that installed pinned Node.
- The core/capacity local sample began with the first complementary partition. Its suite measurements informed the final repartition of core (lifecycle / graph / views / text versus PDF / decisions / search). The mapping proves the same selected leaves; exact final composition is tested by candidate CI. Time/planning uses the final selectors.

Core/capacity and time/planning completion receipts will be recorded in REPORT.md and local-receipt.json. Historical GitHub durations and final exact-SHA timings remain separate from local samples; the local core/capacity and time/planning runs briefly overlap on the four-CPU VM.

The final scheduling fix retains eight jobs and uses 23 isolated lanes, with exclusive provider-diagnostics/background-audit phases. Six browser-capable jobs retain all 35 selectors and complete templates/conversion journeys. No compile-cache setting remains: the measured 0.3% difference was not material. Scope and workflow proof rules remain unchanged.
