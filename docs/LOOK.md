# Pegboard's look

The app wears the owner-approved app look (pick A, 20 Oct 2026): the **Path view** of a project. One white bar, one
heading line with one split-flap chip, a pale azure peg wall carrying the project's critical path as one tomato cord in
switchback rows, a white card hung on a black peg at every task, off-path tasks as short tassels, and the agent's tag
clipped at the top right. It deliberately breaks from the rail + table + side panel skeleton: never add a left rail,
count tiles, a central table, a right exception panel or an activity log to it.

Pegboard has no product code yet (CONTRACT.md: every clause missing), so `/app` draws this composition in its **empty
state**: the cord hangs between bare pegs and nothing is drawn as if it existed. Build every new screen from the tokens
and parts below; do not write a second copy of any of them.

## Where it lives

| File | What |
| --- | --- |
| `public/rer-theme.css` | The face (Inter, `@font-face`) and Base's `--rer-*` tokens, within Base's theme grammar (literal `:root --rer-*` and `@font-face` only; the installer reads it). |
| `public/look/tokens.css` | Every other token; names that equal a `--rer-*` value alias it, so each value is written once. |
| `public/look/parts.css` | Parts the homepage shares with the app: `.card`, `.peg`, `.dl` (a "·" line), `.flap` (split-flap tiles). |
| `public/look/controls.css` | Buttons, fields, checkboxes, avatars, the small flap chip. Each rule names the app's class and Base's element together. |
| `public/look/shell.css` | The bar, breadcrumb, tabs, person, the board and its heading band. |
| `public/look/wall.css` | The peg wall, the switchback path, task cards, tassels, the exception note, the agent's tag, the not-found card, and the phone plan. |
| `public/look/frames.css` | Base's documents (sign-in, confirmation, `/setup`, settings, hand-off, the Lobby) placed in the bar + wall + hung card. |
| `public/look/pegboard.css` | The entry every app document and Base frame links (`src/base/font-head.ts`). |
| `public/look/lobby.css` | The entry the edition identity's stylesheet reaches (the Lobby, and the run site's Base pages, which need only the theme). |
| `public/look/cords.js` | Draws cords between `[data-peg]` anchors after layout, for the homepage and the wall. |
| `public/brand/` | Mark 9 (`mark.svg` 48 px and up, `mark-32.svg`, `mark-16.svg`, dark variants, favicons) and `band.svg`, the cord floor under the Lobby and the run site's Base pages. |
| `src/ui/` | The React parts (below). `/app` renders them once on the server (`document.server.tsx`); the root route renders `NotFound`. |

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `--rer-text` #141414 | Type, pegs, diamonds. |
| `--grey`, `--grey-2` | `--rer-muted` #5A636D, #7C858F | Quiet text; placeholders. |
| `--paper`, `--pale`, `--wall` | white, `--rer-page` #EAF6FE, #BCE6FE | Cards; Base's page; the hero's wall. |
| `--wall-ground`, `--wall-dots` | azure gradient; 20 px peg-dot grid | The board and the wall behind every app and Base document. |
| `--tomato` | #F94436 | The cord, a moved task's edge, "moved", the exception, the one primary action. Nothing else. |
| `--tomato-ink` | #D8301F | Tomato text on white (AA); `src/branding.json` gives it to Base's own default buttons. |
| `--azure`, `--azure-ink`, `--azure-l` | `--rer-focus` #087BF7, `--rer-link` #0866D0, #CFE5FB | Focus rings and the active tab's rule; links and tab text; hover. |
| `--pink`, `--pink-l`, `--phase-ink` | #F86698, #FCD6E4, #8E1F4B | Phase tags only. |
| `--green`, `--green-ink`, `--done-ink` | #14CF72, #0C9A52, `--rer-done-ink` #0A7F43 | Done states only (the tick, "holds"). |
| `--flap`, `--flap-red`, `--tile-*` | #4AF489, #FB5A4C, ink tiles | Split-flap tiles: landed, moved, quiet. |
| `--edge`, `--field-hover` | `--rer-border` #8A939D, #6E7882 | 1 px field edges at 3:1; never a thick black frame. |
| `--shadow`, `--card-shadow` | soft blue-grey shadows | Homepage cards; the wall's cards and tags. |
| `--bar-h`, `--bar-line` | 70 px, #D9E7F2 | The bar's height and rule. |
| `--sans` | `--rer-font-body` (Inter) | One face: 850–900 for headings, the wordmark and card titles, 400–600 for data. |

The shell's own inks (`--breadcrumb-*`, `--tab-separator`, `--person-muted`, `--facts-ink`, `--heading-rule`), the
card's (`--task-person`, `--task-detail`, `--baseline-*`, `--ghost-*`, `--tassel-*`, `--reference-*`, `--tag-border`),
the peg's (`--peg-*`), the avatar's (`--avatar-*`) and the buttons' (`--button-*`, `--tomato-hover`) are in the same file.

