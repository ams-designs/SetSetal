# Testing the English wording

The pilot runs in English only (decision D3). Wolof and Mandinka come afterwards, so the English has to work for people who read it as a second or third language. Test with 5 residents and 5 collectors; that is enough to find most problems.

## How

Hand over the phone, give the task, and stay quiet. Write down the words they stop at, read aloud twice, or ask about. Do not explain until the end.

| Task | Watch for |
|---|---|
| "Find someone to take garden waste in your area." | Do they understand "Your area", "Collection vehicle", "Waste type", "Show matching services"? |
| "What does *Collecting today* mean?" | Do they think SetSetal promises the collector will come? It must not read that way |
| "Contact this collector." | Do they see that they agree the price themselves? |
| "Tell SetSetal the number is wrong." | Do they find "Report a problem with this listing"? Do they understand nobody will reply? |
| (Collector) "Add your service." | "Vehicle or collection method", "Areas you serve", the consent sentence, "Preview", "Submit for review" |
| (Collector) "What happens now?" | Do they understand "Waiting for review" and who reviews? |
| (Collector) "Your listing was not approved. Why?" | Do they find and understand the reason? |
| "What does SetSetal know about you?" | Can they find Privacy, and say back one thing from it? |

## Afterwards

Every string is in `src/i18n/en.json`. Change the words there, run `npm test` (several tests check exact wording, so update them too), and record the change:

| Date | Key | Was | Now | Why |
|---|---|---|---|---|
| | | | | |
