import { t, plural, formatDate, type MessageKey } from "./i18n";
import {
  AREAS, OTHER_AREA, VEHICLES, WASTE_TYPES,
  areaLabel, isVehicle, isWaste, vehicleLabel, wasteLabel,
  type AreaId, type VehicleId, type WasteId
} from "./data/lookups";
import { backendConfigured, fetchPublicCollectors, type PublicCollectorRow } from "./api";
import { $, escapeHTML } from "./ui";

interface Collector {
  id: string;
  vehicle: VehicleId;
  area: AreaId;
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
}

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

const vehicleSvg: Record<VehicleId, string> = {
  "municipal-truck": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M5 13h24v21H5zM29 20h8l7 8v6H29z"/>
        <path d="M33 22v6h8M9 18h16M9 23h16"/>
        <circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/>
      </svg>`,
  "private-truck": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 14h26v20H4zM30 21h8l6 7v6H30z"/>
        <path d="M33 23v5h8"/>
        <circle cx="13" cy="36" r="4"/><circle cx="37" cy="36" r="4"/>
      </svg>`,
  "small-van": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m6 28 4-10a4 4 0 0 1 4-3h19a4 4 0 0 1 4 3l5 10v7H6z"/>
        <path d="m13 18-3 9h28l-5-9z"/>
        <circle cx="14" cy="35" r="4"/><circle cx="35" cy="35" r="4"/>
      </svg>`,
  "tricycle": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="10" cy="35" r="5"/><circle cx="37" cy="35" r="5"/>
        <path d="M10 35h17l-5-13h-8l-4 13M22 22h12l3 13M21 18h7M27 18l4-5"/>
        <path d="M18 17h8"/>
      </svg>`,
  "donkey-cart": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="14" cy="35" r="6"/><circle cx="35" cy="35" r="6"/>
        <path d="M8 26h28l-2-10H13zM11 26v4M37 26l5 6"/>
        <path d="M17 16v-5h13v5M20 11V7h7v4"/>
      </svg>`,
  "horse-cart": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="13" cy="35" r="6"/><circle cx="36" cy="35" r="6"/>
        <path d="M7 25h28l-2-9H13zM10 25v5M36 25l6 7"/>
        <path d="M18 15V9h12v6"/>
      </svg>`
};

export const iconFor = (vehicle: VehicleId): string => vehicleSvg[vehicle];

const E164 = /^\+[1-9][0-9]{6,14}$/;
const CACHE_KEY = "setsetal.listings.v2";
const HOUR = 60 * 60 * 1000;
// Saved listings expire, so a suspension or withdrawn consent reaches phones
// that stay offline: contact details after 48 hours, everything after 7 days.
const CONTACT_MAX_AGE = 48 * HOUR;
const CACHE_MAX_AGE = 7 * 24 * HOUR;

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
  whatsapp: null
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
    whatsapp: row.whatsapp && E164.test(row.whatsapp) ? row.whatsapp : null
  };
}

let listings: Listing[] = demoListings();
// True until the first answer from the server (or the cache) arrives.
let pending = backendConfigured;
// When the listings on screen came from the cache rather than the server.
let savedAt: number | null = null;

export const listingsPending = (): boolean => pending;
export const listingsSavedAt = (): number | null => savedAt;

