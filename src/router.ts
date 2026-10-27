import { $, $$ } from "./ui";

export const SCREENS = ["home", "find", "profile", "join", "preview", "help", "admin"] as const;
export type ScreenId = (typeof SCREENS)[number];

export interface Route {
  screen: ScreenId;
  id: string | null;
}

interface HistoryEntry extends Route {
  depth: number;
}

// Hashes start with "#/". A hash matching a section id (such as "#find")
// would make the browser scroll to it and reset focus.
const PATHS: Record<ScreenId, string> = {
  home: "/",
  find: "/find",
  profile: "/collector",
  join: "/join",
  preview: "/join/preview",
  help: "/help",
  admin: "/admin"
};

// Bottom-nav item that stays highlighted on screens without their own item.
const NAV_PARENT: Partial<Record<ScreenId, ScreenId>> = { profile: "find", preview: "join" };

export const isScreen = (value: string): value is ScreenId =>
  (SCREENS as readonly string[]).includes(value);

export function hashFor(route: Route): string {
  const path = PATHS[route.screen];
  return "#" + (route.screen === "profile" && route.id ? `${path}/${encodeURIComponent(route.id)}` : path);
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  const collector = path.match(/^\/collector\/([^/]+)$/);
  if (collector) return { screen: "profile", id: decodeURIComponent(collector[1]) };
  const screen = SCREENS.find((id) => id !== "profile" && PATHS[id] === path);
  return { screen: screen ?? "home", id: null };
}

interface RouterHooks {
  // Returns the route to show instead when a screen's data is missing, for
  // example a profile id that does not exist, or a preview after a reload.
  resolve: (route: Route) => Route;
  // Renders data-driven screens before they are shown.
  beforeShow: (route: Route) => void;
}

let hooks: RouterHooks = { resolve: (route) => route, beforeShow: () => {} };
let current: Route = { screen: "home", id: null };

const currentEntry = (): HistoryEntry | null => history.state as HistoryEntry | null;

function show(route: Route, options: { focus?: boolean } = {}): void {
  hooks.beforeShow(route);
  current = route;

  $$(".screen").forEach((screen) => {
    const active = screen.id === route.screen;
    screen.classList.toggle("active", active);
    screen.hidden = !active;
  });

  const navTarget = NAV_PARENT[route.screen] ?? route.screen;
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.go === navTarget;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0, behavior: "auto" });

  if (options.focus !== false) {
    const heading = $(`#${route.screen} h1`);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function replace(route: Route, depth: number): void {
  const entry: HistoryEntry = { ...route, depth };
  history.replaceState(entry, "", hashFor(route));
}

// Browser history is the only back stack. Each entry stores its depth, so
// back() knows whether there is an in-app screen to return to.
export function go(screen: ScreenId, id: string | null = null): void {
  const route = hooks.resolve({ screen, id });
  if (route.screen === current.screen && route.id === current.id) return;
  const entry: HistoryEntry = { ...route, depth: (currentEntry()?.depth ?? 0) + 1 };
  history.pushState(entry, "", hashFor(route));
  show(route);
}

export const currentRoute = (): Route => current;

// Swaps the current screen without adding history, for data that turns out to
// be missing once it has loaded.
export function redirect(route: Route): void {
  replace(route, currentEntry()?.depth ?? 0);
  show(route);
}

export function back(): void {
  if ((currentEntry()?.depth ?? 0) > 0) {
    history.back(); // popstate shows the previous screen
  } else if (current.screen !== "home") {
    // Opened by deep link: there is no in-app screen behind this one.
    const home: Route = { screen: "home", id: null };
    replace(home, 0);
    show(home);
  }
}

function handlePopState(event: PopStateEvent): void {
  const entry = event.state as HistoryEntry | null;
  const requested = entry ?? parseHash(location.hash);
  const route = hooks.resolve({ screen: requested.screen, id: requested.id });
  if (!entry || route.screen !== requested.screen || route.id !== requested.id) {
    replace(route, entry?.depth ?? 0);
  }
  show(route);
}

export function startRouter(routerHooks: RouterHooks): void {
  hooks = routerHooks;
  const route = hooks.resolve(parseHash(location.hash));
  // A reload keeps the entry's depth, so back still works afterwards.
  const saved = currentEntry();
  const depth = saved && saved.screen === route.screen ? saved.depth : 0;
  replace(route, depth);
  show(route, { focus: false });
  window.addEventListener("popstate", handlePopState);
}
