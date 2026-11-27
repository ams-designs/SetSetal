---
name: next-task
description: Find the next unchecked task in SetSetal's active phase, plan it, and do it. Use when the user says "what's next", "continue the plan", "next task", or "/next-task [phase or task]".
---

# Next task

1. Read `docs/plan/README.md` to find the phase marked **Active**. If `$ARGUMENTS` names a phase or task, use that one instead.
2. Open that phase file and pick the first unchecked `- [ ]` item, unless the user chose a different one.
3. Check `docs/plan/decisions.md`. If the task depends on an open decision (D1–D5), stop. Tell the user which decision blocks it and what the options are.
4. Read the code the task touches, and confirm the `file:line` references in `docs/plan/code-review.md` still match. Line numbers drift.
5. Give a short plan of the files and the approach, then implement it. Hand off to an agent when it fits better:
   - SW, manifest, icons, routing or install → `pwa-specialist`
   - SQL, RLS or auth → `supabase-backend`
   - tests → `e2e-tester`
   - strings → `i18n-localizer`
6. Verify the change by running the relevant tests, or serve the app and check it.
7. For anything touching listings, contact, forms, admin or copy, run the `trust-safety-reviewer` agent. For UI changes, run `a11y-mobile-reviewer`.
8. Tick the checkbox in the phase file. If every task is done **and** the exit criterion is met, tell the user and offer to mark the next phase Active in `docs/plan/README.md`.
