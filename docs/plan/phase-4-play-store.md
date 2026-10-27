# Phase 4: Google Play release (~1–2 weeks, including review)

**Goal:** SetSetal is on the Play Store, and updates to the website still reach users without a new store release.
**Runbook:** `/twa-release`. **Agent:** `pwa-specialist`.

## Tasks

- [ ] Generate the Android wrapper with Bubblewrap (`npx @bubblewrap/cli init --manifest https://<domain>/manifest.webmanifest`).
- [ ] Host `/.well-known/assetlinks.json` with the signing-key SHA-256 fingerprint (from Play App Signing) so the app opens without a browser bar.
- [ ] Open a Google Play developer account (a one-time US$25 fee), with the owner from D4.
- [ ] Prepare the store listing: phone screenshots, a feature graphic, a short and long description, the data-safety form (matching what is actually collected) and a link to the privacy policy.
- [ ] Release through the tracks in order: internal testing, then closed testing, then production.

## Exit criterion

The app is live on Play and opens full-screen with no URL bar, and a web deploy shows up in the installed app without a store update.
