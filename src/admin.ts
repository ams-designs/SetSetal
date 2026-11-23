// The admin screen: review queue, reports, live and hidden listings, history,
// areas and usage counts. Admins sign in with the same phone code as
// collectors, or with a code sent by email until SMS is switched on. The
// database decides what an admin may do (RLS and
// set_collector_status); this screen only shows it.
import { t, type MessageKey } from "./i18n";
import {
  OTHER_AREA, isVehicle, isReportType, isWaste, refreshLookups, reportTypeLabel, vehicleLabel, wasteLabel
} from "./data/lookups";
import { call } from "./api";
import {
  currentSession, normaliseEmail, requestEmailCode, verifyEmailCode, type AuthResult, type Session
} from "./auth";
import { captchaEnabled, showCaptcha, takeCaptchaToken } from "./captcha";
import type { ListingStatus } from "./collector";
import { busy, signInThen } from "./join";
import { reloadListings } from "./listings";
import { $, escapeHTML, toast } from "./ui";

interface AdminListing {
  id: string;
  name: string;
  vehicle_type: string;
  description: string;
  consent_at: string | null;
  status: ListingStatus;
  updated_at: string;
  collector_contacts: Contact | Contact[] | null;
  collector_areas: { area_id: string }[];
  collector_waste_types: { waste_type_id: string }[];
}

interface Contact {
  phone: string | null;
  whatsapp: string | null;
}

interface AdminReport {
  id: string;
  type: string;
  message: string;
  created_at: string;
  collectors: { name: string } | null;
}

interface ClosedReport extends AdminReport {
  status: "resolved" | "dismissed";
  resolution_note: string | null;
  resolved_at: string | null;
}

interface AdminArea {
  id: string;
  name: string;
  district: string;
  active: boolean;
  sort_order: number;
}

// What admin_activity() returns: counts only, nothing about any resident.
interface Activity {
  days: number;
  totals: Partial<Record<"search_no_results" | "contact_tap" | "report_submitted" | "listing_marked_wrong", number>>;
  no_results: { area: string | null; vehicle: string | null; waste: string | null; count: number }[];
  contacts: { name: string; call: number; whatsapp: number }[];
}

interface AuditRow {
  id: number;
  from_status: ListingStatus | null;
  to_status: ListingStatus;
  reason: string;
  created_at: string;
  collectors: { name: string } | null;
}

interface AdminData {
  queue: AdminListing[];
  live: AdminListing[];
  // Rejected and suspended: not shown to residents, and a decision can be reversed.
  hidden: AdminListing[];
  reports: AdminReport[];
  closedReports: ClosedReport[];
  history: AuditRow[];
  areas: AdminArea[];
  // Null when the counts couldn't be loaded; the rest of the screen still works.
  activity: Activity | null;
}

type Failure = "offline" | "signed-out" | "failed";

async function getJSON<T>(session: Session, path: string): Promise<T> {
  if (!navigator.onLine) throw "offline" satisfies Failure;
  let response: Response;
  try {
    response = await call(`rest/v1/${path}`, {}, session.accessToken);
  } catch {
    throw "offline" satisfies Failure;
  }
  if (response.status === 401) throw "signed-out" satisfies Failure;
  if (!response.ok) throw "failed" satisfies Failure;
  return (await response.json()) as T;
}

// The admins table only shows a signed-in user their own row.
async function isAdmin(session: Session): Promise<boolean> {
  const rows = await getJSON<{ user_id: string }[]>(session, `admins?select=user_id&user_id=eq.${encodeURIComponent(session.userId)}`);
  return rows.length > 0;
}

const LISTING_FIELDS = "id,name,vehicle_type,description,consent_at,status,updated_at," +
  "collector_contacts(phone,whatsapp),collector_areas(area_id),collector_waste_types(waste_type_id)";

async function loadActivity(session: Session): Promise<Activity | null> {
  try {
    const activity = await getJSON<Activity>(session, "rpc/admin_activity?p_days=30");
    return activity && typeof activity === "object" && !Array.isArray(activity) && activity.totals ? activity : null;
  } catch (failure) {
    if (failure === "signed-out") throw failure;
    return null;
  }
}

