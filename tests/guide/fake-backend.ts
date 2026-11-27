// A made-up Supabase for the guide's screenshots: it remembers what the app
// sends, so a listing a collector submits shows up in the admin's queue and,
// once approved, on the resident's Find screen. Every name and number in it
// is invented. It is not a test double for the security rules; those are
// tested against the real SQL in supabase/tests.
import type { BrowserContext, Route } from "@playwright/test";

type Status = "submitted" | "approved" | "rejected" | "suspended";

interface Listing {
  id: string;
  owner: string;
  name: string;
  vehicle_type: string;
  description: string;
  consent_at: string | null;
  status: Status;
  updated_at: string;
  available_on: string | null;
  phone: string | null;
  whatsapp: string | null;
  areas: string[];
  waste: string[];
}

interface Report {
  id: string;
  type: string;
  message: string;
  created_at: string;
  status: "open" | "resolved" | "dismissed";
  resolution_note: string | null;
  resolved_at: string | null;
  collector_id: string | null;
}

export const ADMIN_PHONE = "+2207000002";
const ADMIN_ID = "00000000-0000-4000-8000-00000000000a";
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number, hour = 9) => {
  const date = new Date(Date.now() - days * 86_400_000);
  date.setUTCHours(hour, 15, 0, 0);
  return date.toISOString();
};
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userFor = (phone: string) =>
  phone === ADMIN_PHONE ? ADMIN_ID : `00000000-0000-4000-8000-${phone.replace(/\D/g, "").padStart(12, "0")}`;

