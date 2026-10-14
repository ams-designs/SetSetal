"use strict";

const SetSetal = (() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    currentScreen: "home",
    history: ["home"],
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

  function go(screenId, options = {}) {
    const target = document.getElementById(screenId);
    if (!target || !target.classList.contains("screen")) {
      console.error("Unknown SetSetal screen:", screenId);
      toast("That page is not available yet.");
      return;
    }

    if (screenId !== state.currentScreen && options.back !== true) {
      state.history.push(state.currentScreen);
    }

    state.currentScreen = screenId;

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
  }

  function back() {
    if (state.history.length > 1) {
      state.history.pop();
      const previous = state.history.pop();
      go(previous || "home");
    } else {
      go("home", { back: true });
    }
  }

  function iconFor(vehicle) {
    return vehicleSvg[vehicle] || vehicleSvg["Private truck"];
  }

  function matchesFilters(collector, filters) {
    const areaMatches = filters.area === "All areas" ||
      filters.area === "Other / not listed" ||
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

    $("#collector-results").innerHTML = results.length
      ? results.map(collectorCard).join("")
      : `<div class="empty-state">
          <h3>No matching sample listings</h3>
          <p>Try a different area, vehicle, or waste type.</p>
        </div>`;
  }

  function showProfile(id) {
    const collector = sampleCollectors.find((item) => item.id === id);
    if (!collector) {
      toast("This listing could not be found.");
      return;
    }

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
      <button class="button secondary full-width" data-go="find">Back to listings</button>`;

    go("profile");
  }

  function readRegistration(form) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      vehicle: String(data.get("vehicle") || ""),
      area: String(data.get("area") || ""),
      waste: String(data.get("waste") || "Household bags"),
      description: String(data.get("description") || "").trim()
    };
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
        <div class="detail-row"><strong>Waste type</strong><p>${escapeHTML(listing.waste)}</p></div>
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

    state.installPrompt.prompt();
    state.installPrompt.userChoice.then((choice) => {
      if (choice && choice.outcome === "accepted") {
        toast("Installation accepted by the browser.");
      } else {
        toast("Installation was cancelled.");
      }
      state.installPrompt = null;
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
    $("#report-form").addEventListener("submit", handleReport);

    $("#finish-preview").addEventListener("click", () => {
      state.draftListing = null;
      $("#registration-form").reset();
      go("home");
      toast("Preview finished. Nothing was published or submitted.");
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
      toast("SetSetal can be installed from the browser menu.");
    });

    window.addEventListener("appinstalled", () => {
      state.installPrompt = null;
      toast("SetSetal was installed.");
    });
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
    bindEvents();
    renderCollectors();
    updateAdminCounts();
    registerServiceWorker();
  }

  return { init, go, installPWA };
})();

document.addEventListener("DOMContentLoaded", SetSetal.init);