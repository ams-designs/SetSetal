# Spec: ratings (not built)

## Problem

Residents can't tell a reliable collector from an unreliable one, apart from the review by an admin.

## Why it isn't built yet

Residents are anonymous. An anonymous rating can be left by the collector, their friends or a rival, any number of times. Showing such a score next to a listing would present unverified data as trustworthy (rule 1), and sorting by it would not be fair ranking (rule 5).

## What would make it sound

A rating has to be tied to a real job without identifying the resident:

1. After a job, the **collector** gives the resident a one-time code (shown in the collector's app, valid for 48 hours).
2. The resident opens the listing, enters the code and answers one question: "Did the collector come and take the waste as agreed? Yes / No."
3. One code, one answer. No stars, no free text (free text needs moderation and invites abuse).
4. The listing shows "12 of 13 residents said the collection went as agreed", only once there are at least 5 answers.
5. Results never change the order of the list. A pattern of "No" answers goes to the admin's reports instead.

## Cost

A table of codes and answers, two small screens, RLS tests, and the wording tested with residents. About a week. Collectors can still choose whom to give codes to, so it stays a signal for the admin more than a public score; say so in the interface.

## Decide first

Whether the pilot's reports show the need. A handful of collectors that the team has met in person may not need it.