## Parts (`src/ui`)

| Part | Props | Notes |
| --- | --- | --- |
| `AppBar` | `viewer?`, `crumbs?`, `tabs?`, `home?` | Mark 9 at 44 px and the wordmark (`data-rer-name`, so Dev/Demo labels show), the breadcrumb (workspace › team › project), the views as azure tabs with "·" between them, the person (initials, name, second line). A project's tabs are its views; Path is a project's home. |
| `Heading` | `title`, `chip?`, `facts` | The heavy title, its one chip, its facts as one "·" line ("57 tasks · 9 owners · critical path 12 tasks · Launch Tue Feb 16, 2027"). |
| `Flap` | `text`, `tone: moved \| landed \| quiet` | The one split-flap chip on a screen ("MOVED +1" is `moved`). |
| `Tag` | `label`, `say`, `actions`, `tells?` | The agent's tag: what it says (clauses joined by " · "), one tomato primary and quiet secondaries, who it tells. It sits in the heading band and never covers the cord or a card. |
| `PathWall` | `label`, `rows: Station[][]`, `extra?: Cord[]` | Stations in cord order, a row per switchback (the second runs right to left). `cordsFor(rows)` strings the solid cord: taut card to card at the title line, slung between bare pegs on an empty wall, one arrow per span, a soft turn at each row's end. `extra` adds dashed cords (a proposal). |
| `Station` | `id`, `card?`, `tassels?`, `wide?`, `minor?`, `off?` | A bare peg without a card; `off` hangs a proposal beside the cord, reached only by `extra` cords; anchors are `${id}-l`, `-r`, `-b` and `-peg`. |
| `TaskCard` | `id`, `title`, `done?`, `milestone?`, `owner?`, `when?`, `more?`, `warn?`, `was?`, `phase?`, `state?: critical \| ghost`, `holds?` | `critical`: the tomato edge of a task the slip moved. `ghost`: dashed (a proposal, or where a moved task was). `was`: the dashed chip at the old date. `phase`: the pink tag. `holds`: the launch card. |
| `Tassel`, `Note` | `title`, `owner?`, `when?`, `chip?`; `children` | An off-path task on a short string; the exception clipped in place (the forwarder's email). |
| `Dots`, `glue`, `tidy` | | A "·" line whose separators never start or end a line; running text with the same rule; dates, times and ranges kept whole. |
| `Tick`, `Arrow` | | Inline SVG: Inter's Latin file has no ✓ or →. |
| `appDocument` | `title`, `body` | A signed-in document rendered on the server: theme, look, Base's page style (its dropdown rule) and `cords.js`, under a strict CSP. |
| `NotFound` | | Any unknown address, in the bar and wall. |

Controls: `.button.primary` (tomato, 19 px bold: white on tomato is AA only as large text) and `.button.quiet`,
`.field`/`.input`/`.select`, `.checkbox` (24 px), `.avatar`. Every `<select>` keeps Base's chevron (two gradient strokes
14 px in, 40 px end padding, from `select-style.ts` in every app document); give it `.select`.

## The pick's screens, for the product

- **Path** (a project's home; the demo opens on it): rows from the project's real dependencies (PEG-004), the critical
  path as the solid cord, ghosts from baselines, the agent's tag from its real proposal (PEG-030). Until a person
  presses Approve, the auto-shifted position is the live card (solid, on the cord); the proposal is a dashed card beside
  the shoot with a dashed re-hooked cord, and one dashed loop, one way, from the review's old peg to its new place. After
  Approve the proposal becomes solid and the auto-shift leaves the cord. Compute "critical path N tasks" from the graph.
- **Wall** (its own tab): phase rails, working days across, card width = duration, today marked; the same cards and pegs.
- **Timeline, Workload, List, Calendar** (PEG-003, PEG-025): the same records in the same parts; no table chrome.
- At 390 px: one vertical cord with the cards in a column, tassels indented, the tag above the cord with 44 px buttons,
  the views as one row that scrolls inside itself, never a sideways page scroll, nothing under 13 px.
- Data is US: USD, US dates with weekdays that match the calendar, the business's time zone on every time shown.
- Phases: Positioning, Pricing & packaging, Content & photography, Retail sell-in, Launch PR, Support readiness.

## Base's documents

Sign-in, its notices, the confirmation, `/setup`, sign-in settings and the local hand-off keep Base's markup; the bar,
wall and hung card come from `frames.css`, their buttons and fields from `controls.css`. The Lobby keeps Base's door
on the wall, with the tomato button and the cord floor. The run site's `/run`, `/contract` and not-found pages take
only the theme and the floor.
