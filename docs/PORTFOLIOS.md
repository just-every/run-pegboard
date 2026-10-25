# Portfolios and delivery risk

A portfolio groups projects and other portfolios (up to five levels). It never grants a project: everything a person
sees through a portfolio is computed from the projects and tasks they can already read.

## Access

- The workspace owner and administrators, a portfolio's owner and its admin members administer it and every portfolio beneath it.
- A viewer member reads it and everything beneath it. Guests and agents are never members.
- A person with no access gets the same not-found answer as for a portfolio that never existed, and the portfolio is absent from their list and search.

## Rollup

`GET /api/v1/portfolios/:id` returns the totals, each project's computed flags and manual health, the nested portfolios,
the timeline, workload and dashboard tabs, saved filters and the readable task rows. Totals count the distinct tasks of the
readable projects beneath a portfolio, so a task hung in several projects, or a project hung in several nested portfolios, counts once.
A project the person cannot read leaves no name, count or task anywhere. `?at=` evaluates the portfolio as of an instant:
statuses published later do not count and overdue is judged at that time. `GET .../drill?metric=` (`all`, `open`, `done`, `overdue`,
`milestones`, optionally `projectId`) returns the source tasks behind a figure.

## Risk policy

Each portfolio has a versioned policy (`POST .../policy`, owner or admin). Defaults: at risk when any incomplete milestone is past due,
any incomplete critical-path task has negative slack, at least 20% of incomplete due-dated tasks are overdue (compared in whole numbers),
or the last published status is more than seven calendar days old. Milestones are not counted among the tasks for the overdue share.
No eligible task gives no ratio and no flag. A project that never published a status is labeled unknown, not healthy, and is not flagged by age.
Every flag carries its source rows, the evaluated time and the policy version. The policy of the portfolio being viewed evaluates every
project beneath it. Slack and the critical path are read from the dependency graph of the tasks the person can read.

## Published status

`POST /api/v1/status-updates` records a person's statement (`on_track`, `at_risk`, `off_track` and a summary) for a project they administer
or a portfolio they administer. It is immutable and never inferred. Manual health is shown beside the computed result and never replaces it.

## Dependencies

`POST /api/v1/dependencies` links a predecessor to a dependant (`fs`, `ss`, `ff` or `sf`, with a lag or lead in working days) across projects.
It needs edit rights on the dependant and read rights on the predecessor; a cycle is refused whole. Dates are working days: weekends
and observed US federal holidays are skipped.
