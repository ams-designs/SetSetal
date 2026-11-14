// An optional "are you a person?" check before a sign-in code is sent, so
// nobody can run up the SMS bill with a script. It is on only when the build
// has a Cloudflare Turnstile site key (VITE_TURNSTILE_SITE_KEY) and Supabase
// Auth has the matching secret; without a key, sign-in works as before.
//
// The script is downloaded only when the sign-in form is shown, so residents,
// who never sign in, never load it.

interface Turnstile {
  render(container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }): string;
  reset(widget: string): void;
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const captchaEnabled = Boolean(siteKey);

let script: Promise<Turnstile | null> | null = null;
let widget: string | null = null;
let token: string | null = null;
// Someone waiting for the check to pass.
let waiting: (() => void) | null = null;

const turnstile = (): Turnstile | undefined => (window as Window & { turnstile?: Turnstile }).turnstile;

function loadScript(): Promise<Turnstile | null> {
  script ??= new Promise((resolve) => {
    const element = document.createElement("script");
    element.src = SCRIPT;
    element.async = true;
    element.onload = () => resolve(turnstile() ?? null);
    element.onerror = () => {
      // Offline, or blocked: let the next visit to the form try again.
      script = null;
      element.remove();
      resolve(null);
    };
    document.head.append(element);
  });
  return script;
}

// Shows the check inside the container. Safe to call every time the sign-in
// form is shown.
export async function showCaptcha(container: HTMLElement): Promise<void> {
  if (!siteKey || widget !== null) return;
  const api = await loadScript();
  if (!api || widget !== null) return;
  widget = api.render(container, {
    sitekey: siteKey,
    callback: (value) => {
      token = value;
      waiting?.();
    },
    "expired-callback": () => { token = null; },
    "error-callback": () => { token = null; }
  });
}

// The token to send with the next code request. Most checks pass by
// themselves within a second or two, so this waits a little for one that is
// still running; null means the person still has to finish it. A token works
// once, so taking it starts a new check.
export async function takeCaptchaToken(waitMs = 8000): Promise<string | null> {
  if (!token) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, waitMs);
      waiting = () => {
        window.clearTimeout(timer);
        resolve();
      };
    });
    waiting = null;
  }
  const value = token;
  token = null;
  if (value && widget !== null) turnstile()?.reset(widget);
  return value;
}
