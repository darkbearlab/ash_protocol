# Project instructions
- Current developer handoff: read `給Claude的交接.md`. Claude is authorized for balance values, global economy and menus; the older QA-only restriction applies only to QA assignments. Preserve the documented gameplay-rule and save-integrity boundaries.

- Product: a mobile-browser, turn-based tactical shooter. Movement is screen-aligned up/down/left/right; never revert to diagonal/isometric controls.
- Read `docs/HANDOFF.md` before substantial changes. Keep it, design notes and the changelog current.
- External AI verification may live in isolated worktrees. Also search `.claude/worktrees/*/docs/HANDOFF.md` and `.claude/worktrees/*/qa/results/` before concluding a handoff is missing. Read those reports without modifying the other agent's worktree; distinguish reported checks from checks run yourself.
- The user requires every completed update to be published to `https://github.com/darkbearlab/ash_protocol` and integrated into **main**. Commit and push tested work to main (or merge a working branch into main), then verify the GitHub Pages deployment. Do not leave a finished change only on a feature branch. Never force-push main.
- Preserve user saves. Browser QA uses `?test=1`; do not reset the real campaign.
- Run relevant tests and `npm run build` before publishing. Keep client assets relative-path compatible with GitHub project Pages (`/ash_protocol/`).
- User budgets work within a Plus five-hour window. Check usage during substantial work; leave capacity for tests, documentation, commit, push and deployment verification.
- Gameplay correctness takes priority over optional art. When producing raster art, retain source prompts and the deterministic low-resolution/palette-processing pipeline.
