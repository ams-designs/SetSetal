# Phase 5: After the pilot (driven by pilot data)

Build an item only if Phase 3's data shows real demand for it. Write a spec first (try `/product-management:write-spec`).

Built ahead of the pilot on 15 Nov 2026, at the owner's request to complete every phase, because they are small and break no product rule. Everything else waits for pilot data; [../specs/README.md](../specs/README.md) says what evidence would justify each.

- [ ] Collector availability ("collecting today"), service requests and ratings
  - [x] "Collecting today": the collector switches it on, it expires at midnight, and residents see a label.
  - [x] A starter message when a resident opens WhatsApp: the lightest "service request", storing nothing.
  - [ ] Service requests in the app: [spec](../specs/service-requests.md). Needs a change to rule 3 (no resident data).
  - [ ] Ratings: [spec](../specs/ratings.md). Anonymous ratings would break rules 1 and 5.
- [ ] An SMS or USSD option for residents without smartphones: [spec](../specs/sms-ussd.md). Needs a budget (D5) and an operator or aggregator.
- [ ] Push notifications through a Capacitor wrapper, if a request flow needs them. Not needed unless service requests are built.
- [ ] An iOS App Store release (US$99 a year), if demand is real: [note](../specs/ios.md).
- [ ] Expansion to more areas, possibly with municipal partnerships
  - [x] Admins add areas and switch them off on the admin screen, with no code change.
  - [ ] Partnerships (owner).
