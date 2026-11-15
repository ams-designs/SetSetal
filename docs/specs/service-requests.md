# Spec: service requests in the app (not built)

## Problem

Today a resident calls or messages a collector. If the collector doesn't answer, the resident has nothing to fall back on, and SetSetal never learns that a job was wanted.

## The constraint

A request needs a way to reach the resident and a place to collect from. Product rule 3 says SetSetal stores no resident address and residents stay anonymous. So either the rule changes, with the owner's and the legal adviser's agreement, or the request must carry no resident data.

## Options

| | What | Resident data stored | Cost |
|---|---|---|---|
| A (built) | WhatsApp opens with a starter message the resident can edit | None | Done |
| B | "Request a call back": the resident leaves a phone number for one collector; it is deleted when the collector marks it handled, or after 7 days | A phone number, briefly | Medium: a table, RLS so only that collector reads it, a collector inbox, retention |
| C | Full requests: area, waste, preferred day, several collectors can respond | Phone number and neighbourhood, for longer | Large: matching, notifications (push or SMS), abuse handling |

## Recommendation

Stay with A through the pilot. If the data shows unanswered contact, build B. It needs: a change to rule 3 recorded in `CLAUDE.md`, an explicit consent line on the form, a privacy-notice update, and the legal adviser's view. Never store a street address: the collector asks for it on the call.

## For option B, the tests that would have to pass

- Another collector, an anonymous visitor and the resident themselves cannot read a call-back request.
- The number is gone 7 days after the request, and immediately when handled.
- A resident can send at most a few requests per hour (a captcha, as on sign-in).
