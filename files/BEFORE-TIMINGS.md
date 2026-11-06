# Historical job duration evidence

Collected once per requested run with gh run view --json jobs. The endpoint returns latest attempts, so rerun jobs can have later starts. Durations include setup and cleanup.

| Run | Job | ID | Conclusion | Seconds |
| --- | --- | --- | --- | --- |
| 42268005252 | shards (work-graph-core) | 128077975194 | cancelled | 736 |
| 42268005252 | shards (work-graph-services) | 128077975423 | success | 215 |
| 42268005252 | shards (work-graph-reporting) | 128077975545 | success | 495 |
| 42268005252 | shards (work-graph-extensions) | 128077975593 | success | 405 |
| 42268005252 | shards (work-graph-custody-recovery) | 128077975637 | success | 514 |
| 42268005252 | shards (work-graph-custody-erasure) | 128077975852 | success | 506 |
| 42268005252 | shards (access-control) | 128077975884 | success | 232 |
| 42268005252 | shards (portfolios) | 128077976231 | success | 365 |
| 42268005252 | shards (journeys-core-access) | 128077976958 | success | 432 |
| 42268005252 | shards (journeys-core-work) | 128077976965 | success | 497 |
| 42268005252 | shards (journeys-services) | 128077976978 | success | 386 |
| 42268005252 | shards (workflow-rules) | 128077977059 | success | 285 |
| 42268005252 | shards (journeys-services-work) | 128077977287 | success | 445 |
| 42268005252 | shards (journeys-planning-capacity) | 128077977946 | success | 327 |
| 42268005252 | shards (journeys-planning-work) | 128077978330 | success | 346 |
| 42268005252 | shards (source) | 128078030990 | success | 369 |
| 42268005252 | shards (runtime) | 128078047440 | success | 423 |
| 42268005252 | shards (work-graph-time) | 128078059189 | success | 506 |
| 42252802997 | shards (source) | 128043534033 | success | 335 |
| 42252802997 | shards (work-graph-time) | 128043534123 | success | 515 |
| 42252802997 | shards (runtime) | 128043534181 | success | 515 |
| 42252802997 | shards (work-graph-extensions) | 128043534272 | success | 640 |
| 42252802997 | shards (work-graph-custody-recovery) | 128043534453 | success | 501 |
| 42252802997 | shards (work-graph-services) | 128043534454 | success | 212 |
| 42252802997 | shards (work-graph-custody-erasure) | 128043534458 | success | 427 |
| 42252802997 | shards (work-graph-core) | 128043534872 | success | 510 |
| 42252802997 | shards (portfolios) | 128043535359 | success | 281 |
| 42252802997 | shards (access-control) | 128043535572 | success | 187 |
| 42252802997 | shards (journeys-core-access) | 128043535730 | success | 360 |
| 42252802997 | shards (work-graph-reporting) | 128043535794 | success | 480 |
| 42252802997 | shards (workflow-rules) | 128043535957 | success | 317 |
| 42252802997 | shards (journeys-core-work) | 128043536049 | success | 416 |
| 42252802997 | shards (journeys-planning-work) | 128043536279 | success | 427 |
| 42252802997 | shards (journeys-planning-capacity) | 128043536695 | success | 263 |
| 42252802997 | shards (journeys-services-work) | 128043536708 | success | 432 |
| 42252802997 | shards (journeys-services) | 128043537025 | success | 324 |

Run 42268005252: core cancellation is 736 seconds (12m16s); the timeout remains 12 minutes. Run 42252802997: latest core attempt succeeds in 510 seconds. Earlier attempt timings are not silently substituted. These measurements motivate independent lane packing and suite splits; only candidate CI establishes final balance.
