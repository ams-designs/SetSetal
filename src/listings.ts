import { t, plural, formatDate, type MessageKey } from "./i18n";
import {
  OTHER_AREA, areaLabel, areas, isVehicle, isWaste, vehicleLabel, vehicles, wasteLabel, wasteTypes,
  type Area, type VehicleId, type WasteId
} from "./data/lookups";
import { backendConfigured, fetchPublicCollectors, type PublicCollectorRow } from "./api";
import { resetNoResults, trackNoResults } from "./analytics";
import { icon, vehiclePicture, wastePicture } from "./icons";
import { $, escapeHTML } from "./ui";

interface Collector {
  id: string;
  vehicle: VehicleId;
  area: string;
  waste: WasteId[];
}

// What the Find and profile screens show: either every demonstration listing
// or every real one, never a mix (product rule 1).
export interface Listing {
  id: string;
  demo: boolean;
  vehicle: VehicleId;
  areas: string[];
  waste: WasteId[];
  // Real listings only. Demo text comes from the translation files.
  name: string;
  description: string;
  // Present only when the listing is approved and the collector consented;
  // the server leaves them out otherwise (product rule 2).
  phone: string | null;
  whatsapp: string | null;
  // The collector has said they are working today. Real listings only.
  availableToday: boolean;
}

// The towns the demonstration listings use. They are part of the samples, not
// the list of areas SetSetal serves: that comes from the database.
const DEMO_AREAS: Area[] = [
  { id: "banjul", name: "Banjul" },
  { id: "bakau", name: "Bakau" },
  { id: "kanifing", name: "Kanifing" },
  { id: "serrekunda", name: "Serrekunda" },
  { id: "brikama", name: "Brikama" }
];

// These are demonstration records, not real or verified businesses. Every
// card and profile shows the "Demonstration listing" label while they are used.
// Their names and descriptions live in the translation files (demo.<id>.*).
export const sampleCollectors: Collector[] = [
  {
    id: "demo-municipal",
    vehicle: "municipal-truck",
    area: "banjul",
    waste: ["household", "business"]
  },
  {
    id: "demo-truck",
    vehicle: "private-truck",
    area: "serrekunda",
    waste: ["household", "garden", "bulky"]
  },
  {
    id: "demo-van",
    vehicle: "small-van",
    area: "kanifing",
    waste: ["household", "recyclables"]
  },
  {
    id: "demo-tricycle",
    vehicle: "tricycle",
    area: "bakau",
    waste: ["household", "garden"]
  },
  {
    id: "demo-donkey",
    vehicle: "donkey-cart",
    area: "brikama",
    waste: ["household", "garden"]
  },
  {
    id: "demo-horse",
    vehicle: "horse-cart",
    area: "brikama",
    waste: ["household", "garden"]
  }
];

export const iconFor = (vehicle: VehicleId): string => vehiclePicture(vehicle);

const E164 = /^\+[1-9][0-9]{6,14}$/;
const CACHE_KEY = "setsetal.listings.v2";
const HOUR = 60 * 60 * 1000;
// Saved listings expire, so a suspension or withdrawn consent reaches phones
// that stay offline: contact details after 48 hours, everything after 7 days.
const CONTACT_MAX_AGE = 48 * HOUR;
const CACHE_MAX_AGE = 7 * 24 * HOUR;
// "Collecting today" is true only on the day it was saved (UTC, which is
// Gambian time).
const sameDay = (a: number, b: number): boolean =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

interface SavedListings {
  savedAt: number;
  rows: PublicCollectorRow[];
}

const demoListings = (): Listing[] => sampleCollectors.map((collector) => ({
  id: collector.id,
  demo: true,
  vehicle: collector.vehicle,
  areas: [collector.area],
  waste: collector.waste,
  name: "",
  description: "",
  phone: null,
  whatsapp: null,
  availableToday: false
}));

