---
name: twa-release
description: Package SetSetal for Google Play as a Trusted Web Activity with Bubblewrap, including assetlinks.json, signing, store listing and the testing tracks. Use in Phase 4 or when the user asks about publishing to the Play Store.
disable-model-invocation: true
---

# TWA release (Phase 4)

## Before you start
- The production site is on HTTPS, Lighthouse rates the PWA installable, and the manifest has PNG and maskable icons.
- Decision D4 (data owner) is answered, and the privacy policy URL is live.
- A JDK 17 and the Android SDK are present. Bubblewrap can install them itself.

## Steps
1. `npx @bubblewrap/cli init --manifest https://<domain>/manifest.webmanifest` in a separate `android/` directory. Use the package ID `org.setsetal.app` (or the owner's choice), and keep the theme and background colours from the manifest.
2. Create the signing key with `bubblewrap build`. Store the keystore and its passwords **outside the repo**, and add `android/*.keystore` to `.gitignore`.
3. Enrol in Play App Signing, then copy the **app signing key** SHA-256 from the Play Console. That's the Play key, not only the upload key.
4. Serve `/.well-known/assetlinks.json` from the site:
```json
[{ "relation": ["delegate_permission/common.handle_all_urls"],
   "target": { "namespace": "android_app", "package_name": "org.setsetal.app",
               "sha256_cert_fingerprints": ["<PLAY_SIGNING_SHA256>", "<UPLOAD_SHA256>"] } }]
```
   Check it with `curl -s https://<domain>/.well-known/assetlinks.json` and Google's Digital Asset Links tester.
5. Upload the `.aab` to the **internal testing** track and install it on a phone. Confirm there's **no URL bar**; a URL bar means the assetlinks setup is wrong. Check that hardware back moves between screens.
6. Store listing:
   - [ ] phone screenshots
   - [ ] a 1024×500 feature graphic
   - [ ] short and full descriptions (honest, with no "verified" claims the app can't back up)
   - [ ] a data-safety form that matches what is actually collected: phone for collectors, no resident PII
   - [ ] the privacy policy link
7. Move to closed testing, then production.
8. Confirm a web-only deploy reaches the installed app without a new store build.

Tick off the items in `docs/plan/phase-4-play-store.md`.
