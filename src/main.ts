import "./styles.css";
import { detectLocale, setLocale, t, translatePage, type MessageKey } from "./i18n";
import { bindForms, hasDraft, populateForms, renderPreview, updateAdminCounts } from "./forms";
import { bindInstall } from "./install";
import {
  clearFilters, findCollector, listingsPending, loadListings, populateFilters, renderCollectors, renderProfile,
  showingDemos
} from "./listings";
import { back, currentRoute, go, isScreen, redirect, startRouter, type Route } from "./router";
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
}

// Runs whenever the listings change: from the cache, then from the server.
function listingsChanged(): void {
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

    if (target.closest("[data-back]")) back();
  });

  $("#help-button").addEventListener("click", () => go("help"));

  $("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderCollectors();
  });

  $("#clear-filters").addEventListener("click", () => {
    clearFilters();
    renderCollectors();
  });
}

function init(): void {
  setLocale(detectLocale());
  translatePage();
  populateFilters();
  populateForms();
  bindNavigation();
  bindForms();
  bindInstall();
  startRouter({ resolve, beforeShow });
  renderCollectors();
  void loadListings(listingsChanged);
  updateAdminCounts();
  document.body.classList.add("ready");
}

init();