function fromRow(row: PublicCollectorRow): Listing | null {
  if (!row.id || !row.name || !row.vehicle_type || !isVehicle(row.vehicle_type)) return null;
  return {
    id: row.id,
    demo: false,
    vehicle: row.vehicle_type,
    areas: row.areas ?? [],
    waste: (row.waste_types ?? []).filter(isWaste),
    name: row.name,
    description: row.description ?? "",
    phone: row.phone && E164.test(row.phone) ? row.phone : null,
    whatsapp: row.whatsapp && E164.test(row.whatsapp) ? row.whatsapp : null,
    availableToday: row.available_today === true
  };
}

let listings: Listing[] = demoListings();
// True until the first answer from the server (or the cache) arrives.
let pending = backendConfigured;
// When the listings on screen came from the cache rather than the server.
let savedAt: number | null = null;

export const listingsPending = (): boolean => pending;
export const listingsSavedAt = (): number | null => savedAt;

function useRows(rows: PublicCollectorRow[], options: { withoutContacts?: boolean; withoutAvailability?: boolean } = {}): void {
  const real = rows.map(fromRow).filter((listing): listing is Listing => listing !== null);
  if (options.withoutContacts) real.forEach((listing) => { listing.phone = null; listing.whatsapp = null; });
  if (options.withoutAvailability) real.forEach((listing) => { listing.availableToday = false; });
  // Collectors working today come first, then by name. Never by anything paid
  // (product rule 5).
  real.sort((a, b) => Number(b.availableToday) - Number(a.availableToday) || a.name.localeCompare(b.name));
  listings = real.length ? real : demoListings();
  pending = false;
}

function readCache(): SavedListings | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as SavedListings | null;
    if (!saved || typeof saved.savedAt !== "number" || !Array.isArray(saved.rows)) return null;
    return Date.now() - saved.savedAt < CACHE_MAX_AGE ? saved : null;
  } catch {
    return null;
  }
}

function writeCache(rows: PublicCollectorRow[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows } satisfies SavedListings));
  } catch {
    // Storage can be full or blocked; the next visit fetches again.
  }
}

// Shows the last saved listings straight away, then asks the server. Offline,
// or if the request fails, whatever was shown stays: saved real listings, or
// the labelled demonstrations.
let listingsChanged: () => void = () => {};

// Asks the server again, for example after a collector changes their own
// listing, so the Find screen on this phone shows it straight away.
export const reloadListings = (): Promise<void> => loadListings(listingsChanged);

export async function loadListings(onChange: () => void): Promise<void> {
  listingsChanged = onChange;
  if (!backendConfigured) return;
  const cached = readCache();
  if (cached) {
    useRows(cached.rows, {
      withoutContacts: Date.now() - cached.savedAt >= CONTACT_MAX_AGE,
      withoutAvailability: !sameDay(cached.savedAt, Date.now())
    });
    savedAt = cached.savedAt;
    onChange();
  }
  if (!navigator.onLine) {
    pending = false;
    onChange();
    return;
  }
  try {
    const rows = await fetchPublicCollectors();
    writeCache(rows);
    useRows(rows);
    savedAt = null;
  } catch {
    pending = false;
  }
  onChange();
}

export const showingDemos = (): boolean => listings.some((listing) => listing.demo);

export const findCollector = (id: string | null): Listing | undefined =>
  listings.find((listing) => listing.id === id);

export const nameOf = (listing: Listing): string =>
  listing.demo ? t(`demo.${listing.id}.name` as MessageKey) : listing.name;
const descriptionOf = (listing: Listing): string =>
  listing.demo ? t(`demo.${listing.id}.description` as MessageKey) : listing.description;
const areaName = (listing: Listing, id: string): string =>
  (listing.demo ? DEMO_AREAS.find((area) => area.id === id)?.name : undefined) ?? areaLabel(id);
const areaList = (listing: Listing): string => listing.areas.map((id) => areaName(listing, id)).join(", ");