async function loadData(session: Session): Promise<AdminData> {
  const [queue, live, hidden, reports, closedReports, history, areaRows, activity] = await Promise.all([
    // Oldest first, so nobody waits longest.
    getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&status=eq.submitted&order=updated_at.asc`),
    getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&status=eq.approved&order=name.asc`),
    getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&status=in.(rejected,suspended)&order=updated_at.desc`),
    getJSON<AdminReport[]>(session, "reports?select=id,type,message,created_at,collectors(name)&status=eq.open&order=created_at.asc"),
    getJSON<ClosedReport[]>(session, "reports?select=id,type,message,created_at,status,resolution_note,resolved_at,collectors(name)" +
      "&status=neq.open&order=resolved_at.desc&limit=30"),
    getJSON<AuditRow[]>(session, "audit_log?select=id,from_status,to_status,reason,created_at,collectors(name)&order=id.desc&limit=30"),
    getJSON<AdminArea[]>(session, "areas?select=id,name,district,active,sort_order&order=sort_order.asc,name.asc"),
    loadActivity(session)
  ]);
  return { queue, live, hidden, reports, closedReports, history, areas: areaRows, activity };
}

// "offline": never sent, so nothing changed. "unknown": sent but no clear
// answer (a timeout or a server error), so it may have gone through. "stale":
// someone else changed it first.
// "exists": the area is already on the list.
type ActionResult = "ok" | "offline" | "unknown" | "signed-out" | "refused" | "stale" | "exists";

async function send(session: Session, path: string, init: RequestInit, prefer = "return=minimal"): Promise<[ActionResult, Response | null]> {
  if (!navigator.onLine) return ["offline", null];
  try {
    const response = await call(`rest/v1/${path}`, { ...init, headers: { Prefer: prefer } }, session.accessToken);
    if (response.ok) return ["ok", response];
    if (response.status === 401) return ["signed-out", null];
    // 409: the server found a newer version than the one this screen showed.
    if (response.status === 409) return ["stale", null];
    return [response.status >= 500 ? "unknown" : "refused", null];
  } catch {
    return ["unknown", null];
  }
}

// The version of each listing this screen is showing. The decision names it,
// and the server refuses if the listing has changed since: its details, phone
// numbers, areas and waste types all change updated_at.
const shown = new Map<string, { status: ListingStatus; updatedAt: string }>();

async function setStatus(session: Session, id: string, status: ListingStatus, reason: string): Promise<ActionResult> {
  const seen = shown.get(id);
  if (!seen) return "stale";
  const [result] = await send(session, "rpc/set_collector_status", {
    method: "POST",
    body: JSON.stringify({
      p_collector: id, p_status: status, p_reason: reason,
      p_expected_status: seen.status, p_expected_updated_at: seen.updatedAt
    })
  });
  return result;
}

// Only an open report is closed, so a second admin can't overwrite the first
// decision; no row back means it was already handled (or not allowed).
async function closeReport(session: Session, id: string, status: "resolved" | "dismissed", note: string): Promise<ActionResult> {
  const [result, response] = await send(session, `reports?id=eq.${encodeURIComponent(id)}&status=eq.open&select=id`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolution_note: note || null })
  }, "return=representation");
  if (result !== "ok" || !response) return result;
  try {
    return ((await response.json()) as unknown[]).length ? "ok" : "stale";
  } catch {
    return "unknown";
  }
}

// A closed report can be opened again, for example one dismissed by mistake.
async function reopenReport(session: Session, id: string): Promise<ActionResult> {
  const [result, response] = await send(session, `reports?id=eq.${encodeURIComponent(id)}&status=neq.open&select=id`, {
    method: "PATCH",
    body: JSON.stringify({ status: "open" })
  }, "return=representation");
  if (result !== "ok" || !response) return result;
  try {
    return ((await response.json()) as unknown[]).length ? "ok" : "stale";
  } catch {
    return "unknown";
  }
}

// "Brikama Nyambai" → "brikama-nyambai". Accents are dropped.
export const areaId = (name: string): string =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function addArea(session: Session, name: string, district: string): Promise<ActionResult> {
  const id = areaId(name);
  if (!id || id === OTHER_AREA || id === "all") return "refused";
  if (areas.some((area) => area.id === id)) return "exists";
  const sortOrder = Math.max(0, ...areas.map((area) => area.sort_order)) + 1;
  const [result] = await send(session, "areas", {
    method: "POST",
    body: JSON.stringify({ id, name, district, sort_order: sortOrder })
  });
  // 409 here is a duplicate id, added by another admin since this screen loaded.
  return result === "stale" ? "exists" : result;
}

// Areas are never deleted, because listings refer to them: an area no longer
// served is switched off, and collectors and residents stop being offered it.
async function setAreaActive(session: Session, id: string, active: boolean): Promise<ActionResult> {
  const [result] = await send(session, `areas?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active })
  });
  return result;
}

