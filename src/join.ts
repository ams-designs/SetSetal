// The Join screen for collectors: sign in with an SMS code, fill in the
// listing, check the preview, submit it for review, then follow its status.
import { t, type MessageKey } from "./i18n";
import {
  areaLabel, areas, freshLookups, isVehicle, isWaste, vehicleLabel, wasteLabel, type WasteId
} from "./data/lookups";
import { reloadListings, vehicleOptions, wasteOptions } from "./listings";
import { icon, vehiclePicture, wastePicture, type UiIcon } from "./icons";
import { currentSession, forgetSession, normalisePhone, requestCode, signOut, verifyCode, type AuthResult } from "./auth";
import { captchaEnabled, showCaptcha, takeCaptchaToken } from "./captcha";
import {
  deleteAccount, fetchMyListing, saveMyListing, setAvailability,
  type ActionResult, type ListingDraft, type MyListing
} from "./collector";
import { clearAdmin } from "./admin";
import { go } from "./router";
import { $, $$, escapeHTML, toast } from "./ui";

// What the preview shows, until it is submitted.
let draft: ListingDraft | null = null;
// Show the form rather than the status panel.
let editing = false;
// The form already holds the collector's input (for example after the preview).
let formFilled = false;
let myListing: MyListing | null = null;
// The number the sign-in code was sent to.
let codePhone = "";
// Whose listing the state above belongs to.
let loadedFor: string | null = null;
let submitting = false;
// Where to go after signing in, when another screen sent the user here.
let returnTo: "admin" | null = null;

export function signInThen(screen: "admin"): void {
  returnTo = screen;
  go("join");
}

// Called when another screen is shown, so a later sign-in doesn't jump to a
// screen the user has since left.
export function leaveJoin(): void {
  returnTo = null;
}

// Forgets everything about the last collector, so on a shared phone the next
// one never sees their details.
function resetCollectorState(): void {
  clearAdmin();
  myListing = null;
  draft = null;
  editing = false;
  formFilled = false;
  loadedFor = null;
  step = 0;
  $<HTMLFormElement>("#registration-form").reset();
  $("#delete-confirm").hidden = true;
}

export const hasDraft = (): boolean => draft !== null;

const SECTIONS = ["#join-loading", "#join-signin", "#my-listing", "#registration-form"];

function showOnly(selector: string): void {
  SECTIONS.forEach((section) => { $(section).hidden = section !== selector; });
  // The intro explains signing in; once signed in, the questions speak for themselves.
  $("#join-intro").hidden = selector !== "#join-signin";
  $("#signed-in").hidden = selector === "#join-signin" || selector === "#join-loading";
  $("#registration-feedback").hidden = true;
}

// Big tiles, each a real checkbox or radio stretched over its picture, so a
// tap anywhere on the tile picks it and screen readers hear the label.
const tiles = (type: "checkbox" | "radio", name: string, items: { value: string; label: string; picture?: string }[]): string =>
  items.map(({ value, label, picture }) => `
      <label class="pick-tile">
        <input type="${type}" name="${escapeHTML(name)}" value="${escapeHTML(value)}">
        ${picture ?? ""}<span>${escapeHTML(label)}</span>
      </label>`).join("");

const checkedValues = (selector: string): string[] =>
  $$<HTMLInputElement>(`${selector} input:checked`).map((input) => input.value);

function restoreChecked(selector: string, values: readonly string[]): void {
  for (const input of $$<HTMLInputElement>(`${selector} input`)) input.checked = values.includes(input.value);
}

// Runs at start-up and again when the lists arrive from the server. What the
// collector has already chosen is kept.
export function populateJoin(): void {
  const vehicle = checkedValues("#provider-vehicle-options");
  $("#provider-vehicle-options").innerHTML = tiles("radio", "vehicle",
    vehicleOptions().map((option) => ({ ...option, picture: vehiclePicture(option.value) })));
  restoreChecked("#provider-vehicle-options", vehicle);
  const waste = checkedValues("#provider-waste-options");
  $("#provider-waste-options").innerHTML = tiles("checkbox", "waste",
    wasteOptions().map((option) => ({ ...option, picture: wastePicture(option.value) })));
  restoreChecked("#provider-waste-options", waste);
}

