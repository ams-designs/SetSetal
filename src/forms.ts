import { t } from "./i18n";
import {
  OTHER_AREA, REPORT_TYPES,
  areaLabel, isArea, isReportType, isVehicle, isWaste, reportTypeLabel, vehicleLabel, wasteLabel,
  type VehicleId, type WasteId
} from "./data/lookups";
import { areaOptions, fillSelect, iconFor, sampleCollectors, vehicleOptions, wasteOptions } from "./listings";
import { submitReport } from "./reports";
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

// Registration drafts stay in memory only until collector sign-in exists.
let draftListing: DraftListing | null = null;
// The real listing a report is about, set from its profile.
let reportTarget: { id: string; name: string } | null = null;

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

function renderReportTarget(): void {
  const box = $("#report-target");
  box.hidden = !reportTarget;
  box.innerHTML = reportTarget ? `
        <p>${escapeHTML(t("help.report.about", { name: reportTarget.name }))}</p>
        <button class="text-button" type="button" id="clear-report-target">${escapeHTML(t("help.report.removeTarget"))}</button>` : "";
}

// Called from a real listing's profile before opening the Help screen.
export function setReportTarget(target: { id: string; name: string } | null): void {
  reportTarget = target;
  renderReportTarget();
  if (target) $<HTMLSelectElement>("#report-type").value = "incorrect-listing";
  $("#report-feedback").hidden = true;
}

let sendingReport = false;

async function handleReport(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (sendingReport || !form.reportValidity()) return;

  const data = new FormData(form);
  const type = String(data.get("type") ?? "");
  const message = String(data.get("message") ?? "").trim();
  // "required" accepts a message of only spaces, which the server refuses.
  if (!message) {
    const field = $<HTMLTextAreaElement>("#report-message");
    field.setCustomValidity(t("help.report.emptyMessage"));
    field.reportValidity();
    return;
  }
  const submit = $<HTMLButtonElement>("#report-submit");
  sendingReport = true;
  submit.disabled = true;
  submit.textContent = t("help.report.sending");

  const result = await submitReport({
    type: isReportType(type) ? type : "general",
    message,
    collector_id: reportTarget?.id ?? null
  });

  sendingReport = false;
  submit.disabled = false;
  submit.textContent = t("help.report.submit");

  const feedback = $("#report-feedback");
  feedback.hidden = false;
  feedback.innerHTML =
    `<strong>${escapeHTML(t(`help.report.${result}.title`))}</strong><p>${escapeHTML(t(`help.report.${result}.body`))}</p>`;
  // A report that couldn't be sent or saved stays in the form to try again.
  if (result === "sent" || result === "sentUnlinked" || result === "queued") {
    form.reset();
    setReportTarget(null);
    feedback.hidden = false;
  }
}

export function updateAdminCounts(): void {
  $("#admin-listing-count").textContent = String(sampleCollectors.length);
  $("#admin-report-count").textContent = t("admin.notConnected");
}

export function bindForms(): void {
  $<HTMLFormElement>("#registration-form").addEventListener("submit", handleRegistration);
  $("#provider-waste").addEventListener("change", () => {
    if ($$("#provider-waste input:checked").length > 0) setWasteError(false);
  });
  $<HTMLFormElement>("#report-form").addEventListener("submit", (event) => void handleReport(event));
  $("#report-message").addEventListener("input", (event) =>
    (event.currentTarget as HTMLTextAreaElement).setCustomValidity(""));
  $("#report-target").addEventListener("click", (event) => {
    if ((event.target as Element).closest("#clear-report-target")) setReportTarget(null);
  });

  $("#finish-preview").addEventListener("click", () => {
    draftListing = null;
    $<HTMLFormElement>("#registration-form").reset();
    go("home");
    toast(t("preview.finished"));
  });
}
