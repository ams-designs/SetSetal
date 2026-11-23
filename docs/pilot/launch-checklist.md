# Launch checklist

Do these once, in order. Steps marked **owner** need a decision or an account that only the project owner has.

## 1. Deploy the code and the database

- [x] Restore the Supabase project if it is paused (dashboard → project → Restore). It pauses after a week without use on the free tier.
- [x] Apply the migrations: `supabase link --project-ref gplmfpglapxicfghlkid`, then `supabase db push`. Five new migrations dated 14 Nov 2026 should be applied. Done 23 Nov 2026.
- [x] Regenerate the types and check nothing changed unexpectedly: `supabase gen types typescript --project-id gplmfpglapxicfghlkid > src/types/db.ts`, then `npm run build`.
- [x] In the SQL editor, check the nightly clean-up is scheduled (see `docs/legal/data-retention.md`), and that deleting an account works: `select has_table_privilege('postgres', 'auth.users', 'DELETE');` must be true. Both confirmed 23 Nov 2026 (`setsetal-retention`, 03:15 daily).
- [ ] Push `adlai_changes`; check the preview (`BASE_URL=https://adlai-changes--setsetal.netlify.app npm test`); **owner** merges to `main`.
  - [x] Pushed and checked 23 Nov 2026: 124 passed, 4 skipped. The one failure is the captcha sign-in test, which needs `VITE_TURNSTILE_SITE_KEY` set in Netlify (step 2).

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
- [ ] Authentication → Emails → Magic Link: add the line `Your SetSetal code is {{ .Token }}` to the message, so the email contains the code the app asks for (8 digits on the hosted project; the app takes 6 to 10). Without it, the email holds only a link, which the app doesn't use. Don't use `supabase config push` for this: `config.toml` holds local-development values (site URL, MFA, phone sign-ups) that would overwrite the live ones.
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

## 6. Go

- [ ] Print the poster (`docs/pilot/poster.svg`) once the address is final.
- [ ] Onboard collectors with `onboarding-checklist.md`.
