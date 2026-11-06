# Final job composition

| Job | Execution | Isolated lanes | Browser | Hosted |
| --- | --- | --- | --- | --- |
| runtime-source | parallel | runtime, source, access-control | true | true |
| core-capacity | parallel | work-graph-core, work-graph-intake, journeys-planning-capacity | true | false |
| extensions-services | parallel | work-graph-extensions, work-graph-pdf-custody, journeys-services-work | true | false |
| time-planning | parallel | work-graph-time, work-graph-decisions, journeys-planning-work | true | false |
| custody-recovery | serial; diagnostics owns runner | provider-diagnostics, work-graph-rule-audit | false | false |
| custody-access | parallel | work-graph-custody-erasure, journeys-services, journeys-core-access | true | false |
| reporting-work | parallel | work-graph-reporting, work-graph-analyst, journeys-core-work | true | false |
| planning-services | parallel | work-graph-custody-recovery, portfolios, workflow-rules | false | false |

There are 23 isolated lanes across eight jobs. Seven jobs run at most three lanes concurrently. The diagnostics job runs two lanes serially, preserving its existing six-minute test deadline. Goal suites join core, engineering/meeting suites join time, retained recovery joins reporting, capacity joins analyst exports and typecheck joins source. All selected assertions remain once. Each lane runs its commands sequentially and has independent dependency, Vite, Wrangler and Git directories. The hosted runtime lane owns the single production build. Every sibling finishes after a failure; cleanup then removes temporary copies. Workflow/planner/concurrency, one-full-run-per-commit proof and 12-minute job limit remain unchanged; ubuntu-24.04 remains the only image.

The compile-cache experiment was not retained; the final runner uses the original environment plus the existing operation-token isolation.
