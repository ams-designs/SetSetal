---
name: trust-check
description: Run the SetSetal trust, privacy and honesty review (and optionally the accessibility review) on the current diff before committing or merging. Use when the user says "trust check", "review before merge", or "is this safe to ship".
---

# Trust check

1. Work out the scope. If `$ARGUMENTS` names a branch or PR, use it. Otherwise review uncommitted changes, falling back to `main...HEAD`.
2. Run the `trust-safety-reviewer` agent on that scope.
3. If any `.html` or `.css` file changed, or a screen or component changed, run the `a11y-mobile-reviewer` agent in parallel.
4. Merge the findings into one list ordered **Blocker**, then **Should fix**, then **Note**, each with `file:line`.
5. If anything is a Blocker, say plainly that this isn't ready to merge, and offer to fix the blockers.
