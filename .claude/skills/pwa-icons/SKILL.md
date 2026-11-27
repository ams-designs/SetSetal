---
name: pwa-icons
description: Generate SetSetal's PNG app icons (192, 512, maskable 512, apple-touch 180) from icon.svg and wire them into manifest.json, index.html and the service worker. Use for Phase 0 gap G1 or whenever the icon changes.
---

# PWA icons

No ImageMagick or rsvg-convert is installed, so use `sharp` through npx in a scratch directory. This avoids adding a project dependency.

1. Create the maskable source. Copy `icon.svg` to `icons/maskable.svg` with a full-bleed `#147D59` square (no `rx`), and scale the white glyph group to about 80% around the centre (`<g transform="translate(51.2 51.2) scale(0.8)">`) so it sits inside the safe zone.
2. Render the PNGs:
```bash
mkdir -p icons
cat > "$TMPDIR/render-icons.mjs" <<'EOF'
import sharp from "sharp";
const [,, src, mask, out] = process.argv;
const jobs = [[src, 192, "icon-192.png"], [src, 512, "icon-512.png"], [src, 180, "apple-touch-icon.png"], [mask, 512, "maskable-512.png"]];
for (const [s, size, name] of jobs) await sharp(s, { density: 384 }).resize(size, size).png().toFile(`${out}/${name}`);
EOF
npx -y -p sharp node "$TMPDIR/render-icons.mjs" icon.svg icons/maskable.svg icons
```
If `npx -p` can't resolve the import, run `npm i --no-save sharp` in a scratch folder and run the script from there.

3. Update `manifest.json` `icons`:
```json
[
  { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
  { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
4. In `index.html`, change the apple touch icon to `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`.
5. Phase 0: add the PNGs to `APP_SHELL` in `sw.js` and bump `CACHE_NAME`. Phase 1+: icons live in `public/icons/` and the manifest in `vite.config.ts`; Workbox precaches them automatically.
6. Verify: look at the maskable PNG (using Read on the image) to make sure no part of the glyph falls outside the centre circle at 80%. Chrome DevTools → Application → Manifest should show no icon warnings.
