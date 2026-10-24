import { t, plural, type MessageKey } from "./i18n";
import {
  AREAS, OTHER_AREA, VEHICLES, WASTE_TYPES,
  areaLabel, vehicleLabel, wasteLabel,
  type AreaId, type VehicleId, type WasteId
} from "./data/lookups";
import { $, escapeHTML } from "./ui";

export interface Collector {
  id: string;
  vehicle: VehicleId;
  area: AreaId;
  waste: WasteId[];
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

const demoName = (collector: Collector): string => t(`demo.${collector.id}.name` as MessageKey);
const demoDescription = (collector: Collector): string => t(`demo.${collector.id}.description` as MessageKey);

export const iconFor = (vehicle: VehicleId): string => vehicleSvg[vehicle];

export const findCollector = (id: string | null): Collector | undefined =>
  sampleCollectors.find((collector) => collector.id === id);

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

function matchesFilters(collector: Collector, filters: Filters): boolean {
  return (filters.area === "all" || collector.area === filters.area) &&
    (filters.vehicle === "all" || collector.vehicle === filters.vehicle) &&
    (filters.waste === "all" || (collector.waste as string[]).includes(filters.waste));
}

function collectorCard(collector: Collector): string {
  return `
      <article class="collector-card">
        <div class="vehicle-art">${iconFor(collector.vehicle)}</div>
        <div>
          <h3>${escapeHTML(demoName(collector))}</h3>
          <p>${escapeHTML(vehicleLabel(collector.vehicle))} · ${escapeHTML(areaLabel(collector.area))}</p>
          <p>${escapeHTML(t("listing.wasteTypes", { types: wasteList(collector.waste) }))}</p>
          <span class="demo-label">${escapeHTML(t("listing.demoLabel"))}</span>
          <div class="card-actions">
            <button class="button secondary" type="button"
              data-profile="${escapeHTML(collector.id)}">${escapeHTML(t("listing.viewDetails"))}</button>
          </div>
        </div>
      </article>`;
}

function emptyState(otherArea: boolean): string {
  if (otherArea) {
    return `<div class="empty-state">
          <h3>${escapeHTML(t("find.empty.otherArea.title"))}</h3>
          <p>${escapeHTML(t("find.empty.otherArea.body"))}</p>
          <button class="button secondary" type="button" data-go="help">${escapeHTML(t("find.empty.otherArea.cta"))}</button>
        </div>`;
  }
  return `<div class="empty-state">
          <h3>${escapeHTML(t("find.empty.title"))}</h3>
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
  const results = sampleCollectors.filter((collector) => matchesFilters(collector, filters));

  $("#results-count").textContent = plural("find.count", results.length);
  $("#collector-results").innerHTML = results.length
    ? results.map(collectorCard).join("")
    : emptyState(filters.area === OTHER_AREA);
}

export function renderProfile(id: string | null): void {
  const collector = findCollector(id);
  if (!collector) return;

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
            <h2>${escapeHTML(demoName(collector))}</h2>
            <span class="demo-label">${escapeHTML(t("listing.demoLabel"))}</span>
          </div>
        </div>${
          row(t("profile.vehicle"), vehicleLabel(collector.vehicle)) +
          row(t("profile.area"), areaLabel(collector.area)) +
          row(t("profile.waste"), wasteList(collector.waste)) +
          row(t("profile.about"), demoDescription(collector))}
        <div class="notice">
          <strong>${escapeHTML(t("profile.noContact.title"))}</strong>
          <p>${escapeHTML(t("profile.noContact.body"))}</p>
        </div>
      </article>
      <button class="button secondary full-width" data-go="find">${escapeHTML(t("profile.allListings"))}</button>`;
}
