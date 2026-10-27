// The admin screen: review queue, live listings, reports and history. Admins
// sign in with the same phone code as collectors. The database decides what
// an admin may do (RLS and set_collector_status); this screen only shows it.
import { t, type MessageKey } from "./i18n";
import { isVehicle, isReportType, isWaste, reportTypeLabel, vehicleLabel, wasteLabel } from "./data/lookups";
import { call } from "./api";
import { currentSession, type Session } from "./auth";
import { fetchAreas, type Area, type ListingStatus } from "./collector";
import { signInThen } from "./join";
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
  reports: AdminReport[];
  history: AuditRow[];
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

async function loadData(session: Session): Promise<AdminData> {
  const [queue, live, reports, history] = await Promise.all([
    // Oldest first, so nobody waits longest.
    getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&status=eq.submitted&order=updated_at.asc`),
    getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&status=eq.approved&order=name.asc`),
    getJSON<AdminReport[]>(session, "reports?select=id,type,message,created_at,collectors(name)&status=eq.open&order=created_at.asc"),
    getJSON<AuditRow[]>(session, "audit_log?select=id,from_status,to_status,reason,created_at,collectors(name)&order=id.desc&limit=30")
  ]);
  return { queue, live, reports, history };
}

// "offline": never sent, so nothing changed. "unknown": sent but no clear
// answer (a timeout or a server error), so it may have gone through. "stale":
// someone else changed it first.
type ActionResult = "ok" | "offline" | "unknown" | "signed-out" | "refused" | "stale";

async function send(session: Session, path: string, init: RequestInit, prefer = "return=minimal"): Promise<[ActionResult, Response | null]> {
  if (!navigator.onLine) return ["offline", null];
  try {
    const response = await call(`rest/v1/${path}`, { ...init, headers: { Prefer: prefer } }, session.accessToken);
    if (response.ok) return ["ok", response];
    if (response.status === 401) return ["signed-out", null];
    return [response.status >= 500 ? "unknown" : "refused", null];
  } catch {
    return ["unknown", null];
  }
}

// What the admin saw when they opened a decision, to catch edits made since.
const shown = new Map<string, string>();
const snapshot = (listing: AdminListing): string => JSON.stringify([
  listing.status, listing.updated_at, listing.name, listing.vehicle_type, listing.description, listing.consent_at !== null,
  contactOf(listing), listing.collector_areas, listing.collector_waste_types
]);

