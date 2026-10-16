import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import * as reportsService from "../../core/services/reportsService";
import * as rescueRecordsService from "../../core/services/rescueRecordsService";
import { watchAllUsers } from "../../core/services/usersService";
import { Badge, Button, Card, EmptyState, Icon, Spinner } from "../../components/ui";
import {
  AreaTrend,
  Bars,
  Donut,
  DonutLegend,
  HBarList,
} from "../../components/charts";
import { CHART_COLORS, PALETTE } from "../../components/chartColors";
import { DISASTER_TYPES } from "../../config/appConfig";
import { statusChip } from "../dispatch/constants";

const OPEN_STATUSES = [
  "Submitted",
  "Under Verification",
  "Verified",
  "Awaiting Assignment",
  "Team Assigned",
  "Rescue in Progress",
];

const STATUS_COLORS = {
  Submitted: CHART_COLORS.slate,
  "Under Verification": CHART_COLORS.amber,
  Verified: CHART_COLORS.emerald,
  "Awaiting Assignment": CHART_COLORS.indigo,
  "Team Assigned": CHART_COLORS.blue,
  "Rescue in Progress": CHART_COLORS.sky,
  Resolved: CHART_COLORS.teal,
  Closed: CHART_COLORS.slate,
  Rejected: CHART_COLORS.red,
  Duplicate: CHART_COLORS.pink,
  Cancelled: CHART_COLORS.red,
};

const PRIORITY_COLORS = {
  high: CHART_COLORS.red,
  medium: CHART_COLORS.amber,
  low: CHART_COLORS.emerald,
};

const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(ts) {
  const d = tsToDate(ts);
  return d ? d.toLocaleString() : "—";
}

function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function toCsv(rows, rescuedByReport = {}) {
  const headers = [
    "id",
    "disasterType",
    "status",
    "priority",
    "peopleAffected",
    "peopleRescued",
    "area",
    "lat",
    "lng",
    "createdAt",
  ];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.id,
        r.disasterType,
        r.status,
        r.priority,
        r.peopleAffected,
        rescuedByReport[r.id] ?? "",
        r._area,
        r.lat,
        r.lng,
        tsToDate(r.createdAt)?.toISOString() ?? "",
      ]
        .map(escape)
        .join(","),
    );
  });
  return lines.join("\n");
}

