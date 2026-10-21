# Working on Pegboard

## Launch for review

When asked to launch, run or review the app, run `rer dev` from the checkout root
and nothing else. It installs and sets up a fresh checkout itself. Allow at least
ten minutes; if the shell call times out, repeat `rer dev` to resume. Never run
install, setup, reset or deploy for review, and never ask for an email, port,
password or answers file. Give the owner RER_READY and RER_OPEN; the latter is a
credential for that chat alone. Stop a foreground launch with Ctrl-C.
Without rer, use `npx -y @runeditrun/rer cli install` or the installer at
https://runeditrun.com/install.sh.

## Foundation and target

Read CONTRACT.md, ACCEPTANCE.md, OPERATIONS.md and RUN-LOCALLY.md before changing
behavior. Pegboard started as a technical foundation; CONTRACT.md's Status table
says which product clauses have code and tests, and a contract line is not
evidence that a feature exists. Do not add mock
application data, fake providers, placeholder product screens or fallback
behavior. The app wears the owner-approved look (app pick A, the Path view): build
every screen from the tokens and parts named in docs/LOOK.md, and keep
public/rer-theme.css within Base's theme grammar (the installer reads it).

Use the exact published @runeditrun/rer 0.2.75 pin. Public commands use bare rer
verbs; do not restore a vendored CLI. Base runtime copies and their origins live
in edition.json, sources.lock.json and base-copies.json. Keep recorded copies
verbatim and preserve migrations already applied by an owner. Refresh source
custody only after inspecting intentional edits.

For a real owner installation, run `rer install`, `rer setup` and `rer dev` from
this checkout. Enter the real owner mailbox in setup's prompt. Local dev opens
a real native owner session and suppresses external mail; complete first-run
setup at /setup. Keep private settings, sign-in links and archives out of logs
and source. Reset is destructive; `rer reset --yes` is never a routine repair.

The installed root is the shared Lobby. The static Run site is built with
`rer build --site` from src/site/pages.ts, with /contract from root CONTRACT.md.
Its deployment workflow is independent of Verify and gated by RUN_SITE_DEPLOY.
Run `rer describe` for supported operations. Local archive restore requires an
empty destination; no product move-in screen has been implemented.

Keep private handlers and direct server functions authorized with native sessions;
route guards alone are insufficient. Keep server-only code out of client bundles.
Unknown routes must remain real 404s. Do not claim hosted, provider or product
acceptance from a local structural check.

Run tests for touched public flows and typecheck. Keep the inherited foundation
tests intact. CI is the full verification wall. Stop only processes you started;
never use broad kill commands or stop another checkout. Do not print secrets.
