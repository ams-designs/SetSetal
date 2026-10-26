// The Help screen's feedback form and the admin overview's counts.
import { t } from "./i18n";
import { REPORT_TYPES, isReportType, reportTypeLabel } from "./data/lookups";
import { fillSelect, sampleCollectors } from "./listings";
import { submitReport } from "./reports";
import { $, escapeHTML } from "./ui";

// The real listing a report is about, set from its profile.
let reportTarget: { id: string; name: string } | null = null;

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

export function populateForms(): void {
  fillSelect($<HTMLSelectElement>("#report-type"),
    REPORT_TYPES.map((id) => ({ value: id, label: reportTypeLabel(id) })));
}

export function bindForms(): void {
  $<HTMLFormElement>("#report-form").addEventListener("submit", (event) => void handleReport(event));
  $("#report-message").addEventListener("input", (event) =>
    (event.currentTarget as HTMLTextAreaElement).setCustomValidity(""));
  $("#report-target").addEventListener("click", (event) => {
    if ((event.target as Element).closest("#clear-report-target")) setReportTarget(null);
  });
}
