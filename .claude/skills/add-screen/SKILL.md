---
name: add-screen
description: Add a new screen to SetSetal consistently, covering markup, back button, navigation and route, focus handling, translations, tests and offline cache. Use when the user asks for a new page or screen.
---

# Add a screen

Argument: the screen ID and its purpose (`$ARGUMENTS`).

## Phase 0 (single `index.html`)
1. Add `<section class="screen" id="<id>" aria-labelledby="<id>-title" hidden>` next to the other screens.
2. Header: a back button with `data-back` and an `aria-label`, using the chevron `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`, then the eyebrow and an `<h1 id="<id>-title">`.
3. If it belongs to a nav tab, extend the active-tab mapping in `go()` (as `profile` maps to `find`).
4. Any dynamic content goes through `escapeHTML`, or uses `textContent`.
5. If it's a form that doesn't reach a server, it **must** say so.

## Phase 1+
Do the same, plus:
- Register a route in `src/router.ts`, such as `#/<id>` or `#/<id>/:param`, and make sure a cold deep load works.
- Put every string in `src/i18n/en.json` under `<id>.*`, with no hard-coded copy.
- Add a Playwright spec that opens the screen by route, checks the heading and Back, and runs axe.

## Always
- Move focus to the screen `<h1>` on entry, and keep touch targets at least 48 px.
- Run the `a11y-mobile-reviewer` agent. Run `trust-safety-reviewer` as well if the screen shows listings or contact details, or collects input.
