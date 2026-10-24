# Phase 0: Fix the prototype (~1 week)

**Goal:** a bug-free prototype that installs properly on Android. No new architecture.
**Runbook:** `/phase0-fixes`. **Agents:** `pwa-specialist`, then a review by `a11y-mobile-reviewer`.

## Tasks

- [ ] **B1 Back stack:** fix `back()` (`app.js:175`) so it pops once and doesn't re-push.
- [ ] **B2 Arrow icons:** change the path to `m15 18-6-6 6-6` at `index.html:212, 224, 253`.
- [ ] **B3 Hardware back:** `go()` calls `history.pushState({screen}, "", "#"+screen)`, a `popstate` handler calls `go(e.state?.screen ?? "home", {back:true, fromPop:true})`, and the first load uses `replaceState`. `back()` should then call `history.back()`.
- [ ] **B4 "Other / not listed":** stop matching every area. Show an empty state that says "We don't have listings for your area yet" and points to Help.
- [ ] **B5 Install button:** add a hidden "Install app" button (on home, or in the topbar). Show it on `beforeinstallprompt`, hide it on `appinstalled`, and wire it to `installPWA()`. Remove the misleading toast.
- [ ] **G1 Icons:** add `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png` (with a safe zone of about 20% padding) and `icons/apple-touch-icon.png` (180 px). Update `manifest.json` and `index.html`, and add the new files to the `APP_SHELL` list in `sw.js`. Use `/pwa-icons`.
- [ ] **G2 Multiple waste types:** change `#provider-waste` to a checkbox fieldset. Validate that at least one is ticked, and render the selection as a list in the preview.
- [ ] **G3 (light):** generate the area, vehicle and waste `<option>`s and checkboxes from one set of constants in `app.js` instead of hard-coding them in HTML.
- [ ] Bump `CACHE_NAME` in `sw.js` (use `/release`).

## Exit criterion

Every item in the README's test checklist passes on a **real low-end Android phone** over HTTPS. That includes the hardware back button returning one screen at a time and the app installing from the in-app button. Run `/test-checklist`.
