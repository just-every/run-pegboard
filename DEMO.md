# Pegboard demo

`rer demo` opens a fresh, signed-in Pegboard Demo at `/app`, past first-run setup.
Pegboard is currently a Base foundation. The demo shows its real signed-in home,
the Path view's empty state; there are no projects, tasks, workspace tables or
product sample records yet.
`src/demo.ts` idempotently completes the existing owner's first-run record and,
since the demo skips setup, names the owner Wes Holloway (the app pick's person)
in place of Base's default "Owner".

Base's demo wrapper supplies the title and brand suffix, with no top bar or outbox.
Invitations succeed with mail silently suppressed. Public reads run normally;
effects that reach people or third parties return demo success without sending.
These guards apply only to demos, never an owner production installation.

Local data lives under `.rer/demo/` and is erased on stop, separate from the
owner's `.wrangler/state`. Each hosted visitor gets an isolated native Worker
with SQLite storage, erased after 60 minutes or 15 idle minutes.

`rer deploy --demo` hosts https://demo.run-pegboard.com/ with Turnstile and
one-click owner sign-in. `.github/workflows/run-demo.yml` also supports the
separate measurement-token-gated test host and removal. See Base's
[demo adoption guide](https://github.com/runeditrun/base/blob/rer-v0.2.75/default-seed/DEMO.md).