const optionsHTML = (items: { value: string; label: string }[]): string =>
  items.map(({ value, label }) =>
    `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`
  ).join("");

// Replaces a select's options, keeping the placeholder options from
// index.html (the ones with a data-i18n key) and the current choice when it is
// still offered.
export function fillSelect(select: HTMLSelectElement, items: { value: string; label: string }[]): void {
  const chosen = select.value;
  [...select.options].filter((option) => !option.dataset.i18n).forEach((option) => option.remove());
  select.insertAdjacentHTML("beforeend", optionsHTML(items));
  if ([...select.options].some((option) => option.value === chosen)) select.value = chosen;
}

// The areas the Find filter offers: the samples' towns while demonstrations
// are shown; otherwise the database's list, or (if that hasn't loaded) the
// areas the listings themselves name.
function areaChoices(): Area[] {
  if (showingDemos()) return DEMO_AREAS;
  if (areas().length) return areas();
  const ids = [...new Set(listings.flatMap((listing) => listing.areas))];
  return ids.map((id) => ({ id, name: areaLabel(id) })).sort((a, b) => a.name.localeCompare(b.name));
}

export const vehicleOptions = () => vehicles().map((id) => ({ value: id, label: vehicleLabel(id) }));
export const wasteOptions = () => wasteTypes().map((id) => ({ value: id, label: wasteLabel(id) }));

// What the resident has chosen on Find. Picking is a tap on a tile, and the
// list changes straight away: there is no form to fill in first. There is no
// waste-type filter (decided 26 Nov 2026); each card shows what it takes.
const filters = { area: "all", vehicle: "all" };

function matches(listing: Listing): boolean {
  return (filters.area === "all" || listing.areas.includes(filters.area)) &&
    (filters.vehicle === "all" || listing.vehicle === filters.vehicle);
}

const chosenAreaName = (id: string): string =>
  id === "all" ? t("find.areaAll") : id === OTHER_AREA ? t("find.areaOther") :
    areaChoices().find((area) => area.id === id)?.name ?? areaLabel(id);

const demoLabel = (listing: Listing): string =>
  listing.demo ? `<span class="demo-label">${escapeHTML(t("listing.demoLabel"))}</span>` : "";
// The collector's own word that they are working today; SetSetal hasn't
// checked it, and the label says so on the profile.
const todayLabel = (listing: Listing): string =>
  listing.availableToday
    ? `<span class="today-label">${icon("sun")}${escapeHTML(t("listing.availableToday"))}</span>`
    : "";

const wastePictures = (waste: readonly WasteId[]): string => `
          <ul class="waste-list" aria-label="${escapeHTML(t("listing.takes"))}">${waste.map((id) => `
            <li>${wastePicture(id)}<span>${escapeHTML(wasteLabel(id))}</span></li>`).join("")}
          </ul>`;

// wa.me takes the number without the leading +. The message is only a
// suggestion the resident can change before sending.
const whatsappHref = (number: string): string =>
  `https://wa.me/${escapeHTML(number.slice(1))}?text=${escapeHTML(encodeURIComponent(t("profile.whatsappText")))}`;