export function createBackend() {
  const areas = [
    { id: "brikama", name: "Brikama", district: "West Coast Region", active: true, sort_order: 1 },
    { id: "brikama-nyambai", name: "Brikama Nyambai", district: "West Coast Region", active: true, sort_order: 2 },
    { id: "brikama-kabafita", name: "Brikama Kabafita", district: "West Coast Region", active: true, sort_order: 3 }
  ];
  const listings: Listing[] = [
    {
      id: uuid(1), owner: userFor("+2207000011"), name: "Lamin's tricycle", vehicle_type: "tricycle",
      description: "Household bags and garden waste, Monday to Saturday.", consent_at: daysAgo(12), status: "approved",
      updated_at: daysAgo(11), available_on: today(), phone: "+2207000011", whatsapp: "+2207000011",
      areas: ["brikama", "brikama-nyambai"], waste: ["household", "garden"]
    },
    {
      id: uuid(2), owner: userFor("+2207000012"), name: "Awa's horse cart", vehicle_type: "horse-cart",
      description: "Garden waste and bulky items around Kabafita.", consent_at: daysAgo(9), status: "approved",
      updated_at: daysAgo(8), available_on: null, phone: "+2207000012", whatsapp: null,
      areas: ["brikama-kabafita"], waste: ["garden", "bulky"]
    },
    {
      id: uuid(3), owner: userFor("+2207000013"), name: "Musa's van", vehicle_type: "small-van",
      description: "Small loads and recyclables.", consent_at: daysAgo(20), status: "suspended",
      updated_at: daysAgo(3), available_on: null, phone: "+2207000013", whatsapp: "+2207000013",
      areas: ["brikama"], waste: ["household", "recyclables"]
    }
  ];
  const audit = [
    { id: 1, collector_id: uuid(1), from_status: null as Status | null, to_status: "submitted" as Status, reason: "Submitted", created_at: daysAgo(12) },
    { id: 2, collector_id: uuid(1), from_status: "submitted" as Status | null, to_status: "approved" as Status, reason: "Met in person at Brikama market; phone answered", created_at: daysAgo(11) },
    { id: 3, collector_id: uuid(2), from_status: "submitted" as Status | null, to_status: "approved" as Status, reason: "Met in person; cart seen", created_at: daysAgo(8) },
    { id: 4, collector_id: uuid(3), from_status: "approved" as Status | null, to_status: "suspended" as Status, reason: "Two reports that the van did not come after payment", created_at: daysAgo(3) }
  ];
  const reports: Report[] = [
    {
      id: uuid(101), type: "incorrect-listing", message: "The WhatsApp number on this listing doesn't work.",
      created_at: daysAgo(1, 16), status: "open", resolution_note: null, resolved_at: null, collector_id: uuid(2)
    },
    {
      id: uuid(102), type: "general", message: "Please add collectors for Brikama Jalanbang.",
      created_at: daysAgo(6), status: "resolved", resolution_note: "Added to the list of areas to recruit in",
      resolved_at: daysAgo(5), collector_id: null
    }
  ];
  const events = { contact_tap: 23, search_no_results: 6, report_submitted: 4, listing_marked_wrong: 1 };
  let nextId = 10;
  // Who the next request is from: the fake has no real tokens to read.
  let currentPhone = "";

  const nameOf = (id: string | null) => listings.find((listing) => listing.id === id)?.name;
  const stamp = (listing: Listing) => { listing.updated_at = new Date().toISOString(); };
  const adminRow = (listing: Listing) => ({
    id: listing.id, name: listing.name, vehicle_type: listing.vehicle_type, description: listing.description,
    consent_at: listing.consent_at, status: listing.status, updated_at: listing.updated_at, available_on: listing.available_on,
    collector_contacts: { phone: listing.phone, whatsapp: listing.whatsapp },
    collector_areas: listing.areas.map((area_id) => ({ area_id })),
    collector_waste_types: listing.waste.map((waste_type_id) => ({ waste_type_id }))
  });
  const publicRow = (listing: Listing) => ({
    id: listing.id, name: listing.name, vehicle_type: listing.vehicle_type, description: listing.description,
    phone: listing.consent_at ? listing.phone : null, whatsapp: listing.consent_at ? listing.whatsapp : null,
    areas: listing.areas, waste_types: listing.waste, available_today: listing.available_on === today()
  });
  const reportRow = (report: Report) => ({
    ...report, collectors: report.collector_id && nameOf(report.collector_id) ? { name: nameOf(report.collector_id) } : null
  });

  async function rest(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/rest\/v1\//, "");
    const query = decodeURIComponent(url.search);
    const method = request.method();
    const body = (method === "GET" ? {} : request.postDataJSON() ?? {}) as Record<string, unknown>;
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    const empty = (status = 204) => route.fulfill({ status, body: "" });
    const me = userFor(currentPhone);

    switch (path) {
      case "rpc/app_lookups":
        return json({
          areas: areas.filter((area) => area.active).map(({ id, name }) => ({ id, name })),
          vehicle_types: ["municipal-truck", "private-truck", "small-van", "tricycle", "donkey-cart", "horse-cart"],
          waste_types: ["household", "garden", "bulky", "recyclables", "business"],
          report_types: ["no-show", "late", "incorrect-listing", "safety", "general", "accessibility"]
        });
      case "public_collectors":
        return json(listings.filter((listing) => listing.status === "approved").map(publicRow)
          .sort((a, b) => a.name.localeCompare(b.name)));
      case "admins":
        return json(me === ADMIN_ID ? [{ user_id: ADMIN_ID }] : []);
      case "collectors": {
        if (query.includes("owner=eq.")) return json(listings.filter((listing) => listing.owner === me).map(adminRow));
        const wanted: Status[] = query.includes("status=eq.submitted") ? ["submitted"]
          : query.includes("status=eq.approved") ? ["approved"] : ["rejected", "suspended"];
        return json(listings.filter((listing) => wanted.includes(listing.status)).map(adminRow));
      }
      case "audit_log": {
        const own = query.match(/collector_id=eq\.([0-9a-f-]+)&to_status=eq\.(\w+)/);
        if (own) {
          return json(audit.filter((row) => row.collector_id === own[1] && row.to_status === own[2]).reverse().slice(0, 1));
        }
        return json([...audit].reverse().map((row) => ({
          ...row, collectors: nameOf(row.collector_id) ? { name: nameOf(row.collector_id) } : null
        })));
      }
      case "reports": {
        if (method === "POST") {
          reports.push({
            id: uuid(nextId++), type: String(body.type), message: String(body.message), created_at: new Date().toISOString(),
            status: "open", resolution_note: null, resolved_at: null, collector_id: (body.collector_id as string | null) ?? null
          });
          return empty(201);
        }
        if (method === "PATCH") {
          const report = reports.find((item) => item.id === query.match(/id=eq\.([0-9a-f-]+)/)?.[1]);
          if (!report) return json([]);
          report.status = body.status as Report["status"];
          if (body.resolution_note !== undefined) report.resolution_note = body.resolution_note as string | null;
          report.resolved_at = report.status === "open" ? null : new Date().toISOString();
          return json([{ id: report.id }]);
        }
        const closed = query.includes("status=neq.open");
        return json(reports.filter((report) => (report.status !== "open") === closed).map(reportRow));
      }
      case "areas": {
        if (method === "POST") {
          areas.push({ id: String(body.id), name: String(body.name), district: String(body.district), active: true, sort_order: Number(body.sort_order) });
          return empty(201);
        }
        if (method === "PATCH") {
          const area = areas.find((item) => item.id === query.match(/id=eq\.([a-z0-9-]+)/)?.[1]);
          if (area) area.active = Boolean(body.active);
          return empty();
        }
        return json(areas);
      }
      case "events": {
        const name = String(body.name) as keyof typeof events;
        if (name in events) events[name]++;
        return empty(201);
      }
      case "rpc/admin_activity":
        return json({
          days: 30, totals: events,
          no_results: [
            { area: "other", vehicle: "all", waste: "all", count: 3 },
            { area: "brikama-kabafita", vehicle: "all", waste: "recyclables", count: 2 },
            { area: "brikama", vehicle: "municipal-truck", waste: "all", count: 1 }
          ],
          contacts: [{ name: "Lamin's tricycle", call: 11, whatsapp: 7 }, { name: "Awa's horse cart", call: 5, whatsapp: 0 }]
        });
      case "rpc/save_my_listing": {
        let listing = listings.find((item) => item.owner === me);
        if (!listing) {
          listing = {
            id: uuid(nextId++), owner: me, name: "", vehicle_type: "", description: "", consent_at: null, status: "submitted",
            updated_at: "", available_on: null, phone: null, whatsapp: null, areas: [], waste: []
          };
          listings.push(listing);
          audit.push({ id: audit.length + 1, collector_id: listing.id, from_status: null, to_status: "submitted", reason: "Submitted", created_at: new Date().toISOString() });
        } else if (listing.status === "approved" || listing.status === "rejected") {
          audit.push({ id: audit.length + 1, collector_id: listing.id, from_status: listing.status, to_status: "submitted", reason: "Changed by the owner, so it needs review again", created_at: new Date().toISOString() });
          listing.status = "submitted";
        }
        Object.assign(listing, {
          name: String(body.p_name), vehicle_type: String(body.p_vehicle_type), description: String(body.p_description ?? ""),
          consent_at: body.p_consent ? listing.consent_at ?? new Date().toISOString() : null,
          phone: body.p_phone ?? null, whatsapp: body.p_whatsapp ?? null, areas: body.p_areas, waste: body.p_waste_types
        });
        stamp(listing);
        return json({ id: listing.id, status: listing.status });
      }
      case "rpc/set_collector_status": {
        const listing = listings.find((item) => item.id === body.p_collector);
        if (!listing) return json({ code: "P0002", message: "listing not found" }, 400);
        if (listing.status !== body.p_expected_status || listing.updated_at !== body.p_expected_updated_at) {
          return json({ code: "PT409", message: "the listing has changed since it was reviewed" }, 409);
        }
        audit.push({ id: audit.length + 1, collector_id: listing.id, from_status: listing.status, to_status: body.p_status as Status, reason: String(body.p_reason), created_at: new Date().toISOString() });
        listing.status = body.p_status as Status;
        stamp(listing);
        return empty();
      }
      case "rpc/set_my_availability": {
        const listing = listings.find((item) => item.owner === me);
        if (listing) listing.available_on = body.p_available ? today() : null;
        return json(Boolean(body.p_available));
      }
      case "rpc/delete_my_account": {
        const index = listings.findIndex((item) => item.owner === me);
        if (index >= 0) listings.splice(index, 1);
        return empty();
      }
      default:
        return json([]);
    }
  }

  async function auth(route: Route): Promise<void> {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/auth\/v1\//, "");
    const body = (route.request().postDataJSON() ?? {}) as { phone?: string };
    if (path === "verify") {
      currentPhone = body.phone ?? "";
      return route.fulfill({ json: {
        access_token: "guide-token", refresh_token: "guide-refresh", expires_in: 3600,
        user: { id: userFor(currentPhone), phone: currentPhone.replace("+", "") }
      } });
    }
    if (path === "logout") currentPhone = "";
    return route.fulfill({ status: path === "logout" ? 204 : 200, body: path === "logout" ? "" : "{}" });
  }

  return {
    async install(context: BrowserContext) {
      await context.route(/\/rest\/v1\//, rest);
      await context.route(/\/auth\/v1\//, auth);
      await context.route(/challenges\.cloudflare\.com/, (route) => route.fulfill({
        contentType: "application/javascript",
        // The check passes at once, and again each time the app asks for a new one.
        body: `window.turnstile = { render(c, o) { this.pass = () => o.callback("guide-captcha"); this.pass(); return "w"; },
          reset() { this.pass(); } };`
      }));
    },
    listings,
    audit
  };
}
