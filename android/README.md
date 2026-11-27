# Android wrapper (Phase 4)

SetSetal goes on Google Play as a Trusted Web Activity: a thin Android app that opens the website full-screen. Updating the website updates the app, with no new store release.

`twa-manifest.json` is the Bubblewrap configuration, ready to build from. Nothing else in this folder is committed: Bubblewrap generates the Android project from it.

## Before you build

1. Production (https://setsetal.netlify.app) must be running the current code, so merge `adlai_changes` into `main` first.
2. Decide the package name. It is `org.setsetal.app` here and **can never be changed** once the app is published. If the owner wants another, change `packageId` now.
3. If the site moves to its own domain, change `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl` and `fullScopeUrl`, and reprint the posters.

## Build

```bash
cd android
npx @bubblewrap/cli update    # generates the Android project from twa-manifest.json
npx @bubblewrap/cli build     # offers to install JDK 17 and the Android SDK, then asks for the key
```

The first build creates the signing key at `../../setsetal-keys/setsetal-upload.keystore`, outside the repository. **Back up that file and its passwords.** `.gitignore` refuses `*.keystore`, `*.jks`, `*.apk` and `*.aab` in case one lands here by mistake.

The build writes `app-release-bundle.aab` (for Play) and `app-release-signed.apk` (to try on a phone with `adb install`).

## Link the app to the website

Without this the app shows a browser address bar.

1. `npx @bubblewrap/cli fingerprint list` prints the upload key's SHA-256. After the first upload, Play Console → Setup → App signing shows the **app signing key** SHA-256. Both are needed.
2. Put them in `public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "org.setsetal.app",
    "sha256_cert_fingerprints": ["<PLAY APP SIGNING SHA-256>", "<UPLOAD KEY SHA-256>"]
  }
}]
```

3. Deploy, then check `curl -s https://setsetal.netlify.app/.well-known/assetlinks.json`. The file is `[]` until then, which is valid and links nothing.

## Release

Follow `/twa-release` and tick off `docs/plan/phase-4-play-store.md`. The store text, data-safety answers and graphics are in `docs/play-store/`.