// Call and WhatsApp sit on the card itself, under the same rule as the
// profile: only for an approved listing whose collector agreed (product rule
// 2). The server leaves the numbers out otherwise.
function contactButtons(listing: Listing, where: "card" | "profile"): string {
  if (listing.demo || (!listing.phone && !listing.whatsapp)) {
    const key = listing.demo ? "listing.demoNoContact" : "listing.noContact";
    return `
          <p class="no-contact">${icon("noPhone")}<span>${escapeHTML(t(key))}</span></p>`;
  }
  const name = nameOf(listing);
  const id = escapeHTML(listing.id);
  const onlyWhatsapp = !listing.phone;
  const call = listing.phone ? `
            <a class="button primary call-button" href="tel:${escapeHTML(listing.phone)}" data-contact="call" data-id="${id}"
              aria-label="${escapeHTML(t("profile.callLabel", { name }))}">${icon("phone")}<span>${escapeHTML(t("profile.call"))}</span></a>` : "";
  const whatsapp = listing.whatsapp ? `
            <a class="button secondary whatsapp-button${onlyWhatsapp || where === "profile" ? "" : " icon-only"}" href="${whatsappHref(listing.whatsapp)}"
              target="_blank" rel="noopener" data-contact="whatsapp" data-id="${id}"
              aria-label="${escapeHTML(t("profile.whatsappLabel", { name }))}">${icon("message")}<span>${escapeHTML(t("profile.whatsapp"))}</span></a>` : "";
  return `
          <div class="contact-buttons contact-${where}">${call}${whatsapp}
          </div>`;
}

function collectorCard(listing: Listing): string {
  const name = nameOf(listing);
  return `
      <article class="collector-card">
        <div class="card-head">
          <div class="card-picture">${iconFor(listing.vehicle)}</div>
          <div class="card-info">
            <h3><button class="card-link" type="button" data-profile="${escapeHTML(listing.id)}">${escapeHTML(name)}</button></h3>
            <p class="card-area">${icon("pin")}<span>${escapeHTML(areaList(listing))}</span></p>
            ${todayLabel(listing)}${demoLabel(listing)}
          </div>
          ${icon("chevron", "icon card-chevron")}
        </div>${wastePictures(listing.waste)}${contactButtons(listing, "card")}
      </article>`;
}

function emptyState(otherArea: boolean, demo: boolean): string {
  if (otherArea) {
    return `<div class="empty-state">
          <h3>${escapeHTML(t("find.empty.otherArea.title"))}</h3>
          <p>${escapeHTML(t("find.empty.otherArea.body"))}</p>
          <button class="button primary" type="button" data-go="help">${escapeHTML(t("find.empty.otherArea.cta"))}</button>
        </div>`;
  }
  return `<div class="empty-state">
          <h3>${escapeHTML(t(demo ? "find.empty.title" : "find.empty.titleReal"))}</h3>
          <p>${escapeHTML(t("find.empty.body"))}</p>
          <button class="button secondary" type="button" data-show-all>${escapeHTML(t("find.showAll"))}</button>
        </div>`;
}

const tile = (value: string, label: string, chosen: boolean, extraClass = ""): string => `
          <button class="area-tile${extraClass}" type="button" data-area="${escapeHTML(value)}" aria-pressed="${chosen}">
            ${chosen ? icon("check") : ""}<span>${escapeHTML(label)}</span>
          </button>`;

// Runs at start-up and again whenever the lists or the listings change. A
// choice that is no longer offered goes back to "all".
export function populateFilters(): void {
  const choices = areaChoices();
  if (filters.area !== "all" && filters.area !== OTHER_AREA && !choices.some((area) => area.id === filters.area)) {
    filters.area = "all";
  }
  if (filters.vehicle !== "all" && !vehicles().includes(filters.vehicle as VehicleId)) filters.vehicle = "all";

  $("#area-current").textContent = chosenAreaName(filters.area);
  $("#area-tiles").innerHTML = [
    tile("all", t("find.areaAll"), filters.area === "all"),
    ...choices.map((area) => tile(area.id, area.name, filters.area === area.id)),
    tile(OTHER_AREA, t("find.areaOther"), filters.area === OTHER_AREA, " area-tile-other")
  ].join("");

  $("#vehicle-chips").innerHTML = [
    { value: "all", label: t("find.vehicleAll"), picture: icon("all", "picture all-picture") },
    ...vehicles().map((id) => ({ value: id, label: vehicleLabel(id), picture: vehiclePicture(id) }))
  ].map(({ value, label, picture }) => `
        <button class="vehicle-chip" type="button" data-vehicle="${escapeHTML(value)}" aria-pressed="${filters.vehicle === value}">
          ${picture}<span>${escapeHTML(label)}</span>
        </button>`).join("");
}

