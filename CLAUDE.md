# ASH PROTOCOL

Mobile-browser tactical shooter; screen-aligned cardinal movement. Assets must work under `/ash_protocol/`. Since 2026-11-16 Claude Code is the only agent on this project: Claude maintains rules, balance, UI, art and audio integration, docs and releases on the user's decisions. Before that Codex took asset and audio briefs, so older specs and changelog entries still name it.

## Context on demand
- `docs/HANDOFF.md`: current state, module map, saves, commands. `docs/DESIGN.md`: spec index. `docs/CORE_RULES.md`: shared rules. Read the sections you need.
- `docs/CHECKLIST.md`: which checks to run when (§1), and the rules for enemy specials, telegraphs and saved state (§2–3) — read those before touching them.
- `使用者願望清單.txt` for planning; `docs/CHANGELOG.md` and `docs/archive/` for history. Neither authorizes unrelated work.
- Asset specs (`docs/*_BRIEF.md`, `docs/*_HANDOFF.md`, `docs/AUDIO.md`, `docs/PIXEL_ART.md`) were written for Codex deliveries; their formats still hold whoever makes the art.

## Invariants
- Preserve the profile (unlocks, points, stories, settings, backups): browser QA uses `?test=1` (`qa-` keys); never clear storage or reset a player. Unfinished runs are disposable while the game iterates fast (user, 2026-10-01): a format or rule change may drop runs saved by older versions instead of migrating them — dropping means the run is treated as abandoned (settled like 放棄任務, `abandonRun`), with a notice and the raw save kept in a backup key — raise `RUN_SAVE_FLOOR` (`src/data.js`, handled by `src/stale-runs.js`, CHECKLIST §3) to the new `SAVE_VERSION`; migrate only when it is cheap. Don't raise in-progress-run compatibility as a concern. Load checks refuse only broken data; stale telegraphs are dropped and tuning-bound values clamped. Saved IDs (weapon slots, classes, items, missions) only append.
- Rewards are earned once (runId ledger); purchases validate before charging; profile fields survive normalize, validation and backup round trips.
- Phone: portrait, four directions, no long-press selection; the battlefield never gets pushed by UI. The UI reads presentation state and never leaks results early.
- Every player-facing sentence goes through `t()` with Chinese and English.
- Keep asset URLs relative (`/ash_protocol/`) and list new files in `sw.js`. Generated art keeps its prompt and deterministic pixel/palette processing in `art/`.
- The branch `claude/variant-notes` is private: never push it.

## Checks (user, 2026-11-16: lighter than before)
- While working and before each commit: `npm run test:quick` (about 1.5 minutes), or only the test files the change touches.
- The full suite runs in CI on every push to main, and a failure blocks the Pages deploy. When it fails, fix it and push again.
- Look at visible changes in the browser with `?test=1`.
- The heavier tools (save fuzz, identity baseline, special matrix, render snapshots, English scan, build) are optional: reach for one when a change is risky in its area (CHECKLIST §1).
- No per-version reports in `qa/results/` and no independent review agents unless the user asks.

## Delivery
- Game versions: `npm run bump -- x.y.z`. The CHANGELOG entry says briefly what changed; its last line is 試玩重點 (what to playtest). Update the affected specs; HANDOFF only when architecture, saves or commands change.
- Commit when a piece of work is done. Push to `https://github.com/darkbearlab/ash_protocol` main as a fast-forward (never force-push), only when the user asks, then check that the Pages run for that SHA succeeds (`python tools/github-release.py status`).
- Gameplay correctness precedes optional art.
