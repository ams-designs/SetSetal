import "./styles.css";
import { detectLocale, setLocale, t, translatePage, type MessageKey } from "./i18n";
import { bindAdmin, renderAdmin } from "./admin";
import { trackContact } from "./analytics";
import { loadLookups } from "./data/lookups";
import { bindForms, populateForms, setReportTarget } from "./forms";
import { bindJoin, hasDraft, leaveJoin, populateJoin, renderJoin, renderPreview } from "./join";
import { bindInstall } from "./install";
import {
  clearFilters, findCollector, listingsPending, loadListings, nameOf, populateFilters, renderCollectors, renderProfile,
  setAreaFilter, setVehicleFilter, showingDemos
} from "./listings";
import { back, currentRoute, go, isScreen, redirect, startRouter, type Route } from "./router";
import { startOutbox } from "./reports";
import { $, toast } from "./ui";

// Screens that need data fall back to a sensible parent when it is missing,
// for example after a reload or a deep link.
function resolve(route: Route): Route {
  if (route.screen === "profile") {
    // A shared link to a real listing waits for the listings to load.
    return findCollector(route.id) || listingsPending() ? route : { screen: "find", id: null };
  }
  if (route.screen === "preview" && !hasDraft()) return { screen: "join", id: null };
  return { screen: route.screen, id: null };
}

function beforeShow(route: Route): void {
  if (route.screen === "profile") renderProfile(route.id);
  if (route.screen === "preview") renderPreview();
  if (route.screen === "join") void renderJoin();
  else leaveJoin();
  if (route.screen === "admin") void renderAdmin();
}

// Runs whenever the lists of areas, vehicles, waste and report types change:
// from the cache, then from the server. Choices already made are kept.
function lookupsChanged(): void {
  populateFilters();
  populateForms();
  populateJoin();
  renderCollectors();
  const route = currentRoute();
  if (route.screen === "profile" && findCollector(route.id)) renderProfile(route.id);
}

// Runs whenever the listings change: from the cache, then from the server.
function listingsChanged(): void {
  // The area filter offers the samples' towns or the real areas.
  populateFilters();
  renderCollectors();
  const note = $("#help-listings-note");
  note.dataset.i18n = showingDemos() ? "help.using.demo" : "help.using.real";
  note.textContent = t(note.dataset.i18n as MessageKey);
  const route = currentRoute();
  if (route.screen !== "profile") return;
  if (findCollector(route.id)) renderProfile(route.id);
  else if (!listingsPending()) redirect({ screen: "find", id: null });
}

function bindNavigation(): void {
  document.addEventListener("click", (event) => {
    const target = event.target as Element;

    const goButton = target.closest<HTMLElement>("[data-go]");
    if (goButton) {
      event.preventDefault();
      const screen = goButton.dataset.go ?? "";
      if (screen === "help") setReportTarget(null);
      if (isScreen(screen)) go(screen);
      else toast(t("app.pageUnavailable"));
      return;
    }

    const profileButton = target.closest<HTMLElement>("[data-profile]");
    if (profileButton) {
      const id = profileButton.dataset.profile ?? "";
      if (findCollector(id)) go("profile", id);
      else toast(t("listing.notFound"));
      return;
    }

    const reportButton = target.closest<HTMLElement>("[data-report]");
    if (reportButton) {
      const listing = findCollector(reportButton.dataset.report ?? "");
      if (listing && !listing.demo) {
        setReportTarget({ id: listing.id, name: nameOf(listing) });
        go("help");
      }
      return;
    }

    // Counts the tap, never the person; the link then opens as usual.
    const contact = target.closest<HTMLElement>("[data-contact]");
    if (contact) {
      const channel = contact.dataset.contact;
      if (contact.dataset.id && (channel === "call" || channel === "whatsapp")) trackContact(contact.dataset.id, channel);
      return;
    }

    if (target.closest("[data-back]")) back();
  });

  bindFind();
}

// Find: the area button opens the tiles in place (no pop-up to dismiss), and
// every tap on an area or vehicle changes the list straight away.
function bindFind(): void {
  const areaButton = $<HTMLButtonElement>("#area-button");
  const setOpen = (open: boolean) => {
    areaButton.setAttribute("aria-expanded", String(open));
    $("#area-options").hidden = !open;
  };
  areaButton.addEventListener("click", () => {
    const open = areaButton.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    if (open) $<HTMLButtonElement>("#area-tiles [aria-pressed='true']")?.focus();
  });
  $("#area-tiles").addEventListener("click", (event) => {
    const tile = (event.target as Element).closest<HTMLElement>("[data-area]");
    if (!tile) return;
    setAreaFilter(tile.dataset.area ?? "all");
    setOpen(false);
    areaButton.focus();
    renderCollectors({ searched: true });
  });
  $("#vehicle-chips").addEventListener("click", (event) => {
    const chip = (event.target as Element).closest<HTMLElement>("[data-vehicle]");
    if (!chip) return;
    setVehicleFilter(chip.dataset.vehicle ?? "all");
    $<HTMLButtonElement>(`#vehicle-chips [data-vehicle="${CSS.escape(chip.dataset.vehicle ?? "all")}"]`)?.focus();
    renderCollectors({ searched: true });
  });
  $("#collector-results").addEventListener("click", (event) => {
    if (!(event.target as Element).closest("[data-show-all]")) return;
    clearFilters();
    renderCollectors();
    areaButton.focus();
  });
}

function init(): void {
  setLocale(detectLocale());
  translatePage();
  populateFilters();
  populateForms();
  populateJoin();
  bindNavigation();
  bindForms();
  bindJoin();
  bindAdmin();
  bindInstall();
  startRouter({ resolve, beforeShow });
  renderCollectors();
  void loadLookups(lookupsChanged);
  void loadListings(listingsChanged);
  startOutbox(({ sent, dropped }) => {
    const messages = [
      sent === 1 ? t("help.report.flushed.one") : sent > 1 ? t("help.report.flushed.other", { count: sent }) : "",
      dropped ? t("help.report.dropped") : ""
    ];
    toast(messages.filter(Boolean).join(" "));
  });
  document.body.classList.add("ready");
}

init();
