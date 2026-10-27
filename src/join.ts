// The Join screen for collectors: sign in with an SMS code, fill in the
// listing, check the preview, submit it for review, then follow its status.
import { t, type MessageKey } from "./i18n";
import { isVehicle, isWaste, vehicleLabel, wasteLabel, type VehicleId, type WasteId } from "./data/lookups";
import { fillSelect, iconFor, vehicleOptions, wasteOptions } from "./listings";
import { currentSession, normalisePhone, requestCode, signOut, verifyCode, type AuthResult } from "./auth";
import { fetchAreas, fetchMyListing, saveMyListing, type Area, type ListingDraft, type MyListing } from "./collector";
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
let areas: Area[] = [];
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
  $<HTMLFormElement>("#registration-form").reset();
}

export const hasDraft = (): boolean => draft !== null;

const SECTIONS = ["#join-loading", "#join-signin", "#my-listing", "#registration-form"];

function showOnly(selector: string): void {
  SECTIONS.forEach((section) => { $(section).hidden = section !== selector; });
  $("#signed-in").hidden = selector === "#join-signin" || selector === "#join-loading";
  $("#registration-feedback").hidden = true;
}

const checkboxes = (name: string, items: { value: string; label: string }[]): string =>
  items.map(({ value, label }) => `
      <label class="checkbox-row">
        <input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(value)}">
        <span>${escapeHTML(label)}</span>
      </label>`).join("");

export function populateJoin(): void {
  fillSelect($<HTMLSelectElement>("#provider-vehicle"), vehicleOptions());
  $("#provider-waste-options").innerHTML = checkboxes("waste", wasteOptions());
}

const areaName = (id: string): string => areas.find((area) => area.id === id)?.name ?? id;

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
}

const SIGNIN_ERRORS: Record<Exclude<AuthResult, "ok">, MessageKey> = {
  unavailable: "join.signin.error.unavailable",
  offline: "join.signin.error.offline",
  invalid: "join.signin.error.invalidPhone",
  "rate-limited": "join.signin.error.rateLimited",
  failed: "join.signin.error.failed"
};