const areaName = areaLabel;

function feedback(selector: string, key: MessageKey | null): void {
  const box = $(selector);
  box.hidden = !key;
  box.textContent = key ? t(key) : "";
}

// Sign-in ----------------------------------------------------------------------

function showSignIn(): void {
  showOnly("#join-signin");
  $("#signin-admin-note").hidden = returnTo !== "admin";
  $("#signin-phone-form").hidden = Boolean(codePhone);
  $("#signin-code-form").hidden = !codePhone;
  if (captchaEnabled) void showCaptcha($("#signin-captcha"));
}

const SIGNIN_ERRORS: Record<Exclude<AuthResult, "ok">, MessageKey> = {
  unavailable: "join.signin.error.unavailable",
  offline: "join.signin.error.offline",
  invalid: "join.signin.error.invalidPhone",
  "rate-limited": "join.signin.error.rateLimited",
  captcha: "join.signin.error.captcha",
  failed: "join.signin.error.failed"
};

// Shows a word like "Saving…" on the button while it works, then puts back
// what was there before (its own markup, icon included).
export async function busy<T>(button: HTMLButtonElement, label: MessageKey, task: () => Promise<T>): Promise<T> {
  const idle = button.innerHTML;
  button.disabled = true;
  button.textContent = t(label);
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.innerHTML = idle;
  }
}

async function handlePhone(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const phone = normalisePhone($<HTMLInputElement>("#signin-phone").value);
  if (!phone) {
    feedback("#signin-feedback", "join.signin.error.phone");
    $("#signin-phone").focus();
    return;
  }
  const result = await busy($<HTMLButtonElement>("#signin-send"), "join.signin.sending", async () => {
    if (!captchaEnabled) return requestCode(phone);
    const captchaToken = await takeCaptchaToken();
    return captchaToken ? requestCode(phone, captchaToken) : "captcha-wait";
  });
  if (result === "captcha-wait") {
    feedback("#signin-feedback", "join.signin.error.captchaWait");
    return;
  }
  if (result !== "ok") {
    feedback("#signin-feedback", SIGNIN_ERRORS[result]);
    return;
  }
  feedback("#signin-feedback", null);
  codePhone = phone;
  $("#signin-code-sent").textContent = t("join.signin.codeSent", { phone });
  showSignIn();
  $("#signin-code").focus();
}

async function handleCode(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const code = $<HTMLInputElement>("#signin-code").value.trim();
  const result = await busy($<HTMLButtonElement>("#signin-verify"), "join.signin.checking", () => verifyCode(codePhone, code));
  if (result !== "ok") {
    feedback("#signin-feedback", result === "invalid" ? "join.signin.error.invalidCode" : SIGNIN_ERRORS[result]);
    return;
  }
  feedback("#signin-feedback", null);
  codePhone = "";
  form.reset();
  if (returnTo) {
    const screen = returnTo;
    returnTo = null;
    go(screen);
    return;
  }
  await renderJoin();
}

function changeNumber(): void {
  codePhone = "";
  feedback("#signin-feedback", null);
  showSignIn();
  $("#signin-phone").focus();
}

// Status -------------------------------------------------------------------------

// Each status has its own colour and picture, so it can be told apart
// without reading: a clock while waiting, a tick when approved, a warning
// when not approved, a pause when suspended.
const STATUS_LOOK: Record<MyListing["status"], { look: string; icon: UiIcon }> = {
  submitted: { look: "waiting", icon: "clock" },
  approved: { look: "done", icon: "tick" },
  rejected: { look: "problem", icon: "warning" },
  suspended: { look: "paused", icon: "pause" }
};