// Rendering ------------------------------------------------------------------------

let areas: AdminArea[] = [];
const areaName = (id: string): string => areas.find((area) => area.id === id)?.name ?? id;
const when = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const contactOf = (listing: AdminListing): Contact | null =>
  Array.isArray(listing.collector_contacts) ? listing.collector_contacts[0] ?? null : listing.collector_contacts;

const row = (label: string, value: string) =>
  `<div class="detail-row"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(value)}</p></div>`;

// The decisions offered for each list, with the status each one sets.
type Decision = "approved" | "rejected" | "suspended";

const DECISIONS: Record<ListingStatus, { status: Decision; label: MessageKey; style: string }[]> = {
  submitted: [
    { status: "approved", label: "admin.approve", style: "primary" },
    { status: "rejected", label: "admin.reject", style: "secondary" }
  ],
  approved: [{ status: "suspended", label: "admin.suspend", style: "secondary" }],
  // Reversing a decision: both go live again, with a new reason on record.
  rejected: [{ status: "approved", label: "admin.approve", style: "primary" }],
  suspended: [{ status: "approved", label: "admin.reinstate", style: "primary" }]
};

function listingCard(listing: AdminListing): string {
  const contact = contactOf(listing);
  const waste = listing.collector_waste_types.map((link) => link.waste_type_id).filter(isWaste).map(wasteLabel);
  const hidden = listing.status === "rejected" || listing.status === "suspended";
  const buttons = DECISIONS[listing.status].map((decision) => `
          <button class="button ${decision.style}" type="button" data-decide="${decision.status}"
            data-id="${escapeHTML(listing.id)}" data-name="${escapeHTML(listing.name)}">${escapeHTML(t(decision.label))}</button>`).join("");
  return `
      <article class="panel admin-card">
        <h3>${escapeHTML(listing.name)}</h3>
        <p class="muted">${hidden ? `${escapeHTML(t(`join.status.${listing.status}`))} · ` : ""}${escapeHTML(t("admin.updated", { date: when(listing.updated_at) }))}</p>
        ${row(t("profile.vehicle"), isVehicle(listing.vehicle_type) ? vehicleLabel(listing.vehicle_type) : listing.vehicle_type)}
        ${row(t("profile.area"), listing.collector_areas.map((link) => areaName(link.area_id)).join(", "))}
        ${row(t("profile.waste"), waste.join(", "))}
        ${row(t("preview.phoneForResidents"), contact?.phone ?? "—")}
        ${row(t("preview.whatsapp"), contact?.whatsapp ?? "—")}
        ${row(t("preview.consent"), t(listing.consent_at ? "admin.consentYes" : "admin.consentNo"))}
        ${listing.description ? row(t("profile.about"), listing.description) : ""}
        <div class="card-actions">${buttons}</div>
        <div class="decision" data-decision-for="${escapeHTML(listing.id)}" hidden></div>
      </article>`;
}

function reportCard(report: AdminReport): string {
  return `
      <article class="panel admin-card">
        <h3>${escapeHTML(isReportType(report.type) ? reportTypeLabel(report.type) : report.type)}</h3>
        <p class="muted">${escapeHTML(when(report.created_at))}${report.collectors ? ` · ${escapeHTML(t("admin.aboutListing", { name: report.collectors.name }))}` : ""}</p>
        <p class="report-message">${escapeHTML(report.message)}</p>
        <label for="note-${escapeHTML(report.id)}">${escapeHTML(t("admin.note"))}</label>
        <input id="note-${escapeHTML(report.id)}" maxlength="1000" data-note-for="${escapeHTML(report.id)}">
        <div class="card-actions">
          <button class="button primary" type="button" data-close-report="resolved" data-id="${escapeHTML(report.id)}">${escapeHTML(t("admin.resolve"))}</button>
          <button class="button secondary" type="button" data-close-report="dismissed" data-id="${escapeHTML(report.id)}">${escapeHTML(t("admin.dismiss"))}</button>
        </div>
      </article>`;
}

