# ClawBox Claw Machine — GitHub Profile Game

**Date:** 2026-06-08
**Repo:** `KrasimirKralev/KrasimirKralev` (profile README)
**Status:** Design approved, pending spec review

## Summary

A self-playing animated SVG for the GitHub profile README: an overhead arcade
claw, mounted on a gantry rail above the contribution grid, sweeps across and
harvests the user's lit commit cells into a hopper — tally ticking up — then
dumps the day's haul down a chute. The cabinet, rail, and claw are styled as a
**ClawBox** machine (the user's robotics product, mascot 🦀). The SVG is
regenerated daily from real contribution data by a GitHub Action.

It is the contribution-snake idea, reimagined: same medium (a daily,
data-driven, self-animating SVG embedded in a profile README), entirely
different and on-brand mechanic.

## Goals

- A visually unique, recognizably on-brand profile centerpiece that nobody else
  can copy (the ClawBox metaphor is the unfair advantage).
- Genuinely data-driven: the animation reflects the user's real contribution
  graph and refreshes daily, hands-off.
- Renders and animates correctly when embedded in a GitHub README (survives the
  camo image proxy), in both dark and light themes.

## Non-Goals (YAGNI)

- **No interactivity.** GitHub sanitizes embedded content: no JavaScript runs and
  images are camo-proxied. The "game" plays itself; it is not playable.
- **No richer data world.** Scope is the contribution grid only — no repos,
  languages, stars, or stats stations. (Explicitly chosen during brainstorming.)
- No multi-platform support (GitLab/Forgejo). GitHub only.

## Key Constraints

1. **Camo-safe SVG only.** Motion must be CSS `@keyframes` in an embedded
   `<style>` block — the technique `Platane/snk` uses, proven to animate through
   camo. No `<script>`, no external resource references.
2. **Bounded runtime.** A claw that carries each cell individually to the chute is
   O(n) round-trips and would run for minutes on a busy graph. The mechanic must
   complete in **one bounded sweep** (see Mechanic below): total loop ≤ ~18s,
   independent of lit-cell count.
3. **Size budget.** Each SVG ≤ ~150 KB; loops seamlessly.

## The Mechanic (bounded sweep)

The trolley (claw + onboard hopper) rides the top rail and performs a single
left-to-right pass:

1. Trolley slides along the rail in X to the next column containing lit cells.
2. Claw **dips** once (translateY down), **pinches** (claw-half rotation closes),
   and **all lit cells in that column fly up** together into the onboard hopper
   (translate + fade). The day's tally counter ticks up by that column's count.
   One dip per populated column — never per cell — which is what keeps the sweep
   bounded by column count (≤ 53), not cell count.
3. Claw retracts; trolley advances to the next populated column.
4. After the final column, the trolley returns to the chute at the corner and
   **dumps** the haul (counter flush / cells cascade down the chute).
5. Brief hold, then the loop restarts.

Per-cell timing = `sweepBudget / litColumnCount`, clamped to a readable minimum.
Emergent property: busy weeks play fast and frantic, quiet weeks slow and
deliberate — honest to the data without ever dragging.

**Empty/sparse handling:** zero lit cells → the claw idles with a blinking
`SCANNING…` state instead of an empty, broken-looking sweep. (The account is
young, so sparse weeks are expected.)

## Visual Identity

- **Cells:** keep GitHub-green contribution levels (level 0–4), so it reads
  unmistakably as the user's real contribution graph.
- **Machine:** claw, rail, trolley, cabinet frame, and chute in ClawBox accent
  tones (brand orange/red).
- **Two variants:** `claw-dark.svg` (GitHub dark bg `#0d1117`) and
  `claw-light.svg`, embedded via `<picture>` with `prefers-color-scheme`.

## Architecture

Everything lives in the profile repo; build artifacts go to a dedicated branch.

```
KrasimirKralev/KrasimirKralev
├── README.md                      # embeds the SVG via <picture>
├── package.json                   # TS generator, npm scripts
├── src/
│   ├── fetch-contributions.ts     # GitHub GraphQL → ContributionGrid model
│   ├── plan-sweep.ts              # ContributionGrid → SweepPlan (deterministic)
│   ├── render-svg.ts             # SweepPlan + palette → animated SVG string
│   └── index.ts                  # CLI: fetch → plan → render → write files
├── test/
│   ├── plan-sweep.test.ts        # planner unit tests
│   └── render-svg.test.ts        # SVG snapshot + camo-safety assertions
└── .github/workflows/claw.yml    # daily cron → run generator → commit to output

output branch (artifacts only): claw-dark.svg, claw-light.svg
```

The claw mechanic does not map onto `snk`'s snake path-solver, so the generator
is **bespoke**. Only the proven *pattern* is reused: GraphQL fetch → output
branch → `<picture>` embed.

### Components & interfaces

- **`fetch-contributions.ts`** — *What:* fetch the contribution calendar via
  GitHub GraphQL (`user.contributionsCollection.contributionCalendar`).
  *Out:* `ContributionGrid` = `{ weeks: Day[][] }`, `Day = { date, count, level }`.
  *Depends on:* a GitHub token (workflow `GITHUB_TOKEN`; PAT secret fallback).
- **`plan-sweep.ts`** — *What:* turn a grid into a deterministic, ordered
  `SweepPlan` (which columns, which cells, in what order, with computed
  per-step timings). Pure function, no I/O. *Out:* `SweepPlan`.
- **`render-svg.ts`** — *What:* turn a `SweepPlan` + a `Palette` into a complete
  SVG string with embedded CSS `@keyframes`. Pure function, no I/O.
  *Out:* `string` (one SVG). Called once per palette.
- **`index.ts`** — orchestrates: fetch → plan → render(dark) + render(light) →
  write two files.

Each unit is independently testable: the planner and renderer are pure functions
that never touch the network or filesystem.

## Data Flow

1. Action triggers (daily cron / manual / push to generator files).
2. `fetch-contributions` → `ContributionGrid` (token from env).
3. `plan-sweep(grid)` → `SweepPlan`.
4. `render-svg(plan, darkPalette)` and `render-svg(plan, lightPalette)`.
5. Write `claw-dark.svg`, `claw-light.svg`.
6. Action commits the two files to the `output` branch (only if changed).
7. README references them on `output` via raw URL inside `<picture>`.

## Error Handling

- **Token / fetch failure:** retry once; on hard failure, exit non-zero so the
  Action surfaces it — do **not** commit a broken/blank SVG over a good one.
- **Empty grid:** render the valid `SCANNING…` idle state (not an error).
- **Output unchanged:** skip the commit (avoid empty daily commits).
- All errors logged with context for the Action run log.

## Testing & Validation

- **Unit:** `plan-sweep` — fixed grids in, expected plans out (ordering, timing,
  empty-grid → idle plan).
- **Snapshot:** `render-svg` — deterministic SVG output for a fixed sample grid.
- **Camo-safety lint:** assert output contains no `<script>`, no external
  `href`/`url(...)` to remote resources, only whitelisted SVG/CSS.
- **Visual evidence (Playwright):** load each SVG headless, screenshot
  mid-animation, confirm it moves, fits the viewport, and loops.
- **De-risking spike (do first):** before building the generator, hand-write a
  ~20-line animated SVG, push to a throwaway branch, and view it in a real
  rendered README to confirm CSS-through-camo animates. Validates the riskiest
  assumption cheaply.

## Build & Deploy

- **Workflow `claw.yml`:** `schedule` (daily cron) + `workflow_dispatch` + `push`
  on generator-file changes. Steps: checkout → setup Node → `npm ci` →
  `npm run build:svg` → commit changed SVGs to `output` (e.g. via
  `stefanzweifel/git-auto-commit-action` targeting the `output` branch, or a
  scripted checkout of `output`).
- **Token:** built-in `GITHUB_TOKEN` first; add a `CONTRIB_TOKEN` PAT secret only
  if the calendar query needs it.
- **README embed:**
  ```html
  <picture>
    <source media="(prefers-color-scheme: dark)"
            srcset="https://raw.githubusercontent.com/KrasimirKralev/KrasimirKralev/output/claw-dark.svg" />
    <img alt="ClawBox claw machine harvesting my contributions"
         src="https://raw.githubusercontent.com/KrasimirKralev/KrasimirKralev/output/claw-light.svg" />
  </picture>
  ```

## Risks & Open Questions

- **CSS-through-camo** (mitigated by the spike above and by `snk` precedent).
- **Loop seamlessness** at high cell counts — tune `sweepBudget` and per-step
  clamp during render development.
- **GraphQL token scope** for reading the public calendar — confirm
  `GITHUB_TOKEN` suffices in the Action context; PAT fallback ready.

## Success Criteria

- SVG embeds in the README and visibly animates in both dark and light themes.
- Action runs daily unattended and updates the graph from real data.
- Loop ≤ 18s, file ≤ ~150 KB, no broken/empty commits.
- Reads unmistakably as the user's contribution graph, branded as ClawBox.
