---
description: Start-of-session resume — re-orient from STATUS.md + git, confirm the next step
---

Resume the active run.

1. Read `specs/<run>/STATUS.md` — the **Now** block and the most recent **Session log** entry.
2. Read git state: current branch, `git -C . status -s`, `git -C . log --oneline -5`.
3. **Re-orient:** restate the goal, the current phase / gate, and what changed last session.
4. **Confirm the single next action** with the human before proceeding — and respect the gate you're at (don't cross a gate that isn't signed off).

Load only the artifacts you need for the next step; keep context lean (smallest high-signal set).