function historyItem(entry: AuditRow): string {
  const label = (status: ListingStatus | null) => (status ? t(`join.status.${status}`) : t("admin.new"));
  return `
        <li>
          <strong>${escapeHTML(entry.collectors?.name ?? t("admin.deletedListing"))}</strong>:
          ${escapeHTML(label(entry.from_status))} → ${escapeHTML(label(entry.to_status))}
          <span class="muted">(${escapeHTML(when(entry.created_at))})</span>
          <br><span>${escapeHTML(entry.reason)}</span>
        </li>`;
}

function closedReportItem(report: ClosedReport): string {
  const type = isReportType(report.type) ? reportTypeLabel(report.type) : report.type;
  const about = report.collectors ? ` · ${escapeHTML(t("admin.aboutListing", { name: report.collectors.name }))}` : "";
  return `
        <li>
          <strong>${escapeHTML(t("admin.reportLabel", { type }))}</strong>${about}:
          ${escapeHTML(t(report.status === "resolved" ? "admin.reportResolved" : "admin.reportDismissed"))}
          <span class="muted">(${escapeHTML(when(report.resolved_at ?? report.created_at))})</span>
          <br><span class="report-message">${escapeHTML(report.message)}</span>
          ${report.resolution_note ? `<br><span>${escapeHTML(t("admin.noteWas", { note: report.resolution_note }))}</span>` : ""}
          <br><button class="text-button" type="button" data-reopen-report data-id="${escapeHTML(report.id)}">${escapeHTML(t("admin.reopen"))}</button>
        </li>`;
}

// Listing decisions and report decisions in one list, newest first.
function historyList(data: AdminData): string {
  const items = [
    ...data.history.map((entry) => ({ at: entry.created_at, html: historyItem(entry) })),
    ...data.closedReports.map((report) => ({ at: report.resolved_at ?? report.created_at, html: closedReportItem(report) }))
  ].sort((a, b) => b.at.localeCompare(a.at));
  return `<ul class="history-list">${items.map((item) => item.html).join("")}</ul>`;
}

function areaRow(area: AdminArea): string {
  return `
        <li>
          <span><strong>${escapeHTML(area.name)}</strong> <span class="muted">· ${escapeHTML(area.district)} · ${
            escapeHTML(t(area.active ? "admin.areas.active" : "admin.areas.inactive"))}</span></span>
          <button class="button secondary" type="button" data-area-active="${area.active ? "0" : "1"}" data-id="${escapeHTML(area.id)}"
            aria-label="${escapeHTML(t(area.active ? "admin.areas.turnOffLabel" : "admin.areas.turnOnLabel", { name: area.name }))}">${
            escapeHTML(t(area.active ? "admin.areas.turnOff" : "admin.areas.turnOn"))}</button>
        </li>`;
}

function areasSection(data: AdminData): string {
  return `
      <section class="admin-section">
        <h2>${escapeHTML(t("admin.areas.title"))} <span class="muted">(${data.areas.filter((area) => area.active).length})</span></h2>
        <p class="muted">${escapeHTML(t("admin.areas.intro"))}</p>
        <ul class="area-list">${data.areas.map(areaRow).join("")}</ul>
        <form id="area-form" class="panel form-panel">
          <h3>${escapeHTML(t("admin.areas.addTitle"))}</h3>
          <label for="area-name">${escapeHTML(t("admin.areas.name"))}</label>
          <input id="area-name" name="name" required minlength="2" maxlength="80" autocomplete="off">
          <label for="area-district">${escapeHTML(t("admin.areas.district"))}</label>
          <input id="area-district" name="district" required maxlength="80" value="${escapeHTML(t("admin.areas.districtDefault"))}" autocomplete="off">
          <button class="button secondary" type="submit">${escapeHTML(t("admin.areas.add"))}</button>
        </form>
      </section>`;
}

