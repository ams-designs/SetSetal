export const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

export const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(selector)];

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export const escapeHTML = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

let toastTimer: number | undefined;

export function toast(message: string): void {
  const element = document.getElementById("toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    element.hidden = true;
  }, 3200);
}
