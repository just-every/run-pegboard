# Pegboard

Work and project management for business teams.

100% free, open source alternative to Asana, monday.com work management, ClickUp, Wrike.

Pegboard implements the work graph, scoped access, reusable projects, scheduling
and history-preserving conversions on the Base foundation.
[CONTRACT.md](CONTRACT.md) records the current evidence and remaining gaps for
each clause. A fresh installation contains no sample projects.

## Run locally

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-pegboard
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later?
`npx -y @runeditrun/rer dev just-every/run-pegboard` does the same. rer gets
Pegboard into `run-pegboard`, installs its locked dependencies, claims a local
owner and prints a link that opens it signed in. If the installer prints a line
that puts `rer` on your PATH, run that line too. To start it again later, run the
same line from the same folder, or `cd run-pegboard && rer dev`.

The installed `/` is Base's Lobby. The signed-in owner's first-run form is at
`/setup`. Development mail is silently suppressed. Stop a foreground launch
with Ctrl-C before building or testing. For a real owner installation, use
`rer install`, then `rer setup` and enter the real mailbox at the prompt.

## Run site and contract

The public Run site is [run-pegboard.com](https://run-pegboard.com).
[Run Pegboard](https://run-pegboard.com/run) explains installation.
`rer build --site` writes the homepage, `/run`, `/contract` and 404 page from
`src/site/pages.ts`. `/contract` renders the root CONTRACT.md through Base's
parser; its status distinguishes targets from shipped work. Run site deployment
uses the guarded `.github/workflows/run-site.yml` independently of Verify.

## Development

This checkout pins the published `@runeditrun/rer` package at 0.2.79, Node
22.20.0 and pnpm 10.12.4. Run `rer check`, `pnpm run build`,
`pnpm run typecheck` and `pnpm run test:runtime`.
The verification workflow runs the product API tests and browser journeys as
well as the foundation checks. Base source and copy custody are recorded
in edition.json, sources.lock.json and base-copies.json.

Read [AGENTS.md](AGENTS.md), [RUN-LOCALLY.md](RUN-LOCALLY.md),
[OPERATIONS.md](OPERATIONS.md) and [ACCEPTANCE.md](ACCEPTANCE.md).
Installation archives use `rer export --output exports/installation.rer` and
`rer import --input exports/installation.rer --yes`; restore requires an empty
destination and is separate from a product move-in screen. No product import
screen exists yet. Real deployment requires the owner's Cloudflare account and
configured mail. Local checks do not establish provider delivery.

[MIT license](LICENSE).
