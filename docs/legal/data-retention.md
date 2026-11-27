# Data retention policy: draft for legal review

> **Status: draft.** To be checked with `privacy-notice.md` by a Gambian legal adviser. The periods are enforced by code, so change both together: `supabase/migrations/20261114090300_retention_and_erasure.sql` (`private.apply_retention()`), `src/listings.ts` and `src/reports.ts`.

| Data | Kept for | Removed by |
|---|---|---|
| Feedback and reports | 12 months after being resolved or dismissed; 24 months if never closed | Nightly clean-up |
| Anonymous usage counts | 12 months | Nightly clean-up |
| Listing, contact numbers, areas, waste types | Until the collector deletes them or the account | The collector, in the app; immediately |
| Sign-in (phone number) | Until the collector deletes the account | The collector, in the app; immediately |
| Decision record (audit log) of an existing listing | As long as the listing exists | — |
| Decision record of a deleted listing | 12 months after the decision | Nightly clean-up |
| Listings saved on a resident's phone | 7 days; phone numbers 48 hours | The app |
| Feedback waiting to be sent, on the phone | 30 days | The app |
| A collector's sign-in on a phone | Ends after 7 days without use | The app |
| Providers' technical logs (Supabase, Netlify) | Set by the provider, typically days to weeks | The provider |

## How the clean-up runs

`private.apply_retention()` runs every night at 03:15 UTC through `pg_cron` and returns how many rows it removed. To check that it is scheduled, in the Supabase SQL editor:

```sql
select jobname, schedule, active from cron.job where jobname = 'setsetal-retention';
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

If the first query returns nothing, schedule it from the dashboard (Integrations → Cron) with the command `select private.apply_retention()` and the schedule `15 3 * * *`.

## Not yet decided

- Accounts that are never used: there is no automatic removal of a collector who signs in once and never returns. Suggested: review yearly.
- Backups: Supabase's free tier keeps no downloadable backups; paid tiers keep daily backups for 7 days or more, and deleted data stays in them for that long.