const filterLabel = (kind: "area" | "vehicle" | "waste", value: string | null): string => {
  if (!value || value === "all") return t(kind === "area" ? "find.areaAll" : kind === "vehicle" ? "find.vehicleAll" : "find.wasteAll");
  if (kind === "area") return value === OTHER_AREA ? t("lookup.area.other") : areaName(value);
  if (kind === "vehicle") return isVehicle(value) ? vehicleLabel(value) : value;
  return isWaste(value) ? wasteLabel(value) : value;
};

function activitySection(activity: Activity | null): string {
  if (!activity) {
    return `
      <section class="admin-section">
        <h2>${escapeHTML(t("admin.activity.title"))}</h2>
        <p class="muted">${escapeHTML(t("admin.activity.unavailable"))}</p>
      </section>`;
  }
  const total = (name: keyof Activity["totals"]) => activity.totals[name] ?? 0;
  const stat = (label: MessageKey, value: number) =>
    `<article class="stat-card"><span>${escapeHTML(t(label))}</span><strong>${value}</strong></article>`;
  const contacts = activity.contacts.length ? `
        <h3>${escapeHTML(t("admin.activity.contactsTitle"))}</h3>
        <ul class="history-list plain-list">${activity.contacts.map((row) => `
          <li><strong>${escapeHTML(row.name)}</strong>: ${escapeHTML(t("admin.activity.contactRow", { calls: row.call, whatsapp: row.whatsapp }))}</li>`).join("")}
        </ul>` : "";
  const searches = activity.no_results.length ? `
        <h3>${escapeHTML(t("admin.activity.noResultsTitle"))}</h3>
        <ul class="history-list plain-list">${activity.no_results.map((row) => `
          <li>${escapeHTML([filterLabel("area", row.area), filterLabel("vehicle", row.vehicle), filterLabel("waste", row.waste)].join(" · "))}
            <span class="muted">(${escapeHTML(t("admin.activity.times", { count: row.count }))})</span></li>`).join("")}
        </ul>` : "";
  return `
      <section class="admin-section">
        <h2>${escapeHTML(t("admin.activity.title"))}</h2>
        <p class="muted">${escapeHTML(t("admin.activity.intro", { days: activity.days }))}</p>
        <div class="stats-grid">
          ${stat("admin.activity.contacts", total("contact_tap"))}
          ${stat("admin.activity.noResults", total("search_no_results"))}
          ${stat("admin.activity.reports", total("report_submitted"))}
          ${stat("admin.activity.markedWrong", total("listing_marked_wrong"))}
        </div>${contacts}${searches}
      </section>`;
}

function section(title: MessageKey, count: number, body: string, empty: MessageKey): string {
  return `
      <section class="admin-section">
        <h2>${escapeHTML(t(title))} <span class="muted">(${count})</span></h2>
        ${count ? body : `<p class="muted">${escapeHTML(t(empty))}</p>`}
      </section>`;
}

function renderData(data: AdminData): void {
  areas = data.areas;
  shown.clear();
  [...data.queue, ...data.live, ...data.hidden].forEach((listing) =>
    shown.set(listing.id, { status: listing.status, updatedAt: listing.updated_at }));
  const cards = (listings: AdminListing[]) => listings.map(listingCard).join("");
  const decisions = data.history.length + data.closedReports.length;
  $("#admin-content").innerHTML = `
      <div class="stats-grid">
        <article class="stat-card"><span>${escapeHTML(t("admin.pending"))}</span><strong>${data.queue.length}</strong></article>
        <article class="stat-card"><span>${escapeHTML(t("admin.openReports"))}</span><strong>${data.reports.length}</strong></article>
        <article class="stat-card"><span>${escapeHTML(t("admin.live"))}</span><strong>${data.live.length}</strong></article>
      </div>
      ${section("admin.queueTitle", data.queue.length, cards(data.queue), "admin.queueEmpty")}
      ${section("admin.reportsTitle", data.reports.length, data.reports.map(reportCard).join(""), "admin.reportsEmpty")}
      ${section("admin.liveTitle", data.live.length, cards(data.live), "admin.liveEmpty")}
      ${section("admin.hiddenTitle", data.hidden.length, cards(data.hidden), "admin.hiddenEmpty")}
      ${section("admin.historyTitle", decisions, historyList(data), "admin.historyEmpty")}
      ${areasSection(data)}
      ${activitySection(data.activity)}
      <button class="button secondary full-width" type="button" id="admin-refresh">${escapeHTML(t("admin.refresh"))}</button>`;
}

