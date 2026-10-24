"use strict";

const SetSetal = (() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Single source for the lists used by filters, registration and validation.
  const AREAS = ["Banjul", "Bakau", "Kanifing", "Serrekunda", "Brikama"];
  const OTHER_AREA = "Other / not listed";
  const VEHICLES = ["Municipal truck", "Private truck", "Small car or van", "Tricycle", "Donkey cart", "Horse cart"];
  const WASTE_TYPES = ["Household bags", "Garden waste", "Bulky items", "Recyclables", "Business waste"];

  const state = {
    currentScreen: "home",
    profileId: null,
    reports: [],
    draftListing: null,
    installPrompt: null
  };

  // These are demonstration records, not real or verified businesses.
  const sampleCollectors = [
    {
      id: "demo-municipal",
      name: "Municipal collection service",
      vehicle: "Municipal truck",
      area: "Banjul",
      waste: ["Household bags", "Business waste"],
      description: "Example listing for an official collection service. Confirm service schedules with the relevant local authority.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    },
    {
      id: "demo-truck",
      name: "Local truck collection",
      vehicle: "Private truck",
      area: "Serrekunda",
      waste: ["Household bags", "Garden waste", "Bulky items"],
      description: "Example of a private truck service that may suit larger collection loads.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    },
    {
      id: "demo-van",
      name: "Small-load collection",
      vehicle: "Small car or van",
      area: "Kanifing",
      waste: ["Household bags", "Recyclables"],
      description: "Example listing for a small vehicle serving smaller loads.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    },
    {
      id: "demo-tricycle",
      name: "Neighbourhood collection",
      vehicle: "Tricycle",
      area: "Bakau",
      waste: ["Household bags", "Garden waste"],
      description: "Example of a smaller collection provider serving neighbourhood streets.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    },
    {
      id: "demo-donkey",
      name: "Cart collection service",
      vehicle: "Donkey cart",
      area: "Brikama",
      waste: ["Household bags", "Garden waste"],
      description: "Example listing representing traditional cart-based collection.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    },
    {
      id: "demo-horse",
      name: "Horse-cart collection",
      vehicle: "Horse cart",
      area: "Brikama",
      waste: ["Household bags", "Garden waste"],
      description: "Example listing representing horse-cart collection.",
      phone: "",
      contactEnabled: false,
      status: "Demonstration listing"
    }
  ];

  const vehicleSvg = {
    "Municipal truck": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M5 13h24v21H5zM29 20h8l7 8v6H29z"/>
        <path d="M33 22v6h8M9 18h16M9 23h16"/>
        <circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/>
      </svg>`,
    "Private truck": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 14h26v20H4zM30 21h8l6 7v6H30z"/>
        <path d="M33 23v5h8"/>
        <circle cx="13" cy="36" r="4"/><circle cx="37" cy="36" r="4"/>
      </svg>`,
    "Small car or van": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="m6 28 4-10a4 4 0 0 1 4-3h19a4 4 0 0 1 4 3l5 10v7H6z"/>
        <path d="m13 18-3 9h28l-5-9z"/>
        <circle cx="14" cy="35" r="4"/><circle cx="35" cy="35" r="4"/>
      </svg>`,
    "Tricycle": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="10" cy="35" r="5"/><circle cx="37" cy="35" r="5"/>
        <path d="M10 35h17l-5-13h-8l-4 13M22 22h12l3 13M21 18h7M27 18l4-5"/>
        <path d="M18 17h8"/>
      </svg>`,
    "Donkey cart": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="14" cy="35" r="6"/><circle cx="35" cy="35" r="6"/>
        <path d="M8 26h28l-2-10H13zM11 26v4M37 26l5 6"/>
        <path d="M17 16v-5h13v5M20 11V7h7v4"/>
      </svg>`,
    "Horse cart": `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="13" cy="35" r="6"/><circle cx="36" cy="35" r="6"/>
        <path d="M7 25h28l-2-9H13zM10 25v5M36 25l6 7"/>
        <path d="M18 15V9h12v6"/>
      </svg>`
  };

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  function toast(message) {
    const element = $("#toast");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      element.hidden = true;
    }, 3200);
  }

  function isScreen(screenId) {
    const target = document.getElementById(screenId);
    return Boolean(target && target.classList.contains("screen"));
  }

  function hashFor(screenId, id) {
    // "#/find" rather than "#find": a hash matching a section id makes the
    // browser scroll to it and reset focus.
    return "#/" + screenId + (id ? "/" + encodeURIComponent(id) : "");
  }

  function parseHash(hash) {
    const [screen, id] = hash.replace(/^#\/?/, "").split("/");
    return { screen: screen || "home", id: id ? decodeURIComponent(id) : null };
  }

  // Screens that need data fall back to a sensible parent when it is missing,
  // for example after a reload or a deep link.
  function resolveRoute(route) {
    if (!isScreen(route.screen)) return { screen: "home" };
    if (route.screen === "profile") {
      return sampleCollectors.some((item) => item.id === route.id)
        ? route
        : { screen: "find" };
    }
    if (route.screen === "preview" && !state.draftListing) return { screen: "join" };
    return { screen: route.screen, id: null };
  }

  // Browser history is the only back stack. Each entry stores its depth, so
  // back() knows whether there is an in-app screen to return to.
  function go(screenId, options = {}) {
    if (!isScreen(screenId)) {
      console.error("Unknown SetSetal screen:", screenId);
      toast("That page is not available yet.");
      return;
    }

    const id = options.id ?? null;
    const changed = screenId !== state.currentScreen || id !== state.profileId;

    if (!options.fromPop && changed) {
      const depth = (history.state?.depth ?? 0) + 1;
      history.pushState({ screen: screenId, id, depth }, "", hashFor(screenId, id));
    }

    if (screenId === "profile") renderProfile(id);
    show(screenId, id, options);
  }

  function show(screenId, id, options = {}) {
    state.currentScreen = screenId;
    state.profileId = id;

    $$(".screen").forEach((screen) => {
      const active = screen.id === screenId;
      screen.classList.toggle("active", active);
      screen.hidden = !active;
    });

    $$(".nav-item").forEach((button) => {
      const active = button.dataset.go === screenId ||
        (screenId === "profile" && button.dataset.go === "find") ||
        (screenId === "preview" && button.dataset.go === "join");
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    window.scrollTo({ top: 0, behavior: "auto" });

    if (options.focus !== false) {
      const heading = $(`#${screenId} h1`);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  function back() {
    if ((history.state?.depth ?? 0) > 0) {
      history.back(); // popstate renders the previous screen
    } else if (state.currentScreen !== "home") {
      // Opened by deep link: there is no in-app screen behind this one.
      history.replaceState({ screen: "home", id: null, depth: 0 }, "", hashFor("home"));
      show("home", null);
    }
  }

  function handlePopState(event) {
    const requested = event.state ?? parseHash(location.hash);
    const route = resolveRoute(requested);
    if (route.screen !== requested.screen || !event.state) {
      const depth = event.state?.depth ?? 0;
      history.replaceState({ screen: route.screen, id: route.id ?? null, depth }, "",
        hashFor(route.screen, route.id));
    }
    if (route.screen === "profile") renderProfile(route.id);
    show(route.screen, route.id ?? null);
  }

  function iconFor(vehicle) {
    return vehicleSvg[vehicle] || vehicleSvg["Private truck"];
  }

  function matchesFilters(collector, filters) {
    const areaMatches = filters.area === "All areas" ||
      collector.area === filters.area;

    const vehicleMatches = filters.vehicle === "all" ||
      collector.vehicle === filters.vehicle;

    const wasteMatches = filters.waste === "all" ||
      collector.waste.includes(filters.waste);

    return areaMatches && vehicleMatches && wasteMatches;
  }

  function collectorCard(collector) {
    return `
      <article class="collector-card">
        <div class="vehicle-art">${iconFor(collector.vehicle)}</div>
        <div>
          <h3>${escapeHTML(collector.name)}</h3>
          <p>${escapeHTML(collector.vehicle)} · ${escapeHTML(collector.area)}</p>
          <p>Waste types: ${escapeHTML(collector.waste.join(", "))}</p>
          <span class="demo-label">${escapeHTML(collector.status)}</span>
          <div class="card-actions">
            <button class="button secondary" type="button"
              data-profile="${escapeHTML(collector.id)}">View details</button>
          </div>
        </div>
      </article>`;
  }

  function renderCollectors() {
    const filters = {
      area: $("#area").value,
      vehicle: $("#vehicle-filter").value,
      waste: $("#waste-type").value
    };

    const results = sampleCollectors.filter((collector) =>
      matchesFilters(collector, filters)
    );

    $("#results-count").textContent =
      `${results.length} demonstration ${results.length === 1 ? "listing" : "listings"}`;

    let empty = `<div class="empty-state">
          <h3>No matching sample listings</h3>
          <p>Try a different area, vehicle, or waste type.</p>
        </div>`;

    if (filters.area === OTHER_AREA) {
      empty = `<div class="empty-state">
          <h3>We don't have listings for your area yet</h3>
          <p>Tell us where you are on the Help screen.</p>
          <button class="button secondary" type="button" data-go="help">Go to Help</button>
        </div>`;
    }

    $("#collector-results").innerHTML = results.length
      ? results.map(collectorCard).join("")
      : empty;
  }

  function showProfile(id) {
    if (!sampleCollectors.some((item) => item.id === id)) {
      toast("This listing could not be found.");
      return;
    }
    go("profile", { id });
  }

  function renderProfile(id) {
    const collector = sampleCollectors.find((item) => item.id === id);
    if (!collector) return;

    $("#profile-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-title-row">
          <div class="vehicle-art">${iconFor(collector.vehicle)}</div>
          <div>
            <h2>${escapeHTML(collector.name)}</h2>
            <span class="demo-label">Demonstration listing</span>
          </div>
        </div>
        <div class="detail-row">
          <strong>Vehicle or method</strong>
          <p>${escapeHTML(collector.vehicle)}</p>
        </div>
        <div class="detail-row">
          <strong>Service area</strong>
          <p>${escapeHTML(collector.area)}</p>
        </div>
        <div class="detail-row">
          <strong>Waste types</strong>
          <p>${escapeHTML(collector.waste.join(", "))}</p>
        </div>
        <div class="detail-row">
          <strong>About this service</strong>
          <p>${escapeHTML(collector.description)}</p>
        </div>
        <div class="notice">
          <strong>Contact details not connected</strong>
          <p>This sample has no real phone number. No call or booking can be made from this listing.</p>
        </div>
      </article>
      <button class="button secondary full-width" data-go="find">See all listings</button>`;
  }

  function readRegistration(form) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      vehicle: String(data.get("vehicle") || ""),
      area: String(data.get("area") || ""),
      waste: data.getAll("waste").map(String).filter((type) => WASTE_TYPES.includes(type)),
      description: String(data.get("description") || "").trim()
    };
  }

  function optionsHTML(values) {
    return values.map((value) =>
      `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`
    ).join("");
  }

  // Fill every list control from the constants above. Placeholder and special
  // options ("All areas", "Other / not listed") stay in index.html.
  function populateLists() {
    const fill = (selector, values) => {
      const select = $(selector);
      const other = $(`option[value="${OTHER_AREA}"]`, select);
      if (other) other.insertAdjacentHTML("beforebegin", optionsHTML(values));
      else select.insertAdjacentHTML("beforeend", optionsHTML(values));
    };

    fill("#area", AREAS);
    fill("#provider-area", AREAS);
    fill("#vehicle-filter", VEHICLES);
    fill("#provider-vehicle", VEHICLES);
    fill("#waste-type", WASTE_TYPES);

    $("#provider-waste-options").innerHTML = WASTE_TYPES.map((type) => `
      <label class="checkbox-row">
        <input type="checkbox" name="waste" value="${escapeHTML(type)}">
        <span>${escapeHTML(type)}</span>
      </label>`).join("");
  }

  function showPreview(listing) {
    $("#preview-content").innerHTML = `
      <article class="panel profile-card">
        <div class="profile-title-row">
          <div class="vehicle-art">${iconFor(listing.vehicle)}</div>
          <div>
            <h2>${escapeHTML(listing.name)}</h2>
            <span class="demo-label">Not published</span>
          </div>
        </div>
        <div class="detail-row"><strong>Vehicle</strong><p>${escapeHTML(listing.vehicle)}</p></div>
        <div class="detail-row"><strong>Main area</strong><p>${escapeHTML(listing.area)}</p></div>
        <div class="detail-row"><strong>Waste types</strong>
          <ul class="detail-list">${listing.waste.map((type) => `<li>${escapeHTML(type)}</li>`).join("")}</ul>
        </div>
        <div class="detail-row"><strong>Contact number</strong><p>${escapeHTML(listing.phone)}</p></div>
        <div class="detail-row"><strong>Service description</strong><p>${escapeHTML(listing.description || "No description provided.")}</p></div>
        <p class="small-note">This preview is temporary and visible only in this browser session.</p>
      </article>`;
    go("preview");
  }

  function updateAdminCounts() {
    $("#admin-listing-count").textContent = String(sampleCollectors.length);
    $("#admin-report-count").textContent = String(state.reports.length);
  }

  // The error is linked only while it shows, so it is never read out early.
  function setWasteError(show) {
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

  function handleRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const listing = readRegistration(form);
    const digits = listing.phone.replace(/\D/g, "");

    if (digits.length < 7) {
      $("#registration-feedback").hidden = false;
      $("#registration-feedback").textContent =
        "Please enter a phone number with at least 7 digits.";
      $("#provider-phone").focus();
      return;
    }

    if (!VEHICLES.includes(listing.vehicle) ||
        !(AREAS.includes(listing.area) || listing.area === OTHER_AREA)) {
      $("#registration-feedback").hidden = false;
      $("#registration-feedback").textContent = "Please choose a vehicle and an area from the lists.";
      return;
    }

    if (listing.waste.length === 0) {
      setWasteError(true);
      $("#provider-waste input").focus();
      return;
    }

    setWasteError(false);
    state.draftListing = listing;
    $("#registration-feedback").hidden = true;
    showPreview(listing);
  }

  function handleReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    state.reports.push({
      type: String(data.get("type") || "General feedback"),
      message: String(data.get("message") || "").trim(),
      createdAt: new Date().toISOString()
    });

    $("#report-feedback").hidden = false;
    $("#report-feedback").innerHTML =
      "<strong>Feedback recorded in this demo.</strong><p>It has not been sent to a server or administrator.</p>";

    form.reset();
    updateAdminCounts();
  }

  function installPWA() {
    if (!state.installPrompt) {
      toast("If your browser supports installation, use its browser menu and choose Install app or Add to Home screen.");
      return;
    }

    const prompt = state.installPrompt;
    // A prompt can be used only once, so hide the button whatever the outcome.
    state.installPrompt = null;
    $("#install-button").hidden = true;

    prompt.prompt();
    prompt.userChoice.then((choice) => {
      if (choice && choice.outcome === "accepted") {
        toast("Installation accepted by the browser.");
      } else {
        toast("Installation was cancelled.");
      }
    }).catch(() => {
      toast("Use your browser menu to install SetSetal.");
    });
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const goButton = event.target.closest("[data-go]");
      if (goButton) {
        event.preventDefault();
        go(goButton.dataset.go);
        return;
      }

      const profileButton = event.target.closest("[data-profile]");
      if (profileButton) {
        showProfile(profileButton.dataset.profile);
        return;
      }

      if (event.target.closest("[data-back]")) {
        back();
      }
    });

    $("#help-button").addEventListener("click", () => go("help"));

    $("#search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      renderCollectors();
    });

    $("#clear-filters").addEventListener("click", () => {
      $("#area").value = "All areas";
      $("#vehicle-filter").value = "all";
      $("#waste-type").value = "all";
      renderCollectors();
    });

    $("#registration-form").addEventListener("submit", handleRegistration);
    $("#provider-waste").addEventListener("change", () => {
      if ($$("#provider-waste input:checked").length > 0) setWasteError(false);
    });
    $("#report-form").addEventListener("submit", handleReport);

    $("#finish-preview").addEventListener("click", () => {
      state.draftListing = null;
      $("#registration-form").reset();
      go("home");
      toast("Preview finished. Nothing was published or submitted.");
    });

    $("#install-button").addEventListener("click", installPWA);

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
      $("#install-button").hidden = false;
    });

    window.addEventListener("appinstalled", () => {
      state.installPrompt = null;
      $("#install-button").hidden = true;
      toast("SetSetal was installed.");
    });

    window.addEventListener("popstate", handlePopState);
  }

  function initRoute() {
    const route = resolveRoute(parseHash(location.hash));
    // A reload keeps the entry's depth, so back still works afterwards.
    const depth = history.state?.screen === route.screen ? history.state.depth ?? 0 : 0;
    history.replaceState(
      { screen: route.screen, id: route.id ?? null, depth },
      "",
      hashFor(route.screen, route.id)
    );
    if (route.screen === "profile") renderProfile(route.id);
    show(route.screen, route.id ?? null, { focus: false });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(window.location.protocol)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }

  function init() {
    populateLists();
    bindEvents();
    initRoute();
    renderCollectors();
    updateAdminCounts();
    registerServiceWorker();
  }

  return { init, go, installPWA };
})();

document.addEventListener("DOMContentLoaded", SetSetal.init);