function showStatus(listing: MyListing): void {
  showOnly("#my-listing");
  const paragraph = (text: string) => `<p>${escapeHTML(text)}</p>`;
  const lines = [
    paragraph(t(`join.status.${listing.status}Body`)),
    listing.reason ? paragraph(t("join.status.reason", { reason: listing.reason })) : "",
    listing.status === "approved" && !listing.consent ? paragraph(t("join.status.approvedNoConsent")) : ""
  ].join("");
  const { look, icon: name } = STATUS_LOOK[listing.status];
  const vehicle = isVehicle(listing.vehicle) ? listing.vehicle : null;
  const today = listing.availableToday;

  $("#my-listing").innerHTML = `
      <article class="panel my-listing">
        <h2>${escapeHTML(t("join.status.title"))}</h2>
        <div class="my-listing-head">
          ${vehicle ? `<div class="card-picture">${vehiclePicture(vehicle)}</div>` : ""}
          <div>
            <h3>${escapeHTML(listing.name)}</h3>
            <p class="card-area">${icon("pin")}<span>${escapeHTML(listing.areas.map(areaName).join(", "))}</span></p>
          </div>
        </div>
        <div class="result result-${look} status-box">
          ${icon(name, "icon result-icon")}
          <div><strong>${escapeHTML(t(`join.status.${listing.status}`))}</strong>${lines}</div>
        </div>${listing.status === "approved" ? `
        <div class="today-panel${today ? " is-on" : ""}">
          <strong>${icon("sun")}<span>${escapeHTML(t(today ? "join.today.on" : "join.today.off"))}</span></strong>
          <p class="small-note">${escapeHTML(t("join.today.note"))}</p>
          <button class="button ${today ? "secondary" : "primary"} full-width" type="button" id="toggle-today"
            data-available="${today ? "0" : "1"}">${icon("sun")}<span>${escapeHTML(t(today ? "join.today.turnOff" : "join.today.turnOn"))}</span></button>
        </div>` : ""}
        <button class="button secondary full-width" type="button" id="edit-listing">${icon("pencil")}<span>${escapeHTML(t("join.status.edit"))}</span></button>
        <p class="small-note">${escapeHTML(t(listing.status === "suspended" ? "join.status.suspendedEditNote" : "join.status.editNote"))}</p>
      </article>`;
}

// An admin signed in by email has no phone, so no listing of their own: the
// collector form would make one owned by the admin account.
function showAdminSignedIn(): void {
  showOnly("#my-listing");
  $("#delete-account").hidden = true;
  $("#my-listing").innerHTML = `
      <div class="notice">
        <p>${escapeHTML(t("join.adminSession.body"))}</p>
        <button class="button secondary" type="button" data-go="admin">${escapeHTML(t("join.adminSession.cta"))}</button>
      </div>`;
}

function showLoadError(): void {
  showOnly("#my-listing");
  $("#my-listing").innerHTML = `
      <div class="notice">
        <p>${escapeHTML(t("join.status.loadError"))}</p>
        <button class="button secondary" type="button" id="retry-join">${escapeHTML(t("join.retry"))}</button>
      </div>`;
}

// Form ---------------------------------------------------------------------------

// A collector chooses from the areas the server offers now, never from a list
// saved on the phone, which may be out of date.
async function ensureAreas(): Promise<boolean> {
  return (await freshLookups()) && areas().length > 0;
}

