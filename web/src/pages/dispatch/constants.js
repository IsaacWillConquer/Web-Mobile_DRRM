export const PRIORITY_COLORS = {
  low: "#22C55E",
  medium: "#F59E0B",
  high: "#EF4444",
};

// Statuses that are final: an incident in one of these no longer needs rescue.
export const TERMINAL_STATUSES = [
  "Resolved",
  "Closed",
  "Rejected",
  "Duplicate",
  "Cancelled",
];

export function isActiveStatus(status) {
  return !TERMINAL_STATUSES.includes(status);
}

const HOUR_MS = 3600000;

// Time-based rescue priority: the longer an incident waits, the higher it
// ranks. Priority is derived purely from submission time — no severity input.
export const AGE_BUCKETS = [
  { key: "critical", min: 6 * HOUR_MS, label: "6h+ waiting", color: "#EF4444" },
  { key: "urgent", min: 3 * HOUR_MS, label: "3–6h waiting", color: "#F59E0B" },
  { key: "recent", min: 1 * HOUR_MS, label: "1–3h waiting", color: "#FBBF24" },
  { key: "new", min: 0, label: "<1h waiting", color: "#3B82F6" },
];

export function ageBucket(waitingMs) {
  const ms = Number.isFinite(waitingMs) && waitingMs > 0 ? waitingMs : 0;
  return AGE_BUCKETS.find((b) => ms >= b.min) ?? AGE_BUCKETS[AGE_BUCKETS.length - 1];
}

// `createdAt` / `history[].at` is a Firestore Timestamp (web), an epoch-ms
// number, or an ISO string (mobile). Normalize to epoch-ms, null-safe.
export function tsMillis(ts) {
  if (ts == null) return null;
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, ms) / 60000;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export const STATUS_STYLES = {
  Submitted: "bg-slate-100 text-slate-700",
  "Under Verification": "bg-amber-100 text-amber-800",
  Verified: "bg-emerald-100 text-emerald-800",
  "Awaiting Assignment": "bg-indigo-100 text-indigo-800",
  "Team Assigned": "bg-blue-100 text-blue-800",
  "Rescue in Progress": "bg-blue-100 text-blue-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-slate-200 text-slate-700",
  Rejected: "bg-red-100 text-red-800",
  Duplicate: "bg-red-100 text-red-800",
  Cancelled: "bg-red-100 text-red-800",
};

export function statusChip(status) {
  return `inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`;
}
