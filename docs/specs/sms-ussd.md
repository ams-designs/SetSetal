# Spec: SMS or USSD for residents without smartphones (not built)

## Problem

A resident with a basic phone cannot use a web app.

## Options

| | How it works | Needs |
|---|---|---|
| SMS | The resident texts an area name to a number and gets back up to three collectors' names and numbers | A number that can receive SMS and an API to reply (an aggregator such as Africa's Talking, or an operator directly); a budget per message |
| USSD | The resident dials a short code and picks an area from a menu | A USSD code from Africell, QCell or Gamtel, usually with a set-up fee and monthly rental; an aggregator; a small server to answer the menu within a few seconds |
| Posters | A printed list of collectors' numbers for each neighbourhood, updated monthly | A printer. Only collectors who consented to show their number |

## Recommendation

Try the poster list first: it costs almost nothing and tests whether the demand exists. If it does, build SMS before USSD: it needs no operator agreement for a short code.

## Design notes for SMS

- A Supabase Edge Function receives the aggregator's webhook, looks up `public_collectors` for the area (the same view the app reads, so consent and approval rules apply unchanged), and replies.
- Match area names loosely (spelling varies) and reply with the list of areas when there is no match.
- Do not store the resident's number. Count the request in `events` as an anonymous `search` with the area only.
- Order replies as the app does: collecting today first, then by name. Never by payment.
- Costs are per message in both directions; set a daily cap.

## Blocked on

Decision D5 (budget), and finding out which aggregators serve The Gambia at what price.
