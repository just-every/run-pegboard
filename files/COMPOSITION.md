# Final job composition

| Job | Isolated concurrent lanes | Browser | Hosted |
| --- | --- | --- | --- |
| runtime-source | runtime, source, access-control | true | true |
| core-capacity | work-graph-core, work-graph-intake, journeys-planning-capacity | true | false |
| extensions-services | work-graph-extensions, work-graph-pdf-custody, journeys-services-work | true | false |
| time-planning | work-graph-time, work-graph-decisions, journeys-planning-work | true | false |
| custody-recovery | work-graph-custody-recovery, work-graph-recovery, journeys-services | true | false |
| custody-access | work-graph-custody-erasure, work-graph-rule-audit, journeys-core-access | true | false |
| reporting-work | work-graph-reporting, work-graph-analyst, journeys-core-work | true | false |
| planning-services | work-graph-services, portfolios, workflow-rules | false | false |

Every lane runs its commands sequentially. Lanes have independent dependency, Vite, Wrangler and Git directories. The hosted runtime lane uses the original checkout so RER can inspect its single production build after every lane succeeds. Every sibling finishes before failures propagate and temporary directories are removed. The existing plan job, concurrency group, one-full-run-per-commit proof and 12-minute shard limit are byte-for-byte unchanged. All jobs remain on ubuntu-24.04.
