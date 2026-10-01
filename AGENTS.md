# ASH PROTOCOL

Mobile-browser tactical shooter; screen-aligned cardinal movement. Assets must work under `/ash_protocol/`. Claude maintains the project (rules, balance, UI, docs, releases) on the user's decisions; Codex only takes asset or audio briefs.

## Context on demand
- `docs/HANDOFF.md`: current state, module map, saves, commands. `docs/DESIGN.md`: spec index. `docs/CORE_RULES.md`: shared rules. Read the sections you need.
- `docs/CHECKLIST.md`: the tools and the checks to run before handing off — read it before adding enemy specials, telegraphs or saved state.
- `使用者願望清單.txt` for planning; `docs/CHANGELOG.md` and `docs/archive/` for history. Neither authorizes unrelated work.
- Other agents' worktrees are read-only. Report which checks you ran yourself.

## Invariants
- Preserve the profile (unlocks, points, stories, settings, backups): browser QA uses `?test=1` (`qa-` keys); never clear storage or reset a player. Unfinished runs are disposable while the game iterates fast (user, 2026-10-01): a format or rule change may drop runs saved by older versions instead of migrating them — dropping means the run is treated as abandoned (settled like 放棄任務, `abandonRun`), with a notice and the raw save kept in a backup key; migrate only when it is cheap. Don't raise in-progress-run compatibility as a concern. Load checks refuse only broken data; stale telegraphs are dropped and tuning-bound values clamped. Saved IDs (weapon slots, classes, items, missions) only append.
- Rewards are earned once (runId ledger); purchases validate before charging; profile fields survive normalize, validation and backup round trips.
- Behaviour-neutral refactors keep `node qa/enemy-data-identity.mjs` identical. Rule changes prove where each difference comes from (disable the feature → identical), then `--accept` only those entries.
- Phone: portrait, four directions, no long-press selection; the battlefield never gets pushed by UI. The UI reads presentation state and never leaks results early.
- Every player-facing sentence goes through `t()` with Chinese and English (`qa/english-scan.mjs`).
- Keep asset URLs relative (`/ash_protocol/`) and list new files in `sw.js`. Generated art keeps its prompt and deterministic pixel/palette processing in `art/`.

## Delivery
- Iterate with `npm run test:quick`; before handing off run what `docs/CHECKLIST.md` asks (full `npm test`, save fuzz, identity, build).
- Game versions: `npm run bump -- x.y.z`. Write the CHANGELOG entry (its last line: what to playtest) and a slim report in `qa/results/`; update affected specs, and HANDOFF only when architecture, saves or commands change.
- Push to `https://github.com/darkbearlab/ash_protocol` main as a fast-forward (never force-push), confirm the Pages run for that SHA succeeds (`python tools/github-release.py status`). Push only when the user has asked for it.
- Gameplay correctness precedes optional art.
