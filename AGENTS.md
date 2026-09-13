# ASH PROTOCOL

Mobile-browser, turn-based tactical shooter. Movement is screen-aligned up/down/left/right. Keep assets compatible with GitHub project Pages (`/ash_protocol/`).

## Read only what the task needs
- Use `docs/HANDOFF.md` for module boundaries, save ownership and current state; `docs/DESIGN.md` to locate a feature spec; `docs/CORE_RULES.md` for shared rules. Read relevant sections, not the entire documentation set before small edits. Reuse already-read context unless it changed.
- For delegation or scope questions, use `給Claude的交接.md`: Claude owns balance, economy and menus; gameplay/save boundaries and the explicit ally-iteration exceptions remain in force. A QA-only assignment does not prohibit authorized development.
- For requested QA reports, check `qa/results/` and `.claude/worktrees/*/qa/results/` (handoffs may also be in their `docs/HANDOFF.md`). Read other worktrees without editing them. Distinguish external reports from checks you ran.
- Consult the wishlist for planning, not as authorization to implement unrelated items. Historical decisions are in CHANGELOG/archive; load them only to resolve a relevant question.

## Complete the authorized work
- Preserve user saves; browser QA uses `?test=1`. Save-format changes need migration and focused integrity checks.
- Choose validation for the change. Reuse passing results for unchanged code; rerun when edits or failures warrant it. Local disposable-fixture tests and fixes within scope do not need repeated approval. Human/browser visual QA goes to the user or Claude with reproducible steps.
- Use `docs/RELEASE.md` when shipping. Finish code updates with appropriate tests/build, documentation, main push and successful Pages deployment. Remote: `https://github.com/darkbearlab/ash_protocol`; never force-push main. Documentation-only delivery follows RELEASE's lightweight path.
- Use `npm run bump -- x.y.z` for game releases. Update CHANGELOG, the affected spec/report and latest verification note; HANDOFF changes only for architecture, save/process changes or stale current-state facts.
- Keep skills narrowly relevant, tool outputs bounded and independent reads batched. Preserve capacity for validation and delivery; check usage during substantial work.
- Gameplay correctness precedes optional art. Raster assets retain source prompts and deterministic low-resolution/palette processing.