function useRows(rows: PublicCollectorRow[], options: { withoutContacts?: boolean } = {}): void {
  const real = rows.map(fromRow).filter((listing): listing is Listing => listing !== null);
  if (options.withoutContacts) real.forEach((listing) => { listing.phone = null; listing.whatsapp = null; });
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
export async function loadListings(onChange: () => void): Promise<void> {
  if (!backendConfigured) return;
  const cached = readCache();
  if (cached) {
    useRows(cached.rows, { withoutContacts: Date.now() - cached.savedAt >= CONTACT_MAX_AGE });
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
const areaList = (areas: readonly string[]): string => areas.map(areaLabel).join(", ");

const wasteList = (waste: readonly WasteId[]): string => waste.map(wasteLabel).join(", ");

const optionsHTML = (items: { value: string; label: string }[]): string =>
  items.map(({ value, label }) =>
    `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`
  ).join("");

// Appends options after a select's placeholder options from index.html.
export function fillSelect(select: HTMLSelectElement, items: { value: string; label: string }[]): void {
  select.insertAdjacentHTML("beforeend", optionsHTML(items));
}

export const areaOptions = (withOther: boolean) => [
  ...AREAS.map((area) => ({ value: area.id, label: area.name })),
  ...(withOther ? [{ value: OTHER_AREA, label: areaLabel(OTHER_AREA) }] : [])
];
export const vehicleOptions = () => VEHICLES.map((id) => ({ value: id, label: vehicleLabel(id) }));
export const wasteOptions = () => WASTE_TYPES.map((id) => ({ value: id, label: wasteLabel(id) }));

interface Filters {
  area: string;
  vehicle: string;
  waste: string;
}

function matchesFilters(listing: Listing, filters: Filters): boolean {
  return (filters.area === "all" || listing.areas.includes(filters.area)) &&
    (filters.vehicle === "all" || listing.vehicle === filters.vehicle) &&
    (filters.waste === "all" || (listing.waste as string[]).includes(filters.waste));
}

const demoLabel = (listing: Listing): string =>
  listing.demo ? `<span class="demo-label">${escapeHTML(t("listing.demoLabel"))}</span>` : "";

function collectorCard(listing: Listing): string {
  return `
      <article class="collector-card">
        <div class="vehicle-art">${iconFor(listing.vehicle)}</div>
        <div>
          <h3>${escapeHTML(nameOf(listing))}</h3>
          <p>${escapeHTML(vehicleLabel(listing.vehicle))} · ${escapeHTML(areaList(listing.areas))}</p>
          <p>${escapeHTML(t("listing.wasteTypes", { types: wasteList(listing.waste) }))}</p>
          ${demoLabel(listing)}
          <div class="card-actions">
            <button class="button secondary" type="button"
              data-profile="${escapeHTML(listing.id)}">${escapeHTML(t("listing.viewDetails"))}</button>
          </div>
        </div>
      </article>`;
}

function emptyState(otherArea: boolean, demo: boolean): string {
  if (otherArea) {
    return `<div class="empty-state">
          <h3>${escapeHTML(t("find.empty.otherArea.title"))}</h3>
          <p>${escapeHTML(t("find.empty.otherArea.body"))}</p>
          <button class="button secondary" type="button" data-go="help">${escapeHTML(t("find.empty.otherArea.cta"))}</button>
        </div>`;
  }
  return `<div class="empty-state">
          <h3>${escapeHTML(t(demo ? "find.empty.title" : "find.empty.titleReal"))}</h3>
          <p>${escapeHTML(t("find.empty.body"))}</p>
        </div>`;
}

export function populateFilters(): void {
  fillSelect($<HTMLSelectElement>("#area"), areaOptions(true));
  fillSelect($<HTMLSelectElement>("#vehicle-filter"), vehicleOptions());
  fillSelect($<HTMLSelectElement>("#waste-type"), wasteOptions());
}

export function clearFilters(): void {
  $<HTMLSelectElement>("#area").value = "all";
  $<HTMLSelectElement>("#vehicle-filter").value = "all";
  $<HTMLSelectElement>("#waste-type").value = "all";
}

export function renderCollectors(): void {
  const filters: Filters = {
    area: $<HTMLSelectElement>("#area").value,
    vehicle: $<HTMLSelectElement>("#vehicle-filter").value,
    waste: $<HTMLSelectElement>("#waste-type").value
  };
  if (pending) {
    $("#results-count").textContent = t("find.loading");
    $("#collector-results").innerHTML = "";
    return;
  }
  const results = listings.filter((listing) => matchesFilters(listing, filters));
  const demo = listings.some((listing) => listing.demo);

  const count = plural(demo ? "find.count" : "find.countReal", results.length);
  $("#results-count").textContent = savedAt ? `${count} · ${savedNote()}` : count;
  $("#collector-results").innerHTML = results.length
    ? results.map(collectorCard).join("")
    : emptyState(filters.area === OTHER_AREA, demo);
}

const savedNote = (): string => t("listing.savedNote", { date: formatDate(savedAt ?? Date.now()) });

// wa.me takes the number without the leading +.
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
  const name = nameOf(listing);
  const call = listing.phone ? `
          <a class="button" href="tel:${escapeHTML(listing.phone)}"
            aria-label="${escapeHTML(t("profile.callLabel", { name }))}">${escapeHTML(t("profile.call"))}</a>` : "";
  const whatsapp = listing.whatsapp ? `
          <a class="button secondary" href="https://wa.me/${escapeHTML(listing.whatsapp.slice(1))}"
            target="_blank" rel="noopener"
            aria-label="${escapeHTML(t("profile.whatsappLabel", { name }))}">${escapeHTML(t("profile.whatsapp"))}</a>` : "";
  return `
        <div class="card-actions contact-actions">${call}${whatsapp}
        </div>
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

  const row = (label: string, value: string) => `
        <div class="detail-row">
          <strong>${escapeHTML(label)}</strong>
          <p>${escapeHTML(value)}</p>
        </div>`;

  $("#profile-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-title-row">
          <div class="vehicle-art">${iconFor(collector.vehicle)}</div>
          <div>
            <h2>${escapeHTML(nameOf(collector))}</h2>
            ${demoLabel(collector)}
          </div>
        </div>${
          row(t("profile.vehicle"), vehicleLabel(collector.vehicle)) +
          row(t("profile.area"), areaList(collector.areas)) +
          row(t("profile.waste"), wasteList(collector.waste)) +
          (descriptionOf(collector) ? row(t("profile.about"), descriptionOf(collector)) : "")}${
          contactSection(collector)}${savedLine(collector)}
      </article>${collector.demo ? "" : `
      <button class="button secondary full-width" type="button"
        data-report="${escapeHTML(collector.id)}">${escapeHTML(t("profile.report"))}</button>`}
      <button class="button secondary full-width" data-go="find">${escapeHTML(t("profile.allListings"))}</button>`;
}