function message(key: MessageKey, action?: { id: string; label: MessageKey }): void {
  $("#admin-content").innerHTML = `
      <div class="notice">
        <p>${escapeHTML(t(key))}</p>
        ${action ? `<button class="button secondary" type="button" id="${action.id}">${escapeHTML(t(action.label))}</button>` : ""}
      </div>`;
}

const FAILURES: Record<Failure, MessageKey> = {
  offline: "admin.error.offline",
  "signed-out": "admin.error.signedOut",
  failed: "admin.error.failed"
};

let renderToken = 0;

// Empties the screen, so on a shared phone the next person never sees the
// last admin's dashboard.
export function clearAdmin(): void {
  renderToken++;
  shown.clear();
  codeEmail = "";
  $("#admin-content").innerHTML = "";
}

export async function renderAdmin(): Promise<void> {
  const token = ++renderToken;
  $("#admin-content").innerHTML = `<p class="muted">${escapeHTML(t("join.loading"))}</p>`;
  const session = await currentSession();
  if (token !== renderToken) return;
  if (!session) {
    showEmailSignIn();
    return;
  }
  try {
    if (!(await isAdmin(session))) {
      if (token === renderToken) message("admin.notAdmin");
      return;
    }
    const data = await loadData(session);
    if (token === renderToken) renderData(data);
  } catch (failure) {
    if (token !== renderToken) return;
    const key = FAILURES[(failure as Failure)] ?? "admin.error.failed";
    message(key, failure === "signed-out" ? { id: "admin-sign-in", label: "join.signin.verify" } : { id: "admin-refresh", label: "join.retry" });
  }
}

// Email sign-in ----------------------------------------------------------------------
// Until SMS codes are switched on, an admin signs in with a code sent to an
// email address the project owner has set up in Supabase. Collectors still
// sign in with their phone.

// The address a code was sent to; empty while the address is being asked for.
let codeEmail = "";

const EMAIL_ERRORS: Record<Exclude<AuthResult, "ok">, MessageKey> = {
  unavailable: "join.signin.error.unavailable",
  offline: "join.signin.error.offline",
  invalid: "admin.email.error.invalid",
  "rate-limited": "join.signin.error.rateLimited",
  captcha: "join.signin.error.captcha",
  failed: "join.signin.error.failed"
};

function showEmailSignIn(): void {
  const sent = Boolean(codeEmail);
  const text = (key: MessageKey, vars?: Record<string, string>) => escapeHTML(t(key, vars));
  $("#admin-content").innerHTML = `
      <div class="notice"><p>${text("admin.signInFirst")}</p></div>
      <div class="panel form-panel">
        <form id="admin-email-form"${sent ? " hidden" : ""}>
          <h2>${text("admin.email.title")}</h2>
          <p>${text("admin.email.body")}</p>
          <label for="admin-email">${text("admin.email.label")}</label>
          <input id="admin-email" name="email" type="email" autocomplete="email" required maxlength="254">
          <div id="admin-captcha"></div>
          <button id="admin-email-send" class="button primary" type="submit">${text("join.signin.send")}</button>
        </form>
        <form id="admin-code-form"${sent ? "" : " hidden"}>
          <h2>${text("join.signin.codeTitle")}</h2>
          <p>${text("admin.email.codeSent", { email: codeEmail })}</p>
          <label for="admin-code">${text("admin.email.code")}</label>
          <input id="admin-code" name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{6,10}" maxlength="10">
          <button id="admin-code-verify" class="button primary" type="submit">${text("join.signin.verify")}</button>
          <button id="admin-email-change" class="text-button" type="button">${text("admin.email.change")}</button>
        </form>
        <div id="admin-signin-feedback" class="feedback" role="status" hidden></div>
      </div>
      <button class="button secondary full-width" type="button" id="admin-sign-in">${text("admin.phoneInstead")}</button>`;
  if (!sent && captchaEnabled) void showCaptcha($("#admin-captcha"));
}