export function clearFilters(): void {
  filters.area = "all";
  filters.vehicle = "all";
  populateFilters();
}

export function setAreaFilter(id: string): void {
  filters.area = id;
  populateFilters();
}

export function setVehicleFilter(id: string): void {
  filters.vehicle = id;
  populateFilters();
}

// "searched" is true when the resident changed a choice, so a search that
// finds nothing is counted once and not on every redraw.
export function renderCollectors(options: { searched?: boolean } = {}): void {
  if (pending) {
    $("#results-count").textContent = t("find.loading");
    $("#collector-results").innerHTML = "";
    return;
  }
  const results = filters.area === OTHER_AREA ? [] : listings.filter(matches);
  const demo = listings.some((listing) => listing.demo);

  const count = plural(demo ? "find.count" : "find.countReal", results.length);
  $("#results-count").textContent = savedAt ? `${count} · ${savedNote()}` : count;
  $("#collector-results").innerHTML = results.length
    ? results.map(collectorCard).join("")
    : emptyState(filters.area === OTHER_AREA, demo);
  // Only searches of real listings say anything about what is missing. A
  // search that finds something starts the count afresh, so the same empty
  // search tried again later is counted again.
  if (options.searched && !demo) {
    if (results.length === 0) trackNoResults({ ...filters, waste: "all" });
    else resetNoResults();
  }
}

const savedNote = (): string => t("listing.savedNote", { date: formatDate(savedAt ?? Date.now()) });

function contactSection(listing: Listing): string {
  if (listing.demo) {
    return `
        <div class="notice">
          <strong>${escapeHTML(t("profile.noContact.title"))}</strong>
          <p>${escapeHTML(t("profile.noContact.body"))}</p>
        </div>`;
  }
  if (!listing.phone && !listing.whatsapp) {
    return `
        <div class="notice">
          <strong>${escapeHTML(t("profile.noContactReal.title"))}</strong>
          <p>${escapeHTML(t("profile.noContactReal.body"))}</p>
        </div>`;
  }
  return `${contactButtons(listing, "profile")}
        <p class="small-note">${escapeHTML(t("profile.contactNote"))}</p>`;
}

const savedLine = (listing: Listing): string =>
  savedAt && !listing.demo ? `<p class="small-note">${escapeHTML(savedNote())}</p>` : "";

export function renderProfile(id: string | null): void {
  const collector = findCollector(id);
  if (!collector) {
    $("#profile-content").innerHTML = pending
      ? `<p class="muted">${escapeHTML(t("profile.loading"))}</p>`
      : "";
    return;
  }

  const about = descriptionOf(collector);
  $("#profile-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-picture">${vehiclePicture(collector.vehicle)}<span>${escapeHTML(vehicleLabel(collector.vehicle))}</span></div>
        <h2>${escapeHTML(nameOf(collector))}</h2>
        <div class="profile-labels">${todayLabel(collector)}${demoLabel(collector)}</div>${
          collector.availableToday ? `
        <p class="small-note">${escapeHTML(t("profile.availableNote"))}</p>` : ""}
        <p class="card-area profile-area">${icon("pin")}<span>${escapeHTML(areaList(collector))}</span></p>
        ${wastePictures(collector.waste)}${about ? `
        <div class="detail-row profile-about"><strong>${escapeHTML(t("profile.about"))}</strong><p>${escapeHTML(about)}</p></div>` : ""}${
          contactSection(collector)}${savedLine(collector)}
      </article>${collector.demo ? "" : `
      <button class="button secondary full-width report-button" type="button"
        data-report="${escapeHTML(collector.id)}">${icon("flag")}<span>${escapeHTML(t("profile.report"))}</span></button>`}`;
}
