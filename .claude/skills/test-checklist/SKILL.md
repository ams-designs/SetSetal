---
name: test-checklist
description: Run SetSetal's README test checklist, automated with Playwright where possible and manual steps listed for a real Android phone. Use before sharing a build, at the end of a phase, or when the user says "test it".
---

# Test checklist

1. If `tests/e2e/` exists, run `npx playwright test --project=mobile` and report the results. If it doesn't exist and Phase 1 hasn't started, run the `e2e-tester` agent to set it up, or test manually by serving with `python3 -m http.server 8000`.
2. Map the results onto the README checklist and report each item as pass, fail or manual:
   - [ ] The welcome and role buttons open the right screens.
   - [ ] Filters work by area, vehicle and waste type. "Other / not listed" shows the empty state.
   - [ ] Selecting a listing opens its details.
   - [ ] Registration validation catches missing or malformed input.
   - [ ] The registration preview says it has not been published.
   - [ ] Feedback says it isn't sent to a server (or, in Phase 2+, that it was sent or queued).
   - [ ] It works with touch and keyboard.
   - [ ] It is readable at increased font size.
   - [ ] The narrow layout (320 px) works.
   - [ ] There are no console errors.
   - [ ] Offline was tested separately.
   - [ ] Sample listings are never shown as real or verified.
   - [ ] **Back:** in-app and hardware back return one screen at a time.
   - [ ] **Install:** the in-app button installs, and the installed app launches standalone.
3. Manual steps on a real low-end Android phone. These are needed for the Phase 0 exit criterion and can't be automated here: install over HTTPS, use the hardware back button, run in airplane mode after the first load, and use a slow 3G connection.
4. Summarise what failed, with steps to reproduce.
