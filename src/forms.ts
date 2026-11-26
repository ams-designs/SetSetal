// The Help screen's report form. A resident taps a picture of what happened;
// writing more is optional, so someone who can't write can still report
// (decided 26 Nov 2026). Reports never say who sent them (product rule 3).
import { t, type MessageKey } from "./i18n";
import { isReportType, reportTypeLabel, reportTypes } from "./data/lookups";
import { icon, reportPicture, type UiIcon } from "./icons";
import { submitReport, type SubmitResult } from "./reports";
import { $, $$, escapeHTML } from "./ui";

// The real listing a report is about, set from its profile.
let reportTarget: { id: string; name: string } | null = null;

function renderReportTarget(): void {
  const box = $("#report-target");
  box.hidden = !reportTarget;
  box.innerHTML = reportTarget ? `
        <p>${icon("flag")}<span>${escapeHTML(t("help.report.about", { name: reportTarget.name }))}</span></p>
        <button class="text-button" type="button" id="clear-report-target">${escapeHTML(t("help.report.removeTarget"))}</button>` : "";
}

// Called from a real listing's profile before opening the Help screen.
export function setReportTarget(target: { id: string; name: string } | null): void {
  reportTarget = target;
  renderReportTarget();
  $("#report-feedback").hidden = true;
}

const chosenReason = (): string =>
  $$<HTMLInputElement>("#report-reasons input[name='type']").find((input) => input.checked)?.value ?? "";

function showReasonError(show: boolean): void {
  $("#report-type-error").hidden = !show;
  $(".reason-group").classList.toggle("has-error", show);
}

// What happened to the report, shown big: a tick, a clock or a warning.
const RESULT_LOOK: Record<SubmitResult, { look: "done" | "waiting" | "problem"; icon: UiIcon }> = {
  sent: { look: "done", icon: "tick" },
  sentUnlinked: { look: "done", icon: "tick" },
  queued: { look: "waiting", icon: "clock" },
  failed: { look: "problem", icon: "warning" },
  rejected: { look: "problem", icon: "warning" },
  unavailable: { look: "problem", icon: "warning" }
};

function showResult(result: SubmitResult): void {
  const feedback = $("#report-feedback");
  const { look, icon: name } = RESULT_LOOK[result];
  feedback.className = `feedback result result-${look}`;
  feedback.hidden = false;
  feedback.innerHTML = `${icon(name, "icon result-icon")}
        <div><strong>${escapeHTML(t(`help.report.${result}.title` as MessageKey))}</strong>
        <p>${escapeHTML(t(`help.report.${result}.body` as MessageKey))}</p></div>`;
  // The result appears below the form; bring it into view so it isn't missed.
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  feedback.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
}

let sendingReport = false;

async function handleReport(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (sendingReport) return;

  const type = chosenReason();
  if (!type) {
    showReasonError(true);
    $<HTMLInputElement>("#report-reasons input").focus();
    return;
  }
  const message = $<HTMLTextAreaElement>("#report-message").value.trim();
  const submit = $<HTMLButtonElement>("#report-submit");
  sendingReport = true;
  submit.disabled = true;
  $("#report-submit-label").textContent = t("help.report.sending");

  const result = await submitReport({
    type: isReportType(type) ? type : "general",
    message,
    collector_id: reportTarget?.id ?? null
  });

  sendingReport = false;
  submit.disabled = false;
  $("#report-submit-label").textContent = t("help.report.submit");
  showResult(result);
  // A report that couldn't be sent or saved stays in the form to try again.
  if (result === "sent" || result === "sentUnlinked" || result === "queued") {
    form.reset();
    reportTarget = null;
    renderReportTarget();
  }
}

// Runs at start-up and again when the lists arrive from the server. The
// reason already chosen stays chosen.
export function populateForms(): void {
  const chosen = chosenReason();
  $("#report-reasons").innerHTML = reportTypes().map((id) => `
          <label class="reason-tile">
            <input type="radio" name="type" value="${escapeHTML(id)}"${id === chosen ? " checked" : ""}>
            ${reportPicture(id)}<span>${escapeHTML(reportTypeLabel(id))}</span>
          </label>`).join("");
}

export function bindForms(): void {
  $<HTMLFormElement>("#report-form").addEventListener("submit", (event) => void handleReport(event));
  $("#report-reasons").addEventListener("change", () => showReasonError(false));
  $("#report-target").addEventListener("click", (event) => {
    if ((event.target as Element).closest("#clear-report-target")) setReportTarget(null);
  });
}