function signInFeedback(key: MessageKey | null): void {
  const box = document.querySelector<HTMLElement>("#admin-signin-feedback");
  if (!box) return;
  box.hidden = !key;
  box.textContent = key ? t(key) : "";
}

async function handleEmail(): Promise<void> {
  const input = $<HTMLInputElement>("#admin-email");
  const email = normaliseEmail(input.value);
  if (!email) {
    signInFeedback("admin.email.error.email");
    input.focus();
    return;
  }
  const result = await busy($<HTMLButtonElement>("#admin-email-send"), "join.signin.sending", async () => {
    if (!captchaEnabled) return requestEmailCode(email);
    const captchaToken = await takeCaptchaToken();
    return captchaToken ? requestEmailCode(email, captchaToken) : "captcha-wait";
  });
  // The person may have left the screen while the code was being sent.
  if (!document.querySelector("#admin-email-form")) return;
  if (result === "captcha-wait") return signInFeedback("join.signin.error.captchaWait");
  if (result !== "ok") return signInFeedback(EMAIL_ERRORS[result]);
  codeEmail = email;
  showEmailSignIn();
  $("#admin-code").focus();
}

async function handleEmailCode(form: HTMLFormElement): Promise<void> {
  if (!form.reportValidity()) return;
  const code = $<HTMLInputElement>("#admin-code").value.trim();
  const result = await busy($<HTMLButtonElement>("#admin-code-verify"), "join.signin.checking",
    () => verifyEmailCode(codeEmail, code));
  if (!document.querySelector("#admin-code-form")) return;
  if (result !== "ok") return signInFeedback(result === "invalid" ? "join.signin.error.invalidCode" : EMAIL_ERRORS[result]);
  codeEmail = "";
  await renderAdmin();
}

function changeEmail(): void {
  codeEmail = "";
  showEmailSignIn();
  $("#admin-email").focus();
}

// Decisions ------------------------------------------------------------------------

const DONE: Record<Decision, MessageKey> = {
  approved: "admin.done.approved",
  rejected: "admin.done.rejected",
  suspended: "admin.done.suspended"
};

const ACTION_ERRORS: Record<Exclude<ActionResult, "ok">, MessageKey> = {
  offline: "admin.error.offline",
  unknown: "admin.error.unknown",
  "signed-out": "admin.error.signedOut",
  refused: "admin.error.refused",
  stale: "admin.error.stale",
  exists: "admin.areas.exists"
};

function openDecision(button: HTMLElement): void {
  const id = button.dataset.id ?? "";
  const status = button.dataset.decide as ListingStatus;
  const box = document.querySelector<HTMLElement>(`[data-decision-for="${CSS.escape(id)}"]`);
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `
        <form class="decision-form" data-status="${escapeHTML(status)}" data-id="${escapeHTML(id)}">
          <label for="reason-${escapeHTML(id)}">${escapeHTML(t(`admin.reasonFor.${status}` as MessageKey, { name: button.dataset.name ?? "" }))}</label>
          <textarea id="reason-${escapeHTML(id)}" name="reason" required minlength="3" maxlength="500" rows="2"></textarea>
          <p class="small-note">${escapeHTML(t("admin.reasonShown"))}</p>
          <div class="card-actions">
            <button class="button primary" type="submit">${escapeHTML(t("admin.confirm"))}</button>
            <button class="button secondary" type="button" data-cancel-decision>${escapeHTML(t("admin.cancel"))}</button>
          </div>
        </form>`;
  box.querySelector("textarea")?.focus();
}

let acting = false;

