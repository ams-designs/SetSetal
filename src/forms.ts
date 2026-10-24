import { t } from "./i18n";
import {
  OTHER_AREA, REPORT_TYPES,
  areaLabel, isArea, isReportType, isVehicle, isWaste, reportTypeLabel, vehicleLabel, wasteLabel,
  type ReportTypeId, type VehicleId, type WasteId
} from "./data/lookups";
import { areaOptions, fillSelect, iconFor, sampleCollectors, vehicleOptions, wasteOptions } from "./listings";
import { go } from "./router";
import { $, $$, escapeHTML, toast } from "./ui";

interface DraftListing {
  name: string;
  phone: string;
  vehicle: VehicleId;
  area: string;
  waste: WasteId[];
  description: string;
}

interface Report {
  type: ReportTypeId;
  message: string;
  createdAt: string;
}

// Nothing here leaves the browser: drafts and reports live in memory only.
let draftListing: DraftListing | null = null;
const reports: Report[] = [];

export const hasDraft = (): boolean => draftListing !== null;

export function populateForms(): void {
  fillSelect($<HTMLSelectElement>("#provider-vehicle"), vehicleOptions());
  fillSelect($<HTMLSelectElement>("#provider-area"), areaOptions(true));
  fillSelect($<HTMLSelectElement>("#report-type"),
    REPORT_TYPES.map((id) => ({ value: id, label: reportTypeLabel(id) })));

  $("#provider-waste-options").innerHTML = wasteOptions().map(({ value, label }) => `
      <label class="checkbox-row">
        <input type="checkbox" name="waste" value="${escapeHTML(value)}">
        <span>${escapeHTML(label)}</span>
      </label>`).join("");
}

// The error is linked only while it shows, so it is never read out early.
function setWasteError(show: boolean): void {
  $("#provider-waste-error").hidden = !show;
  $$("#provider-waste input").forEach((input) => {
    if (show) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "provider-waste-error");
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  });
}

function showRegistrationError(message: string): void {
  const feedback = $("#registration-feedback");
  feedback.hidden = false;
  feedback.textContent = message;
}

export function renderPreview(): void {
  const listing = draftListing;
  if (!listing) return;

  const row = (label: string, value: string) =>
    `<div class="detail-row"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(value)}</p></div>`;

  $("#preview-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-title-row">
          <div class="vehicle-art">${iconFor(listing.vehicle)}</div>
          <div>
            <h2>${escapeHTML(listing.name)}</h2>
            <span class="demo-label">${escapeHTML(t("preview.notPublished"))}</span>
          </div>
        </div>
        ${row(t("preview.vehicle"), vehicleLabel(listing.vehicle))}
        ${row(t("preview.area"), areaLabel(listing.area))}
        <div class="detail-row"><strong>${escapeHTML(t("preview.waste"))}</strong>
          <ul class="detail-list">${listing.waste.map((id) => `<li>${escapeHTML(wasteLabel(id))}</li>`).join("")}</ul>
        </div>
        ${row(t("preview.phone"), listing.phone)}
        ${row(t("preview.description"), listing.description || t("preview.noDescription"))}
        <p class="small-note">${escapeHTML(t("preview.temporary"))}</p>
      </article>`;
}

function handleRegistration(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const phone = String(data.get("phone") ?? "").trim();
  const vehicle = String(data.get("vehicle") ?? "");
  const area = String(data.get("area") ?? "");
  const waste = data.getAll("waste").map(String).filter(isWaste);

  if (phone.replace(/\D/g, "").length < 7) {
    showRegistrationError(t("join.error.phone"));
    $("#provider-phone").focus();
    return;
  }

  if (!isVehicle(vehicle) || !(isArea(area) || area === OTHER_AREA)) {
    showRegistrationError(t("join.error.lists"));
    return;
  }

  if (waste.length === 0) {
    setWasteError(true);
    $("#provider-waste input").focus();
    return;
  }

  setWasteError(false);
  $("#registration-feedback").hidden = true;
  draftListing = {
    name: String(data.get("name") ?? "").trim(),
    phone,
    vehicle,
    area,
    waste,
    description: String(data.get("description") ?? "").trim()
  };
  go("preview");
}

function handleReport(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const type = String(data.get("type") ?? "");
  reports.push({
    type: isReportType(type) ? type : "general",
    message: String(data.get("message") ?? "").trim(),
    createdAt: new Date().toISOString()
  });

  const feedback = $("#report-feedback");
  feedback.hidden = false;
  feedback.innerHTML =
    `<strong>${escapeHTML(t("help.report.recorded"))}</strong><p>${escapeHTML(t("help.report.recordedNotSent"))}</p>`;

  form.reset();
  updateAdminCounts();
}

export function updateAdminCounts(): void {
  $("#admin-listing-count").textContent = String(sampleCollectors.length);
  $("#admin-report-count").textContent = String(reports.length);
}

export function bindForms(): void {
  $<HTMLFormElement>("#registration-form").addEventListener("submit", handleRegistration);
  $("#provider-waste").addEventListener("change", () => {
    if ($$("#provider-waste input:checked").length > 0) setWasteError(false);
  });
  $<HTMLFormElement>("#report-form").addEventListener("submit", handleReport);

  $("#finish-preview").addEventListener("click", () => {
    draftListing = null;
    $<HTMLFormElement>("#registration-form").reset();
    go("home");
    toast(t("preview.finished"));
  });
}
