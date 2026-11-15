# Privacy notice: draft for legal review

> **Status: draft, not legal advice.** A Gambian legal adviser must check this before collectors are onboarded (Phase 3). It was written from what the code and database do on 14 November 2026. The short version residents and collectors see is the Privacy screen in the app (`privacy.*` in `src/i18n/en.json`); keep the two in step.
>
> **Gaps only the owner can fill:** the legal name and contact details of whoever is responsible for the data (decision D4), and the SMS provider (decision D5).

## Who is responsible

**[D4: name of the person, business or organisation]**, [address], The Gambia. Contact: **[email or phone]**.

## Residents

SetSetal does not ask residents to sign in and does not collect their name, phone number, address or location. An area is chosen from a list.

| What | When | Why | Kept |
|---|---|---|---|
| Feedback text, its type, and the listing it concerns (if chosen) | When a resident sends feedback | To correct listings and handle complaints | 12 months after it is closed; 24 months at most if never closed |
| Anonymous counts: a search that found nothing (the chosen area, vehicle and waste type), a tap on Call or WhatsApp (which listing, which button), feedback sent (its type) | When it happens, unless the browser sends Do Not Track or Global Privacy Control | To see where collectors are missing and whether listings are used | 12 months |

The counts hold no account, device identifier, IP address, time of day or free text: only the day. They cannot be linked to a person. SetSetal uses no cookies, no advertising and no third-party analytics.

On the resident's own phone the app stores a copy of the listings (up to 7 days; phone numbers are removed from it after 48 hours) and any feedback waiting to be sent (up to 30 days). The resident can remove these by clearing the site's data.

Calling or messaging a collector happens outside SetSetal. The collector sees the resident's number, and WhatsApp is operated by Meta under its own terms.

## Collectors

| What | Why | Who sees it |
|---|---|---|
| The phone number used to sign in | To sign in with an SMS code | The SetSetal team |
| Name or business name, vehicle, areas served, waste types, description | To publish the listing | The team; residents once the listing is approved |
| Phone and WhatsApp numbers for residents | So residents can make contact | The team; residents **only** if the collector has ticked the consent box **and** the listing is approved |
| The date consent was given | To prove consent | The team |
| "Collecting today" | To show residents who is working | Residents, for that day only |
| Each review decision, its reason, who made it and when | To keep decisions accountable | The team and the collector concerned |

**Legal basis (for the adviser to confirm):** consent for showing contact numbers; performance of the service the collector asked for, for the rest.

**Collectors' choices:** withdraw consent at any time by unticking the box (numbers disappear straight away); edit the listing; delete the listing and account in the app, which removes the sign-in, listing, numbers and usage counts for the listing immediately. The decision record is unlinked from the deleted listing and removed within 12 months.

## Who else handles the data

| Provider | Role | Where |
|---|---|---|
| Supabase | Database and sign-in | European Union (Ireland, `eu-west-1`) |
| Netlify | Hosts the website | United States and its global network |
| **[D5: SMS provider]** | Sends sign-in codes; receives the collector's phone number | **[to confirm]** |
| Cloudflare Turnstile (only if switched on) | Checks that a sign-in request comes from a person; collectors only | Global |

These providers keep short-lived technical logs, including IP addresses, to run and protect their services. Data therefore leaves The Gambia; the adviser should confirm what the law requires for that.

## Rights

Anyone may ask what SetSetal holds about them, and to have it corrected or deleted, by contacting **[D4 contact]**. Because residents are anonymous, SetSetal cannot find a resident's feedback unless they describe it.

## Questions for the adviser

1. Which law applies and must SetSetal register with a regulator? (The Gambia has had data-protection provisions in its information and communications law and a Data Protection and Privacy Bill; confirm what is in force.)
2. Is consent by tick-box, with the time recorded, enough for publishing a collector's phone number?
3. Are the retention periods in `data-retention.md` acceptable, and must any record be kept longer?
4. What must be said about storing data in the EU and the US?
5. Does listing collectors create any liability for their conduct, and what disclaimer is needed? The app already says SetSetal does not take part in the call or the payment.
6. Is anything needed for collectors under 18?