// One decision at a time, with every button disabled while it is sent.
async function act(task: (session: Session) => Promise<ActionResult>, done: MessageKey, after?: () => void): Promise<void> {
  if (acting) return;
  acting = true;
  const content = $("#admin-content");
  const buttons = [...content.querySelectorAll<HTMLButtonElement>("button")];
  content.setAttribute("aria-busy", "true");
  buttons.forEach((button) => { button.disabled = true; });
  let result: ActionResult = "unknown";
  try {
    const session = await currentSession();
    result = session ? await task(session) : "signed-out";
  } finally {
    acting = false;
    content.removeAttribute("aria-busy");
    buttons.forEach((button) => { button.disabled = false; });
  }
  toast(t(result === "ok" ? done : ACTION_ERRORS[result]));
  // Keep what was typed when the area is already on the list.
  if (result === "exists") return;
  // Show the latest state whenever the outcome isn't simply "not sent".
  if (result !== "offline" && result !== "signed-out") await renderAdmin();
  if (result === "ok") after?.();
}

export function bindAdmin(): void {
  const content = $("#admin-content");
  content.addEventListener("click", (event) => {
    const target = event.target as Element;
    const decide = target.closest<HTMLElement>("[data-decide]");
    if (decide) return openDecision(decide);
    if (target.closest("[data-cancel-decision]")) {
      const box = target.closest<HTMLElement>(".decision");
      if (box) { box.hidden = true; box.innerHTML = ""; }
      return;
    }
    const close = target.closest<HTMLElement>("[data-close-report]");
    if (close) {
      const id = close.dataset.id ?? "";
      const status = close.dataset.closeReport as "resolved" | "dismissed";
      const note = document.querySelector<HTMLInputElement>(`[data-note-for="${CSS.escape(id)}"]`)?.value.trim() ?? "";
      void act((session) => closeReport(session, id, status, note), status === "resolved" ? "admin.done.resolved" : "admin.done.dismissed");
      return;
    }
    const reopen = target.closest<HTMLElement>("[data-reopen-report]");
    if (reopen) {
      const id = reopen.dataset.id ?? "";
      void act((session) => reopenReport(session, id), "admin.done.reopened");
      return;
    }
    const areaToggle = target.closest<HTMLElement>("[data-area-active]");
    if (areaToggle) {
      const id = areaToggle.dataset.id ?? "";
      const active = areaToggle.dataset.areaActive === "1";
      void act((session) => setAreaActive(session, id, active), active ? "admin.areas.turnedOn" : "admin.areas.turnedOff",
        () => void refreshLookups());
      return;
    }
    if (target.closest("#admin-refresh")) void renderAdmin();
    if (target.closest("#admin-email-change")) changeEmail();
    if (target.closest("#admin-sign-in")) signInThen("admin");
  });
  content.addEventListener("submit", (event) => {
    const signInForm = (event.target as Element).closest<HTMLFormElement>("#admin-email-form, #admin-code-form");
    if (signInForm) {
      event.preventDefault();
      void (signInForm.id === "admin-email-form" ? handleEmail() : handleEmailCode(signInForm));
      return;
    }
    const areaForm = (event.target as Element).closest<HTMLFormElement>("#area-form");
    if (areaForm) {
      event.preventDefault();
      const fields = new FormData(areaForm);
      const name = String(fields.get("name") ?? "").trim().replace(/\s+/g, " ");
      const district = String(fields.get("district") ?? "").trim();
      const input = areaForm.querySelector<HTMLInputElement>("#area-name");
      if (!areaId(name) || !district) {
        input?.setCustomValidity(t("admin.areas.nameNeeded"));
        input?.reportValidity();
        return;
      }
      void act((session) => addArea(session, name, district), "admin.areas.added", () => void refreshLookups());
      return;
    }
    const form = (event.target as Element).closest<HTMLFormElement>(".decision-form");
    if (!form) return;
    event.preventDefault();
    const reason = String(new FormData(form).get("reason") ?? "").trim();
    const textarea = form.querySelector("textarea");
    if (reason.length < 3) {
      textarea?.setCustomValidity(t("admin.reasonNeeded"));
      textarea?.reportValidity();
      return;
    }
    textarea?.setCustomValidity("");
    const status = form.dataset.status as Decision;
    const id = form.dataset.id ?? "";
    // Residents' phones show the change the next time they load listings; this one now.
    void act((session) => setStatus(session, id, status, reason), DONE[status], () => void reloadListings());
  });
  content.addEventListener("input", (event) => {
    const field = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (field.matches(".decision-form textarea, #area-name")) field.setCustomValidity("");
  });
}