async function busy<T>(button: HTMLButtonElement, label: MessageKey, task: () => Promise<T>): Promise<T> {
  const idle = button.textContent;
  button.disabled = true;
  button.textContent = t(label);
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = idle;
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
  const result = await busy($<HTMLButtonElement>("#signin-send"), "join.signin.sending", () => requestCode(phone));
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

function showStatus(listing: MyListing): void {
  showOnly("#my-listing");
  const paragraph = (text: string) => `<p>${escapeHTML(text)}</p>`;
  const lines = [
    paragraph(t(`join.status.${listing.status}Body`)),
    listing.reason ? paragraph(t("join.status.reason", { reason: listing.reason })) : "",
    listing.status === "approved" && !listing.consent ? paragraph(t("join.status.approvedNoConsent")) : ""
  ].join("");
  const summary = [
    isVehicle(listing.vehicle) ? vehicleLabel(listing.vehicle) : listing.vehicle,
    listing.areas.map(areaName).join(", ")
  ].filter(Boolean).join(" · ");

  $("#my-listing").innerHTML = `
      <article class="panel">
        <h2>${escapeHTML(t("join.status.title"))}</h2>
        <h3>${escapeHTML(listing.name)}</h3>
        <p class="muted">${escapeHTML(summary)}</p>
        <div class="notice">
          <strong>${escapeHTML(t(`join.status.${listing.status}`))}</strong>
          ${lines}
        </div>
        <button class="button secondary full-width" type="button" id="edit-listing">${escapeHTML(t("join.status.edit"))}</button>
        <p class="small-note">${escapeHTML(t(listing.status === "suspended" ? "join.status.suspendedEditNote" : "join.status.editNote"))}</p>
      </article>`;
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

async function ensureAreas(): Promise<boolean> {
  if (areas.length) return true;
  const result = await fetchAreas();
  if (result.ok) areas = result.value;
  return areas.length > 0;
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
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  field("name").value = listing?.name ?? "";
  field("phone").value = listing?.phone || signedInPhone;
  field("whatsapp").value = listing?.whatsapp ?? "";
  field("vehicle").value = listing?.vehicle ?? "";
  field("description").value = listing?.description ?? "";
  $<HTMLInputElement>("#provider-consent").checked = listing?.consent ?? false;
  for (const input of $$<HTMLInputElement>("#registration-form input[type=checkbox][name=area], #registration-form input[type=checkbox][name=waste]")) {
    input.checked = (input.name === "area" ? listing?.areas : listing?.waste)?.includes(input.value) ?? false;
  }
}

async function showForm(signedInPhone: string): Promise<void> {
  showOnly("#registration-form");
  if (!(await ensureAreas())) {
    $("#provider-area-options").innerHTML = `<p class="field-error">${escapeHTML(t("join.areas.loadError"))}</p>`;
    return;
  }
  if (!$("#provider-area-options").querySelector("input")) {
    $("#provider-area-options").innerHTML = checkboxes("area", areas.map((area) => ({ value: area.id, label: area.name })));
  }
  if (!formFilled) {
    fillForm(myListing, signedInPhone);
    formFilled = true;
  }
}

function handleRegistration(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const phone = normalisePhone(String(data.get("phone") ?? ""));
  const whatsappInput = String(data.get("whatsapp") ?? "").trim();
  const whatsapp = whatsappInput ? normalisePhone(whatsappInput) : "";
  const vehicle = String(data.get("vehicle") ?? "");
  const chosenAreas = data.getAll("area").map(String).filter((id) => areas.some((area) => area.id === id));
  const waste = data.getAll("waste").map(String).filter(isWaste);

  const error = (key: MessageKey, focus: string) => {
    feedback("#registration-feedback", key);
    $(focus).focus();
  };
  if (!phone) return error("join.error.phone", "#provider-phone");
  if (whatsapp === null) return error("join.error.whatsapp", "#provider-whatsapp");
  if (!isVehicle(vehicle)) return error("join.error.lists", "#provider-vehicle");
  setGroupError("areas", chosenAreas.length === 0);
  if (chosenAreas.length === 0) return void $("#provider-areas input").focus();
  setGroupError("waste", waste.length === 0);
  if (waste.length === 0) return void $("#provider-waste input").focus();

  feedback("#registration-feedback", null);
  draft = {
    id: myListing?.id ?? null,
    name: String(data.get("name") ?? "").trim(),
    vehicle,
    description: String(data.get("description") ?? "").trim(),
    phone,
    whatsapp,
    areas: chosenAreas,
    waste,
    consent: data.get("consent") !== null
  };
  go("preview");
}

// Preview ------------------------------------------------------------------------

export function renderPreview(): void {
  const listing = draft;
  if (!listing) return;
  const row = (label: string, value: string) =>
    `<div class="detail-row"><strong>${escapeHTML(label)}</strong><p>${escapeHTML(value)}</p></div>`;

  $("#preview-feedback").hidden = true;
  $("#preview-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-title-row">
          <div class="vehicle-art">${iconFor(listing.vehicle as VehicleId)}</div>
          <div>
            <h2>${escapeHTML(listing.name)}</h2>
            <span class="demo-label">${escapeHTML(t("preview.notPublished"))}</span>
          </div>
        </div>
        ${row(t("preview.vehicle"), vehicleLabel(listing.vehicle as VehicleId))}
        ${row(t("preview.area"), listing.areas.map(areaName).join(", "))}
        <div class="detail-row"><strong>${escapeHTML(t("preview.waste"))}</strong>
          <ul class="detail-list">${listing.waste.map((id) => `<li>${escapeHTML(wasteLabel(id as WasteId))}</li>`).join("")}</ul>
        </div>
        ${row(t("preview.phoneForResidents"), listing.phone)}
        ${listing.whatsapp ? row(t("preview.whatsapp"), listing.whatsapp) : ""}
        ${row(t("preview.consent"), t(listing.consent ? "preview.consentYes" : "preview.consentNo"))}
        ${row(t("preview.description"), listing.description || t("preview.noDescription"))}
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
  $("#signed-in-as").textContent = t("join.signedInAs", { phone: session.phone });
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
  for (const group of ["areas", "waste"] as const) {
    $(`#provider-${group}`).addEventListener("change", () => {
      if ($$(`#provider-${group} input:checked`).length > 0) setGroupError(group, false);
    });
  }
  $("#my-listing").addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest("#edit-listing")) {
      editing = true;
      formFilled = false;
      void renderJoin();
    } else if (target.closest("#retry-join")) {
      void renderJoin();
    }
  });
  $("#submit-listing").addEventListener("click", () => void submitListing());
  $("#sign-out").addEventListener("click", () => void handleSignOut());
}
