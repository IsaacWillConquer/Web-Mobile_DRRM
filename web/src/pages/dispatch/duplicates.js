// Client-side duplicate detection (FR-14): flags reports of the same disaster
// type that land in the same ~110m grid cell within a short window.
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IGNORED_STATUSES = ["Rejected", "Duplicate", "Cancelled"];

function createdAtMs(report) {
  const ts = report.createdAt;
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// Returns Map<reportId, { of, type }>: report flagged as a possible duplicate of `of`.
export function findDuplicates(reports, { windowMs = DEFAULT_WINDOW_MS } = {}) {
  const flagged = new Map();
  const groups = {};

  reports.forEach((report) => {
    if (report.lat == null || report.lng == null) return;
    if (IGNORED_STATUSES.includes(report.status)) return;
    const key = `${report.disasterType ?? "Other"}|${report.lat.toFixed(3)}|${report.lng.toFixed(3)}`;
    (groups[key] ??= []).push(report);
  });

  Object.values(groups).forEach((group) => {
    const sorted = [...group].sort(
      (a, b) => (createdAtMs(a) ?? 0) - (createdAtMs(b) ?? 0),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const previousMs = createdAtMs(previous);
      const currentMs = createdAtMs(current);
      if (previousMs == null || currentMs == null) continue;
      if (currentMs - previousMs <= windowMs) {
        flagged.set(current.id, { of: previous.id, type: previous.disasterType });
      }
    }
  });

  return flagged;
}
