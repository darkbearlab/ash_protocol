# ASH PROTOCOL

Mobile-browser tactical shooter; screen-aligned cardinal movement. Assets must work under `/ash_protocol/`.

## Context on demand
- `docs/HANDOFF.md`: architecture, module map, save ownership. `docs/DESIGN.md`: feature-spec index. `docs/CORE_RULES.md`: shared rules. Read relevant sections; reuse unchanged context instead of rereading whole documents.
- `給Claude的交接.md`: Claude's balance/economy/menu authority and gameplay/save boundaries; ally-iteration exceptions remain valid. QA-only restrictions apply only to QA assignments.
- Reports: `qa/results/` and `.claude/worktrees/*/qa/results/`; external handoffs may be in their `docs/HANDOFF.md`. Other agents' worktrees are read-only. Distinguish reported checks from your own.
- Wishlist for planning; CHANGELOG/archive for relevant historical questions. Neither authorizes unrelated work.

## Delivery
- Preserve saves. Browser QA uses `?test=1`; format changes require migration and integrity checks. Human visual QA goes to the user/Claude with reproducible steps.
- Validate according to change risk; reuse passing checks until edits, failures or unresolved concerns justify reruns. Disposable-fixture tests and in-scope fixes need no repeated permission.
- Follow `docs/RELEASE.md` to finish authorized work: validation, necessary documentation, main push and successful game deployment. Pure documentation uses its lightweight path. Remote: `https://github.com/darkbearlab/ash_protocol`; never force-push main.
- Game versions: `npm run bump -- x.y.z`. Update affected specs, CHANGELOG, report and verification note; HANDOFF only for changed architecture/save/process/current-state facts.
- Keep skills relevant and tool output bounded; batch independent reads. Budget substantial work for validation and delivery.
- Gameplay correctness precedes optional art. Preserve raster source prompts and deterministic pixel/palette processing.
