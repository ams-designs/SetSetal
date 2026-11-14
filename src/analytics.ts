// Anonymous usage counts for the pilot: which searches find nothing, how often
// residents tap Call or WhatsApp, and how many reports are sent. Each count is
// a row with no user, device, address or free text in it (product rule 3), in
// SetSetal's own database: no cookies and no third-party script.
import { sendEvent, type UsageEvent } from "./api";

// A browser set to "Do Not Track" or Global Privacy Control isn't counted.
const optedOut = (): boolean =>
  navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

function track(event: UsageEvent): void {
  if (optedOut()) return;
  sendEvent(event);
}

let lastSearch = "";

// Counted once per search, not every time the same empty result is redrawn.
export function trackNoResults(filters: { area: string; vehicle: string; waste: string }): void {
  const search = `${filters.area}|${filters.vehicle}|${filters.waste}`;
  if (search === lastSearch) return;
  lastSearch = search;
  track({ name: "search_no_results", ...filters });
}

export const resetNoResults = (): void => { lastSearch = ""; };

export const trackContact = (collectorId: string, channel: "call" | "whatsapp"): void =>
  track({ name: "contact_tap", channel, collector_id: collectorId });

export const trackReport = (type: string): void => track({ name: "report_submitted", report_type: type });

export const trackMarkedWrong = (collectorId: string): void =>
  track({ name: "listing_marked_wrong", collector_id: collectorId });
