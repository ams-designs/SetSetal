// Sends residents' reports, keeping any that can't go yet in a small outbox on
// the phone and sending them when it is back online. Reports never hold a
// resident's address or identity (product rule 3).
import { sendReport, type NewReport } from "./api";

const OUTBOX_KEY = "setsetal.outbox.v1";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

interface QueuedReport {
  // Local only, so one item can be removed without rewriting the others.
  id: string;
  report: NewReport;
  queuedAt: number;
}

export type SubmitResult = "sent" | "sentUnlinked" | "queued" | "failed" | "rejected" | "unavailable";

function readRaw(): QueuedReport[] {
  try {
    const saved = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as unknown;
    return Array.isArray(saved)
      ? (saved as QueuedReport[]).filter((item) => typeof item?.id === "string" && typeof item.queuedAt === "number" && item.report)
      : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: QueuedReport[]): boolean {
  try {
    if (items.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
    else localStorage.removeItem(OUTBOX_KEY);
    return true;
  } catch {
    return false;
  }
}

// Every change re-reads storage, so a report saved while a flush is running is
// never overwritten.
const addToOutbox = (report: NewReport): boolean =>
  writeOutbox([...readRaw(), { id: crypto.randomUUID(), report, queuedAt: Date.now() }]);
const removeFromOutbox = (id: string): boolean => writeOutbox(readRaw().filter((item) => item.id !== id));

// If the server refuses only the listing link (the listing is no longer
// shown), the report goes without it, and the result says so.
async function deliver(report: NewReport): Promise<"sent" | "sentUnlinked" | "retry" | "rejected" | "unavailable"> {
  const result = await sendReport(report);
  if (result !== "link-rejected") return result;
  const unlinked = await sendReport({ ...report, collector_id: null });
  if (unlinked === "sent") return "sentUnlinked";
  return unlinked === "link-rejected" ? "rejected" : unlinked;
}

export async function submitReport(report: NewReport): Promise<SubmitResult> {
  const result = await deliver(report);
  if (result !== "retry") return result;
  return addToOutbox(report) ? "queued" : "failed";
}

export interface FlushResult {
  sent: number;
  // Refused by the server, or older than 30 days.
  dropped: number;
}

let flushing = false;

async function flush(): Promise<FlushResult> {
  const outcome: FlushResult = { sent: 0, dropped: 0 };
  for (const item of readRaw()) {
    if (Date.now() - item.queuedAt >= MAX_AGE) {
      removeFromOutbox(item.id);
      outcome.dropped++;
    }
  }
  for (const item of readRaw()) {
    const result = await deliver(item.report);
    if (result === "retry" || result === "unavailable") break;
    removeFromOutbox(item.id);
    if (result === "rejected") outcome.dropped++;
    else outcome.sent++;
  }
  return outcome;
}

// Sends what's waiting, oldest first, and stops at the first one that can't go
// yet. A lock keeps two open tabs from sending the same reports.
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing || !navigator.onLine || !readRaw().length) return { sent: 0, dropped: 0 };
  flushing = true;
  try {
    return navigator.locks
      ? await navigator.locks.request("setsetal-outbox", flush)
      : await flush();
  } finally {
    flushing = false;
  }
}

export function startOutbox(onFlushed: (result: FlushResult) => void): void {
  const run = () => void flushOutbox().then((result) => {
    if (result.sent || result.dropped) onFlushed(result);
  });
  window.addEventListener("online", run);
  run();
}