// set_collector_status doesn't know which version the admin reviewed, so the
// listing is fetched again first and the decision stops if it has changed.
async function setStatus(session: Session, id: string, status: ListingStatus, reason: string): Promise<ActionResult> {
  try {
    const current = await getJSON<AdminListing[]>(session, `collectors?select=${LISTING_FIELDS}&id=eq.${encodeURIComponent(id)}`);
    if (!current[0] || snapshot(current[0]) !== shown.get(id)) return "stale";
  } catch (failure) {
    return failure === "signed-out" ? "signed-out" : failure === "offline" ? "offline" : "unknown";
  }
  const [result] = await send(session, "rpc/set_collector_status", {
    method: "POST",
    body: JSON.stringify({ p_collector: id, p_status: status, p_reason: reason })
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

// Rendering ------------------------------------------------------------------------

let areas: Area[] = [];
const areaName = (id: string): string => areas.find((area) => area.id === id)?.name ?? id;
const when = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const contactOf = (listing: AdminListing): Contact | null =>
  Array.isArray(listing.collector_contacts) ? listing.collector_contacts[0] ?? null : listing.collector_contacts;

const row = (label: string, value: string) =>
  `<div class="detail-row"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(value)}</p></div>`;

// The decisions offered for each list, with the status each one sets.
const DECISIONS: Record<"queue" | "live", { status: ListingStatus; label: MessageKey; style: string }[]> = {
  queue: [
    { status: "approved", label: "admin.approve", style: "primary" },
    { status: "rejected", label: "admin.reject", style: "secondary" }
  ],
  live: [{ status: "suspended", label: "admin.suspend", style: "secondary" }]
};

function listingCard(listing: AdminListing, list: "queue" | "live"): string {
  const contact = contactOf(listing);
  const waste = listing.collector_waste_types.map((link) => link.waste_type_id).filter(isWaste).map(wasteLabel);
  const buttons = DECISIONS[list].map((decision) => `
          <button class="button ${decision.style}" type="button" data-decide="${decision.status}"
            data-id="${escapeHTML(listing.id)}" data-name="${escapeHTML(listing.name)}">${escapeHTML(t(decision.label))}</button>`).join("");
  return `
      <article class="panel admin-card">
        <h3>${escapeHTML(listing.name)}</h3>
        <p class="muted">${escapeHTML(t("admin.updated", { date: when(listing.updated_at) }))}</p>
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

function section(title: MessageKey, count: number, body: string, empty: MessageKey): string {
  return `
      <section class="admin-section">
        <h2>${escapeHTML(t(title))} <span class="muted">(${count})</span></h2>
        ${count ? body : `<p class="muted">${escapeHTML(t(empty))}</p>`}
      </section>`;
}

function renderData(data: AdminData): void {
  shown.clear();
  [...data.queue, ...data.live].forEach((listing) => shown.set(listing.id, snapshot(listing)));
  $("#admin-content").innerHTML = `
      <div class="stats-grid">
        <article class="stat-card"><span>${escapeHTML(t("admin.pending"))}</span><strong>${data.queue.length}</strong></article>
        <article class="stat-card"><span>${escapeHTML(t("admin.openReports"))}</span><strong>${data.reports.length}</strong></article>
        <article class="stat-card"><span>${escapeHTML(t("admin.live"))}</span><strong>${data.live.length}</strong></article>
      </div>
      ${section("admin.queueTitle", data.queue.length, data.queue.map((listing) => listingCard(listing, "queue")).join(""), "admin.queueEmpty")}
      ${section("admin.reportsTitle", data.reports.length, data.reports.map(reportCard).join(""), "admin.reportsEmpty")}
      ${section("admin.liveTitle", data.live.length, data.live.map((listing) => listingCard(listing, "live")).join(""), "admin.liveEmpty")}
      ${section("admin.historyTitle", data.history.length, `<ul class="history-list">${data.history.map(historyItem).join("")}</ul>`, "admin.historyEmpty")}
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
  $("#admin-content").innerHTML = "";
}

export async function renderAdmin(): Promise<void> {
  const token = ++renderToken;
  $("#admin-content").innerHTML = `<p class="muted">${escapeHTML(t("join.loading"))}</p>`;
  const session = await currentSession();
  if (token !== renderToken) return;
  if (!session) {
    message("admin.signInFirst", { id: "admin-sign-in", label: "join.signin.verify" });
    return;
  }
  try {
    if (!(await isAdmin(session))) {
      if (token === renderToken) message("admin.notAdmin");
      return;
    }
    if (!areas.length) {
      const result = await fetchAreas();
      if (result.ok) areas = result.value;
    }
    const data = await loadData(session);
    if (token === renderToken) renderData(data);
  } catch (failure) {
    if (token !== renderToken) return;
    const key = FAILURES[(failure as Failure)] ?? "admin.error.failed";
    message(key, failure === "signed-out" ? { id: "admin-sign-in", label: "join.signin.verify" } : { id: "admin-refresh", label: "join.retry" });
  }
}

// Decisions ------------------------------------------------------------------------

type Decision = "approved" | "rejected" | "suspended";

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
  stale: "admin.error.stale"
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
async function act(task: (session: Session) => Promise<ActionResult>, done: MessageKey): Promise<void> {
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
  // Show the latest state whenever the outcome isn't simply "not sent".
  if (result !== "offline" && result !== "signed-out") await renderAdmin();
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
    if (target.closest("#admin-refresh")) void renderAdmin();
    if (target.closest("#admin-sign-in")) signInThen("admin");
  });
  content.addEventListener("submit", (event) => {
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
    void act((session) => setStatus(session, id, status, reason), DONE[status]);
  });
  content.addEventListener("input", (event) => {
    if ((event.target as Element).matches(".decision-form textarea")) (event.target as HTMLTextAreaElement).setCustomValidity("");
  });
}
