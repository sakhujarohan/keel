---
description: End-of-session handoff — append a log entry and print a resume packet
---

Close out the current work session for the active run so the next session (you or another agent) can resume cleanly.

1. **Prepend** a dated entry to `## Session log` in `specs/<run>/STATUS.md` (newest on top):
   - **Did:** what changed this session
   - **Decisions / gotchas:** anything the next agent must know
   - **Next:** the single next step
2. Run `/status` to refresh the **Now** block.
3. **Print a resume packet** (don't just save it) — high-signal enough that the next agent can resume from it alone:
   - Goal recap (one line) + current **phase / gate**
   - **Git state:** current branch, `git -C . status -s`, `git -C . log --oneline -5`
   - The **single next step** + the exact command(s) to run / verify

Keep it lean. The point is continuity, not a transcript.