function setGroupError(group: "areas" | "waste", show: boolean): void {
  $(`#provider-${group}-error`).hidden = !show;
  $$(`#provider-${group} input`).forEach((input) => {
    if (show) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", `provider-${group}-error`);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  });
}

function fillForm(listing: MyListing | null, signedInPhone: string): void {
  const form = $<HTMLFormElement>("#registration-form");
  form.reset();
  setGroupError("areas", false);
  setGroupError("waste", false);
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  field("name").value = listing?.name ?? "";
  field("phone").value = listing?.phone || signedInPhone;
  field("whatsapp").value = listing?.whatsapp ?? "";
  field("description").value = listing?.description ?? "";
  $<HTMLInputElement>("#provider-consent").checked = listing?.consent ?? false;
  restoreChecked("#provider-vehicle-options", listing ? [listing.vehicle] : []);
  restoreChecked("#provider-area-options", listing?.areas ?? []);
  restoreChecked("#provider-waste-options", listing?.waste ?? []);
}

// One question per screen. It stays one form; only its steps take turns.
let step = 0;
const steps = (): HTMLFieldSetElement[] => $$<HTMLFieldSetElement>("#registration-form .join-step");

function showStep(index: number, focus = true): void {
  const all = steps();
  step = Math.max(0, Math.min(index, all.length - 1));
  all.forEach((fieldset, i) => { fieldset.hidden = i !== step; });
  const last = step === all.length - 1;
  $("#step-back").hidden = step === 0;
  $("#step-next").hidden = last;
  $("#step-submit").hidden = !last;
  $("#step-count").textContent = t("join.stepCount", { step: step + 1, total: all.length });
  $("#step-bar-fill").style.width = `${((step + 1) / all.length) * 100}%`;
  feedback("#registration-feedback", null);
  if (focus) {
    // Start each question at the top, under the step counter.
    $("#registration-form").scrollIntoView({ block: "start" });
    $<HTMLElement>("h2", all[step]).focus({ preventScroll: true });
  }
}

const value = (name: string): string =>
  String(new FormData($<HTMLFormElement>("#registration-form")).get(name) ?? "").trim();

// Checks one step. On a problem it says what, puts focus there and returns false.
function stepIsValid(index: number): boolean {
  const fieldset = steps()[index];
  const error = (key: MessageKey, focus: string): false => {
    feedback("#registration-feedback", key);
    $(focus).focus();
    return false;
  };
  for (const control of $$<HTMLInputElement | HTMLTextAreaElement>("input:not([type=checkbox]):not([type=radio]), textarea", fieldset)) {
    if (!control.checkValidity()) {
      control.reportValidity();
      return false;
    }
  }
  switch (fieldset.dataset.step) {
    case "phone":
      if (!normalisePhone(value("phone"))) return error("join.error.phone", "#provider-phone");
      if (value("whatsapp") && !normalisePhone(value("whatsapp"))) return error("join.error.whatsapp", "#provider-whatsapp");
      return true;
    case "vehicle":
      return isVehicle(value("vehicle")) || error("join.error.lists", "#provider-vehicle-options input");
    case "areas":
    case "waste": {
      const group = fieldset.dataset.step;
      const none = checkedValues(`#provider-${group === "areas" ? "area" : "waste"}-options`).length === 0;
      setGroupError(group, none);
      if (none) $(`#provider-${group} input`).focus();
      return !none;
    }
    default:
      return true;
  }
}

function nextStep(): void {
  if (stepIsValid(step)) showStep(step + 1);
}

async function showForm(signedInPhone: string): Promise<void> {
  showOnly("#registration-form");
  if (!(await ensureAreas())) {
    $("#provider-area-options").innerHTML = `<p class="field-error">${escapeHTML(t("join.areas.loadError"))}</p>`;
    return;
  }
  if (!$("#provider-area-options").querySelector("input")) {
    $("#provider-area-options").innerHTML = tiles("checkbox", "area", areas().map((area) => ({ value: area.id, label: area.name })));
  }
  if (!formFilled) {
    fillForm(myListing, signedInPhone);
    formFilled = true;
    showStep(0, false);
  } else {
    showStep(step, false);
  }
}

// Enter on a phone keyboard goes to the next question; on the last one it
// opens the preview. Every step is checked again before the preview.
function handleRegistration(event: SubmitEvent): void {
  event.preventDefault();
  const all = steps();
  if (step < all.length - 1) {
    nextStep();
    return;
  }
  for (let index = 0; index < all.length; index++) {
    if (!stepIsValid(index)) {
      if (index !== step) {
        showStep(index);
        stepIsValid(index);
      }
      return;
    }
  }
  const whatsapp = value("whatsapp");
  draft = {
    id: myListing?.id ?? null,
    name: value("name"),
    vehicle: value("vehicle"),
    description: value("description"),
    phone: normalisePhone(value("phone")) ?? "",
    whatsapp: whatsapp ? normalisePhone(whatsapp) ?? "" : "",
    areas: checkedValues("#provider-area-options").filter((id) => areas().some((area) => area.id === id)),
    waste: checkedValues("#provider-waste-options").filter(isWaste),
    consent: $<HTMLInputElement>("#provider-consent").checked
  };
  go("preview");
}

// Preview ------------------------------------------------------------------------

export function renderPreview(): void {
  const listing = draft;
  if (!listing || !isVehicle(listing.vehicle)) return;
  const row = (label: string, text: string) =>
    `<div class="detail-row"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(text)}</p></div>`;

  $("#preview-feedback").hidden = true;
  $("#preview-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-picture">${vehiclePicture(listing.vehicle)}<span>${escapeHTML(vehicleLabel(listing.vehicle))}</span></div>
        <h2>${escapeHTML(listing.name)}</h2>
        <div class="profile-labels"><span class="demo-label">${escapeHTML(t("preview.notPublished"))}</span></div>
        <p class="card-area profile-area">${icon("pin")}<span>${escapeHTML(listing.areas.map(areaName).join(", "))}</span></p>
        <ul class="waste-list">${listing.waste.map((id) => `
          <li>${wastePicture(id as WasteId)}<span>${escapeHTML(wasteLabel(id as WasteId))}</span></li>`).join("")}
        </ul>
        ${row(t("preview.phoneForResidents"), listing.phone)}
        ${listing.whatsapp ? row(t("preview.whatsapp"), listing.whatsapp) : ""}
        <p class="consent-line ${listing.consent ? "is-yes" : "is-no"}">${icon(listing.consent ? "tick" : "noPhone")}<span>${
          escapeHTML(t("preview.consent"))}: ${escapeHTML(t(listing.consent ? "preview.consentYes" : "preview.consentNo"))}</span></p>
        ${listing.description ? row(t("preview.description"), listing.description) : ""}
        <p class="small-note">${escapeHTML(t("preview.reviewNote"))}</p>
      </article>`;
}

const SAVE_ERRORS: Record<"offline" | "unknown" | "signed-out" | "invalid" | "failed", MessageKey> = {
  offline: "preview.error.offline",
  unknown: "preview.error.unknown",
  "signed-out": "preview.error.signedOut",
  invalid: "preview.error.invalid",
  failed: "preview.error.failed"
};

// What saving did, from the listing's status afterwards.
const SAVED: Record<MyListing["status"], MessageKey> = {
  submitted: "preview.submitted",
  approved: "preview.savedLive",
  rejected: "preview.savedUnchanged",
  suspended: "preview.savedSuspended"
};

async function submitListing(): Promise<void> {
  const listing = draft;
  // A flag, not just the disabled button: the session check below can take a
  // network round trip, and a second tap must not save twice.
  if (!listing || submitting) return;
  submitting = true;
  try {
    const result = await busy($<HTMLButtonElement>("#submit-listing"), "preview.submitting", async () => {
      const session = await currentSession();
      return session ? saveMyListing(session, listing) : ({ ok: false, error: "signed-out" } as const);
    });
    if (!result.ok) {
      feedback("#preview-feedback", SAVE_ERRORS[result.error]);
      return;
    }
    const savedFor = loadedFor;
    resetCollectorState();
    loadedFor = savedFor;
    go("join");
    toast(t(SAVED[result.status]));
    void reloadListings();
  } finally {
    submitting = false;
  }
}

// Screen -------------------------------------------------------------------------

let renderToken = 0;

// Decides what the Join screen shows: sign-in, the form, or the status.
export async function renderJoin(): Promise<void> {
  const token = ++renderToken;
  const session = await currentSession();
  if (token !== renderToken) return;
  if (!session) {
    resetCollectorState();
    showSignIn();
    return;
  }
  if (loadedFor !== session.userId) {
    resetCollectorState();
    loadedFor = session.userId;
  }
  $("#signed-in-as").textContent = t("join.signedInAs", { phone: session.phone || session.email || "" });
  if (!session.phone && session.email) {
    showAdminSignedIn();
    return;
  }
  $("#delete-account").hidden = false;
  if (editing) {
    await showForm(session.phone);
    return;
  }
  showOnly("#join-loading");
  const [result] = await Promise.all([fetchMyListing(session), ensureAreas()]);
  if (token !== renderToken) return;
  if (!result.ok) {
    if (result.error === "signed-out") {
      await signOut();
      resetCollectorState();
      showSignIn();
    } else {
      showLoadError();
    }
    return;
  }
  myListing = result.value;
  if (myListing) {
    showStatus(myListing);
  } else {
    editing = true;
    await showForm(session.phone);
  }
}

const ACTION_ERRORS: Record<Exclude<ActionResult, "ok">, MessageKey> = {
  offline: "join.action.offline",
  unknown: "join.action.unknown",
  "signed-out": "preview.error.signedOut",
  failed: "join.action.failed"
};

async function toggleToday(button: HTMLButtonElement): Promise<void> {
  const available = button.dataset.available === "1";
  const result = await busy(button, "join.today.saving", async () => {
    const session = await currentSession();
    return session ? setAvailability(session, available) : "signed-out";
  });
  toast(t(result === "ok" ? (available ? "join.today.savedOn" : "join.today.savedOff") : ACTION_ERRORS[result]));
  if (result === "offline") return;
  await renderJoin();
  void reloadListings();
}

async function handleDeleteAccount(): Promise<void> {
  const result = await busy($<HTMLButtonElement>("#delete-confirm-yes"), "join.delete.deleting", async () => {
    const session = await currentSession();
    return session ? deleteAccount(session) : "signed-out";
  });
  if (result !== "ok") {
    toast(t(ACTION_ERRORS[result]));
    return;
  }
  forgetSession();
  resetCollectorState();
  toast(t("join.delete.done"));
  await renderJoin();
  void reloadListings();
}

async function handleSignOut(): Promise<void> {
  await signOut();
  resetCollectorState();
  toast(t("join.signedOut"));
  await renderJoin();
}

export function bindJoin(): void {
  $<HTMLFormElement>("#signin-phone-form").addEventListener("submit", (event) => void handlePhone(event));
  $<HTMLFormElement>("#signin-code-form").addEventListener("submit", (event) => void handleCode(event));
  $("#signin-change").addEventListener("click", changeNumber);
  $<HTMLFormElement>("#registration-form").addEventListener("submit", handleRegistration);
  $("#step-next").addEventListener("click", nextStep);
  $("#step-back").addEventListener("click", () => showStep(step - 1));
  $("#provider-vehicle-options").addEventListener("change", () => feedback("#registration-feedback", null));
  for (const group of ["areas", "waste"] as const) {
    $(`#provider-${group}`).addEventListener("change", () => {
      if ($$(`#provider-${group} input:checked`).length > 0) setGroupError(group, false);
    });
  }
  $("#my-listing").addEventListener("click", (event) => {
    const target = event.target as Element;
    const today = target.closest<HTMLButtonElement>("#toggle-today");
    if (today) {
      void toggleToday(today);
    } else if (target.closest("#edit-listing")) {
      editing = true;
      formFilled = false;
      void renderJoin();
    } else if (target.closest("#retry-join")) {
      void renderJoin();
    }
  });
  $("#submit-listing").addEventListener("click", () => void submitListing());
  $("#sign-out").addEventListener("click", () => void handleSignOut());
  $("#delete-account").addEventListener("click", () => {
    $("#delete-confirm").hidden = false;
    $("#delete-cancel").focus();
  });
  $("#delete-cancel").addEventListener("click", () => {
    $("#delete-confirm").hidden = true;
    $("#delete-account").focus();
  });
  $("#delete-confirm-yes").addEventListener("click", () => void handleDeleteAccount());
}
