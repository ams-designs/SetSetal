---
name: phase0-fixes
description: Step-by-step runbook for SetSetal Phase 0 bug fixes (back stack, broken arrow icons, Android hardware back via history API, "Other / not listed" filter, hidden install button, multi-select waste types, deduplicated lists). Use when working on any Phase 0 item or when the user says "fix the prototype bugs".
---

# Phase 0 fixes

Work through them in this order. After each fix, verify it with `python3 -m http.server 8000` and tick it off in `docs/plan/phase-0-fix-prototype.md`. Confirm the line numbers first, because they drift.

## B1 + B3: navigation (do these together)
Current: `back()` in `app.js` pops twice and then `go()` pushes again.

Target design:
```js
function go(screenId, options = {}) {
  // ...validate target...
  if (screenId !== state.currentScreen && !options.back) {
    state.history.push(state.currentScreen);
    if (!options.fromPop) history.pushState({ screen: screenId }, "", "#" + screenId);
  }
  // ...toggle screens / nav, move focus to the screen heading...
}

function back() {
  if (state.history.length > 0) history.back();   // popstate does the work
  else go("home", { back: true });
}

window.addEventListener("popstate", (e) => {
  const target = e.state?.screen ?? "home";
  state.history.pop();
  go(target, { back: true, fromPop: true });
});
// in init(): history.replaceState({ screen: "home" }, "", location.hash || "#home");
```
- The profile screen needs its ID in the state so a pop restores the right collector: `{ screen: "profile", id }`.
- Keep the `data-go="home"` buttons as forward navigation. Buttons that mean "back" should use `data-back`.
- Verify: Home → Find → Profile → Back lands on Find, Back again lands on Home, and the browser back button matches both.

## B2: broken arrows
Replace `m15 18-6-6 6 6` with `m15 18-6-6 6-6` everywhere (`grep -n "6-6 6 6" index.html`).

## B4: "Other / not listed"
In `matchesFilters`, remove the `filters.area === "Other / not listed"` match. In `renderCollectors`, when the area is "Other / not listed", render an empty state: "We don't have listings for your area yet. Tell us where you are on the Help screen." Don't capture any address.

## B5: install button
- Add `<button id="install-button" class="button secondary" hidden>Install app</button>` on the home screen.
- On `beforeinstallprompt`: store the prompt and **unhide the button**. Delete the misleading toast.
- On click, call `installPWA()`. On `appinstalled`, or after the user makes a choice, hide the button again.

## G1: icons
Run `/pwa-icons`.

## G2: several waste types
Replace `<select id="provider-waste">` with:
```html
<fieldset id="provider-waste"><legend>Waste types you collect</legend>
  <label><input type="checkbox" name="waste" value="Household bags"> Household bags</label> ...
</fieldset>
```
Read the values with `new FormData(form).getAll("waste")`, require at least one, and show the error through `aria-describedby`. The preview lists every selected type.

## G3: one source for the lists
Define `AREAS`, `VEHICLES` and `WASTE_TYPES` once at the top of `app.js`. Populate the filter `<select>`s, the registration controls and the validation from them, and remove the hard-coded `<option>`s from `index.html` (keep "All areas" and "Other / not listed" as special values).

## Finish
Bump `CACHE_NAME` (see `/release`), run `/test-checklist`, and then run the `a11y-mobile-reviewer` agent.