export default function DmoPage() {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30d");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const unsubR = reportsService.watchReports(
      {},
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    const unsubU = watchAllUsers((rows) => setUsers(rows), () => {});
    const unsubRec = rescueRecordsService.watchRescueRecords(
      {},
      (snap) => setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => {
      unsubR();
      unsubU();
      unsubRec();
    };
  }, []);

  const userById = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  function areaOf(report) {
    const user = userById[report.reporterId];
    const address = user?.profile?.address ?? user?.address ?? null;
    const barangay = address?.barangay?.trim();
    const city = address?.city?.trim();
    if (barangay && city) return `${barangay}, ${city}`;
    if (barangay) return barangay;
    if (city) return city;
    return "Unknown area";
  }

  const rangeStart = useMemo(() => {
    if (range === "all") return null;
    const days = range === "7d" ? 7 : 30;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return start;
  }, [range]);

  const scoped = useMemo(() => {
    return reports
      .map((r) => ({ ...r, _date: tsToDate(r.createdAt), _area: areaOf(r) }))
      .filter((r) => {
        if (typeFilter !== "all" && r.disasterType !== typeFilter) return false;
        if (rangeStart && (!r._date || r._date < rangeStart)) return false;
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, typeFilter, rangeStart, userById]);

  const stats = useMemo(() => {
    const byStatus = {};
    const byPriority = { high: 0, medium: 0, low: 0 };
    const byType = {};
    const byArea = {};
    let people = 0;
    const reporters = new Set();

    const days = range === "all" ? 14 : range === "7d" ? 7 : 30;
    const trendMap = {};
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      trendMap[d.toDateString()] = 0;
    }

    scoped.forEach((r) => {
      byStatus[r.status ?? "Unknown"] = (byStatus[r.status ?? "Unknown"] ?? 0) + 1;
      if (byPriority[r.priority] != null) byPriority[r.priority] += 1;
      byType[r.disasterType ?? "Other"] = (byType[r.disasterType ?? "Other"] ?? 0) + 1;
      if (!byArea[r._area]) byArea[r._area] = { reports: 0, people: 0 };
      byArea[r._area].reports += 1;
      byArea[r._area].people += Number(r.peopleAffected) || 0;
      people += Number(r.peopleAffected) || 0;
      reporters.add(r.reporterId);
      if (r._date) {
        const key = r._date.toDateString();
        if (trendMap[key] != null) trendMap[key] += 1;
      }
    });

    const statusData = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? CHART_COLORS.slate }));

    const priorityData = ["high", "medium", "low"].map((p) => ({
      label: p,
      value: byPriority[p],
      color: PRIORITY_COLORS[p],
    }));

    const typeData = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

    const areaData = Object.entries(byArea)
      .map(([label, v]) => ({ label, value: v.reports, people: v.people }))
      .sort((a, b) => b.value - a.value);

    const trendData = Object.entries(trendMap).map(([key, value]) => ({
      label: formatDay(new Date(key)),
      value,
    }));

    const open = scoped.filter((r) => OPEN_STATUSES.includes(r.status)).length;
    const resolved = byStatus.Resolved ?? 0;

    const verifyDurations = [];
    const resolveDurations = [];
    scoped.forEach((r) => {
      const created = r._date?.getTime();
      if (created == null) return;
      const history = r.history ?? [];
      const verified = history.find((h) => h.status === "Verified")?.at;
      const resolvedAt = history.find((h) => h.status === "Resolved")?.at;
      if (verified) verifyDurations.push(verified - created);
      if (resolvedAt) resolveDurations.push(resolvedAt - created);
    });
    const average = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const scopedRecords = rangeStart
      ? records.filter((rec) => {
          const created = tsToDate(rec.createdAt);
          return created && created >= rangeStart;
        })
      : records;
    const rescuedByReport = {};
    let peopleRescued = 0;
    scopedRecords.forEach((rec) => {
      const rescued = Number(rec.peopleRescued) || 0;
      peopleRescued += rescued;
      if (rec.reportId) {
        rescuedByReport[rec.reportId] = (rescuedByReport[rec.reportId] ?? 0) + rescued;
      }
    });

    return {
      total: scoped.length,
      open,
      resolved,
      people,
      reporters: reporters.size,
      resolveRate: scoped.length ? Math.round((resolved / scoped.length) * 100) : 0,
      avgVerify: average(verifyDurations),
      avgResolve: average(resolveDurations),
      rescueOps: scopedRecords.length,
      peopleRescued,
      rescuedByReport,
      recentRecords: scopedRecords
        .map((rec) => ({ ...rec, _date: tsToDate(rec.createdAt) }))
        .sort((a, b) => (b._date?.getTime() ?? 0) - (a._date?.getTime() ?? 0))
        .slice(0, 10),
      statusData,
      priorityData,
      typeData,
      areaData,
      trendData,
    };
  }, [scoped, range, rangeStart, records]);

  function exportCsv() {
    const blob = new Blob([toCsv(scoped, stats.rescuedByReport)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drrm-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const byStatus = stats.statusData
      .map((s) => `<tr><td>${s.label}</td><td class="num">${s.value}</td></tr>`)
      .join("");
    const byType = stats.typeData
      .map((s) => `<tr><td>${s.label}</td><td class="num">${s.value}</td></tr>`)
      .join("");
    const byArea = stats.areaData
      .slice(0, 12)
      .map(
        (a) =>
          `<tr><td>${a.label}</td><td class="num">${a.value}</td><td class="num">${a.people}</td></tr>`,
      )
      .join("");
    const rescues = stats.recentRecords
      .map(
        (rec) =>
          `<tr><td>${rec._date ? rec._date.toLocaleString() : "—"}</td><td class="num">${
            rec.peopleRescued ?? 0
          }</td><td>${String(rec.notes ?? "").replace(/</g, "&lt;")}</td></tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>DRRM Operational Report</title>
      <style>
        body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:32px;}
        h1{font-size:20px;margin:0 0 4px;}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:24px 0 8px;}
        .muted{color:#64748b;font-size:12px;margin:0 0 16px;}
        table{width:100%;border-collapse:collapse;font-size:13px;}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0;}
        .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
        .grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}
        .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:150px;}
        .kpi .v{font-size:22px;font-weight:700;}
        .kpi .l{font-size:11px;text-transform:uppercase;color:#64748b;}
      </style></head><body>
      <h1>DRRM — Operational Report</h1>
      <p class="muted">Generated ${new Date().toLocaleString()} · Range: ${
        range === "all" ? "All time" : range === "7d" ? "Last 7 days" : "Last 30 days"
      } · Type: ${typeFilter === "all" ? "All" : typeFilter}</p>
      <div class="grid">
        <div class="kpi"><div class="v">${stats.total}</div><div class="l">Reports</div></div>
        <div class="kpi"><div class="v">${stats.reporters}</div><div class="l">Reporters</div></div>
        <div class="kpi"><div class="v">${stats.open}</div><div class="l">Open</div></div>
        <div class="kpi"><div class="v">${stats.resolved}</div><div class="l">Resolved</div></div>
        <div class="kpi"><div class="v">${stats.resolveRate}%</div><div class="l">Resolve rate</div></div>
        <div class="kpi"><div class="v">${stats.people}</div><div class="l">People affected</div></div>
        <div class="kpi"><div class="v">${formatDuration(stats.avgVerify)}</div><div class="l">Avg time to verify</div></div>
        <div class="kpi"><div class="v">${formatDuration(stats.avgResolve)}</div><div class="l">Avg time to resolve</div></div>
      </div>
      <h2>Reports by status</h2><table>${byStatus}</table>
      <h2>Incidents by type</h2><table>${byType}</table>
      <h2>Reports by area</h2>
      <table><tr><td><b>Area</b></td><td class="num"><b>Reports</b></td><td class="num"><b>People</b></td></tr>${byArea}</table>
      <h2>Rescue operations (recent)</h2>
      <table><tr><td><b>When</b></td><td class="num"><b>People rescued</b></td><td><b>Notes</b></td></tr>${rescues}</table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  const actions = (
    <>
      <Button variant="secondary" onClick={exportPdf} disabled={scoped.length === 0}>
        <Icon name="download" className="h-4 w-4" />
        PDF
      </Button>
      <Button variant="secondary" onClick={exportCsv} disabled={scoped.length === 0}>
        <Icon name="download" className="h-4 w-4" />
        CSV
      </Button>
    </>
  );

  return (
    <AppShell
      title="Operations Analytics"
      subtitle="Incident trends, area coverage, and operational reporting."
      actions={actions}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </div>
        <div className="flex rounded-full bg-white p-0.5 ring-1 ring-inset ring-slate-200">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                range === r.id ? "bg-blue-700 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
        >
          <option value="all">All disaster types</option>
          {DISASTER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-500">
          <Spinner /> Loading analytics…
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm text-red-700">
            {error}. Check Firestore rules for the DMO role.
          </p>
        </Card>
      ) : scoped.length === 0 ? (
        <EmptyState
          icon="analytics"
          title="No incident data in this range"
          description="Adjust the filters, or once residents submit reports, trends and area coverage will appear here."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Reports" value={stats.total} tone="text-slate-900" icon="inbox" />
            <Kpi label="Reporters" value={stats.reporters} tone="text-blue-700" icon="staff" />
            <Kpi label="Open" value={stats.open} tone="text-amber-600" icon="clock" />
            <Kpi label="Resolved" value={stats.resolved} tone="text-emerald-600" icon="check" />
            <Kpi
              label="Resolve rate"
              value={stats.resolveRate}
              suffix="%"
              tone="text-teal-600"
              icon="shield"
            />
            <Kpi
              label="People affected"
              value={stats.people}
              tone="text-red-600"
              icon="alert"
            />
            <Kpi
              label="Rescue operations"
              value={stats.rescueOps}
              tone="text-sky-600"
              icon="responder"
            />
            <Kpi
              label="People rescued"
              value={stats.peopleRescued}
              tone="text-emerald-600"
              icon="check"
            />
            <Kpi
              label="Avg time to verify"
              value={formatDuration(stats.avgVerify)}
              tone="text-indigo-600"
              icon="clock"
            />
            <Kpi
              label="Avg time to resolve"
              value={formatDuration(stats.avgResolve)}
              tone="text-violet-600"
              icon="check"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold text-slate-900">Reports by status</h3>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <Donut data={stats.statusData} centerLabel="Total" />
                <div className="w-full flex-1">
                  <DonutLegend data={stats.statusData} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-4 font-semibold text-slate-900">Reports by priority</h3>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <Donut data={stats.priorityData} centerLabel="Total" />
                <div className="w-full flex-1">
                  <DonutLegend data={stats.priorityData} />
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Reports per day</h3>
              <span className="text-xs text-slate-400">
                {range === "all" ? "Last 14 days" : range === "7d" ? "Last 7 days" : "Last 30 days"}
              </span>
            </div>
            <AreaTrend data={stats.trendData} color={CHART_COLORS.blue} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 font-semibold text-slate-900">Incidents by type</h3>
              <Bars data={stats.typeData} color={CHART_COLORS.blue} />
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Reports by area</h3>
                <span className="text-xs text-slate-400">Where residents reported from</span>
              </div>
              {stats.areaData.length === 0 ? (
                <p className="text-sm text-slate-500">No area data available.</p>
              ) : (
                <HBarList
                  data={stats.areaData.slice(0, 7).map((a, i) => ({
                    label: `${a.label} · ${a.people} affected`,
                    value: a.value,
                    color: PALETTE[i % PALETTE.length],
                  }))}
                />
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Recent rescue operations</h3>
              <span className="text-xs text-slate-400">
                {stats.rescueOps} in range · {stats.peopleRescued} rescued
              </span>
            </div>
            {stats.recentRecords.length === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">
                No rescue outcomes recorded in this range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">When</th>
                      <th className="px-6 py-3 font-medium">People rescued</th>
                      <th className="px-6 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentRecords.map((rec) => (
                      <tr key={rec.id}>
                        <td className="whitespace-nowrap px-6 py-3 text-slate-500">
                          {rec._date ? rec._date.toLocaleString() : "—"}
                        </td>
                        <td className="px-6 py-3 font-semibold tabular-nums text-slate-800">
                          {rec.peopleRescued ?? 0}
                        </td>
                        <td className="max-w-md truncate px-6 py-3 text-slate-600">
                          {rec.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Recent reports</h3>
              <span className="text-xs text-slate-400">{scoped.length} in range</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Area</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Priority</th>
                    <th className="px-6 py-3 font-medium">People</th>
                    <th className="px-6 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...scoped]
                    .sort((a, b) => (b._date?.getTime() ?? 0) - (a._date?.getTime() ?? 0))
                    .slice(0, 10)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="px-6 py-3 font-medium text-slate-800">
                          {r.disasterType ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{r._area}</td>
                        <td className="px-6 py-3">
                          <span className={statusChip(r.status)}>{r.status ?? "—"}</span>
                        </td>
                        <td className="px-6 py-3">
                          <Badge
                            className={`capitalize ${
                              r.priority === "high"
                                ? "bg-red-100 text-red-700"
                                : r.priority === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {r.priority ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 tabular-nums text-slate-600">
                          {r.peopleAffected ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{formatDateTime(r.createdAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, suffix = "", tone, icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className={tone}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${tone}`}>
        {value}
        {suffix}
      </p>
    </Card>
  );
}
