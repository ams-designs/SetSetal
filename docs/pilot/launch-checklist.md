# Launch checklist

Do these once, in order. Steps marked **owner** need a decision or an account that only the project owner has.

## 1. Deploy the code and the database

- [x] Restore the Supabase project if it is paused (dashboard → project → Restore). It pauses after a week without use on the free tier.
- [x] Apply the migrations: `supabase link --project-ref gplmfpglapxicfghlkid`, then `supabase db push`. Five new migrations dated 14 Nov 2026 should be applied. Done 23 Nov 2026.
- [x] Regenerate the types and check nothing changed unexpectedly: `supabase gen types typescript --project-id gplmfpglapxicfghlkid > src/types/db.ts`, then `npm run build`.
- [x] In the SQL editor, check the nightly clean-up is scheduled (see `docs/legal/data-retention.md`), and that deleting an account works: `select has_table_privilege('postgres', 'auth.users', 'DELETE');` must be true. Both confirmed 23 Nov 2026 (`setsetal-retention`, 03:15 daily).
- [x] (Done 26 Nov 2026.) Apply the two migrations dated 26 Nov 2026 with `supabase db push`, **before** the code that goes with them is pushed (previews use the live database too). Neither changes a table, so the types stay the same.
  - `20261126090000_retention_keep_recently_closed.sql` keeps an old report for 12 months after it is closed.
  - `20261126090100_report_ids_from_the_phone.sql` lets the phone give each report its id, so a report sent again after a timeout isn't stored twice. The app sends that id from the commit "Send each report with an id made on the phone": without the migration, the server refuses every report.
- [ ] Push `adlai_changes`; check the preview (`BASE_URL=https://adlai-changes--setsetal.netlify.app npm test`); **owner** merges to `main`.
  - Test the branch address above, not the pull request's `deploy-preview-1--setsetal.netlify.app`: Netlify adds a review toolbar to deploy previews, which covers the bottom nav and loads scripts that fail offline, so about seven tests fail there for reasons that aren't the app's.
  - [x] Pushed and checked 23 Nov 2026: 124 passed, 4 skipped. The one failure is the captcha sign-in test, which needs `VITE_TURNSTILE_SITE_KEY` set in Netlify (step 2).
  - [x] Checked again 26 Nov 2026: 132 passed, 4 skipped, 3 failed. Two are the phone and email sign-in tests, which both need `VITE_TURNSTILE_SITE_KEY` set in Netlify (step 2). The third was the touch-target test measuring the screen while it slid in; the test now waits for it to settle.

## 2. Sign-in by SMS (**owner**, decisions D5 and Q4)

- [ ] Choose how codes are sent: a paid provider (Twilio, Vonage and others are built into Supabase) or an Android phone as an SMS gateway through Supabase's Send SMS hook.
- [ ] Supabase dashboard → Authentication → Sign In / Providers → Phone: switch on, enter the provider's details.
- [ ] For development, add test numbers there ("Test Phone Numbers and OTPs"), for example `2207000001=123456`, so no SMS is sent.
- [ ] Authentication → Rate Limits: lower "SMS sent per hour" to what the budget allows (30 is the default).
- [ ] Captcha: create a free Cloudflare Turnstile widget for the site's domain. Put the **secret** in Supabase (Authentication → Attack Protection → enable Captcha, provider Turnstile) and the **site key** in Netlify as the environment variable `VITE_TURNSTILE_SITE_KEY`, then redeploy. Switch both on together: with only the Supabase half, nobody can sign in.

## 3. First admin

This works before SMS sign-in is switched on: an admin can sign in with a code sent by email. Only an address you add in the dashboard can sign in this way; the app never creates an account from the email form.

**By email (no SMS needed):**

- [x] (Done 23 Nov 2026 for the first admin.) Supabase dashboard → Authentication → Users → Add user → Create new user: the admin's email address, any strong password (it is never used), and tick "Auto Confirm User".
- [x] (Done 23 Nov 2026.) Authentication → Emails → Magic Link: add the line `Your SetSetal code is {{ .Token }}` to the message, so the email contains the code the app asks for (8 digits on the hosted project; the app takes 6 to 10). Without it, the email holds only a link, which the app doesn't use. Don't use `supabase config push` for this: `config.toml` holds local-development values (site URL, MFA, phone sign-ups) that would overwrite the live ones.
- [ ] Supabase's built-in email service sends only to addresses in the project's team and only a few an hour. That is enough for one admin. For more, set up your own SMTP under Authentication → Emails → SMTP Settings.
- [x] (Done 23 Nov 2026.) In the SQL editor: `insert into public.admins (user_id) select id from auth.users where email = 'admin@example.com';`
- [ ] Open `/#/admin`, enter the address, then the code from the email: the review queue appears.

**By phone (once step 2 is done):**

- [ ] The admin signs in once on the Join screen with their own phone.
- [ ] In the SQL editor: `insert into public.admins (user_id) select id from auth.users where phone = '2207XXXXXX';` (the number without `+`).
- [ ] Open `/#/admin` on that phone: the review queue appears.

## 4. Areas

- [ ] **Owner** lists Brikama's neighbourhoods (decision D3). Add each one on the admin screen under **Areas**. `Brikama` itself is already there.

## 5. Before the first collector

- [ ] **Owner:** who legally owns the data (D4); legal adviser checks `docs/legal/`; fill the gaps and update the Privacy screen if the adviser changes anything.
- [ ] **Owner:** decide what "verified" means (D2), or keep listings as "approved" only. Until then the app shows no "verified" badge.
- [ ] Run through `docs/guide/README.md` on a real low-end Android phone, including the hardware back button, installing from the home screen button, and using the app with no connection (Phase 0 exit criterion).
  - [x] Rehearsed in emulation 26 Nov 2026 on `adlai-changes--setsetal.netlify.app`: Pixel 5 screen, slow 3G (400 kbit/s, 400 ms) and a CPU slowed 4×. All 18 checks passed: buttons usable after 2.5 s, about 127 KB for the first visit, the service worker installed, the resident screens, back one screen at a time, buttons of 48 px or more, and Find, profiles and navigation working offline. Nothing was written to the database. Emulation can't show the **Install app** button, a real phone's speed or the physical back button, so the real-phone run above is still needed.

## 6. Go

- [ ] Print the poster (`docs/pilot/poster.svg`) once the address is final.
- [ ] Onboard collectors with `onboarding-checklist.md`.
