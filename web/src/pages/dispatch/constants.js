export const PRIORITY_COLORS = {
  low: "#22C55E",
  medium: "#F59E0B",
  high: "#EF4444",
};

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
