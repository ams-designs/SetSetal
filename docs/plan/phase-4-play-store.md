# Phase 4: Google Play release (~1–2 weeks, including review)

**Goal:** SetSetal is on the Play Store, and updates to the website still reach users without a new store release.
**Runbook:** `/twa-release`. **Agent:** `pwa-specialist`.

## Tasks

- [ ] Generate the Android wrapper with Bubblewrap (`npx @bubblewrap/cli init --manifest https://<domain>/manifest.webmanifest`).
  - [x] Configuration written by hand so no questions need answering: [../../android/twa-manifest.json](../../android/twa-manifest.json), with build steps in [../../android/README.md](../../android/README.md).
  - [ ] Build it (`bubblewrap update && bubblewrap build`). Not done: it needs production on the current code, the final package name (Q8) and a signing key the owner keeps.
- [ ] Host `/.well-known/assetlinks.json` with the signing-key SHA-256 fingerprint (from Play App Signing) so the app opens without a browser bar.
  - [x] The file is served (as `[]`, with the right content type) and the format is in `android/README.md`.
  - [ ] Add the two fingerprints once the key and the Play listing exist.
- [ ] Open a Google Play developer account (a one-time US$25 fee), with the owner from D4.
- [ ] Prepare the store listing: phone screenshots, a feature graphic, a short and long description, the data-safety form (matching what is actually collected) and a link to the privacy policy.
  - [x] Text, data-safety answers and declarations: [../play-store/listing.md](../play-store/listing.md). Feature graphic and six 1080 × 1920 screenshots in `docs/play-store/`. The privacy policy is the app's `#/privacy` screen.
  - [ ] Retake the screenshots with real listings before submitting: the current ones show invented collectors.
- [ ] Release through the tracks in order: internal testing, then closed testing, then production.

## Exit criterion

The app is live on Play and opens full-screen with no URL bar, and a web deploy shows up in the installed app without a store update.
