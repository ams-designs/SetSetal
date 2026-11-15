# Note: iPhones and the App Store (not built)

SetSetal already works on iPhones in Safari and can be added to the Home Screen (Share → Add to Home Screen); the icon and full-screen display are set up. Safari does not offer an install button the way Chrome does, so the in-app **Install app** button does not appear there.

An App Store release would need an Apple developer account (US$99 a year), a Mac to build on, and a native wrapper (Capacitor), because Apple does not accept a Trusted Web Activity. Apple also tends to reject apps that are only a website in a wrapper.

**Recommendation:** do nothing until a meaningful share of pilot users are on iPhones. If they are, first add a short "On iPhone: tap Share, then Add to Home Screen" hint on the home screen, which costs an hour, and measure again.
