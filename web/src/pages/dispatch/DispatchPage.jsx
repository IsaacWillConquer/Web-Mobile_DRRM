import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import * as reportsService from "../../core/services/reportsService";
import * as teamsService from "../../core/services/teamsService";
import * as assignmentsService from "../../core/services/assignmentsService";
import * as clustersService from "../../core/services/clustersService";
import { createNotification } from "../../core/services/notificationsService";
import { getReportContact } from "../../core/services/reportContactsService";
import { displayName, watchAllUsers } from "../../core/services/usersService";
import { DISASTER_TYPES, PRIORITIES } from "../../config/appConfig";
import ReportMap from "./ReportMap";
import { findDuplicates } from "./duplicates";
import { PRIORITY_COLORS, statusChip } from "./constants";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  Spinner,
} from "../../components/ui";

function formatDate(ts) {
  if (!ts) return "—";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return date.toLocaleString();
}

const ACTIVE_STATUSES = [
  "Submitted",
  "Under Verification",
  "Verified",
  "Awaiting Assignment",
  "Team Assigned",
  "Rescue in Progress",
];

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

function cellKey(report) {
  return `${report.lat.toFixed(2)},${report.lng.toFixed(2)}`;
}

function buildClusters(reports) {
  const cells = {};
  reports.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    if (r.clusterId) return;
    const key = cellKey(r);
    if (!cells[key]) {
      cells[key] = { key, lat: 0, lng: 0, reports: [], priority: "low" };
    }
    const cell = cells[key];
    cell.lat += r.lat;
    cell.lng += r.lng;
    cell.reports.push(r);
    if (PRIORITY_RANK[r.priority] > PRIORITY_RANK[cell.priority]) cell.priority = r.priority;
  });
  return Object.values(cells)
    .map((c) => ({
      ...c,
      lat: c.lat / c.reports.length,
      lng: c.lng / c.reports.length,
      count: c.reports.length,
      people: c.reports.reduce((sum, r) => sum + (Number(r.peopleAffected) || 0), 0),
    }))
    .sort((a, b) => b.count - a.count);
}

function useReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const unsub = reportsService.watchReports(
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
    return unsub;
  }, []);
  return { reports, loading, error };
}

function useTeams() {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    const unsub = teamsService.watchTeams(
      (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return unsub;
  }, []);
  return { teams };
}

function useClusters() {
  const [clusters, setClusters] = useState([]);
  useEffect(() => {
    const unsub = clustersService.watchClusters(
      (snap) => setClusters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return unsub;
  }, []);
  return { clusters };
}

function useUsers() {
  const [users, setUsers] = useState({});
  useEffect(() => {
    const unsub = watchAllUsers(
      (rows) => {
        const map = {};
        rows.forEach((u) => {
          map[u.uid] = u;
        });
        setUsers(map);
      },
      () => {},
    );
    return unsub;
  }, []);
  return users;
}

export default function DispatchPage() {
  const { user } = useAuth();
  const { reports, loading, error } = useReports();
  const { teams } = useTeams();
  const { clusters } = useClusters();
  const users = useUsers();

  const [tab, setTab] = useState("reports");
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [mapMode, setMapMode] = useState("pins");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejecting, setRejecting] = useState(null);

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (filter !== "all" && r.status !== filter) return false;
        if (typeFilter !== "all" && r.disasterType !== typeFilter) return false;
        return true;
      }),
    [reports, filter, typeFilter],
  );
  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const reportById = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [reports]);
  const suggested = useMemo(
    () => buildClusters(reports.filter((r) => ACTIVE_STATUSES.includes(r.status))).filter((c) => c.count >= 2),
    [reports],
  );
  const duplicates = useMemo(() => findDuplicates(reports), [reports]);

  const markDuplicate = (report) =>
    run(async () => {
      await reportsService.updateReportStatus(report.id, "Duplicate", user.uid);
      await logAction(user.uid, "report_duplicate", {
        reportId: report.id,
        duplicateOf: duplicates.get(report.id)?.of ?? null,
      });
      setNotice("Report marked as duplicate.");
    });

  async function run(fn) {
    setBusy(true);
    setNotice("");
    setActionError("");
    try {
      await fn();
    } catch (err) {
      setActionError(err.message ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function notifyReporter(report, title, body) {
    if (!report?.reporterId) return Promise.resolve();
    return createNotification({
      userId: report.reporterId,
      title,
      body,
      reportId: report.id,
    }).catch(() => {});
  }

  const verify = (report) =>
    run(async () => {
      await reportsService.updateReport(report.id, { verifiedBy: user.uid });
      await reportsService.updateReportStatus(report.id, "Verified", user.uid);
      await notifyReporter(report, "Report verified", `Your ${report.disasterType} report is verified.`);
      await logAction(user.uid, "report_verify", { reportId: report.id });
      setNotice("Report verified.");
    });

  const reject = (report, reason) =>
    run(async () => {
      await reportsService.updateReport(report.id, { rejectionReason: reason });
      await reportsService.updateReportStatus(report.id, "Rejected", user.uid);
      await notifyReporter(
        report,
        "Report rejected",
        `Your ${report.disasterType} report was rejected. Reason: ${reason}`,
      );
      await logAction(user.uid, "report_reject", { reportId: report.id, reason });
      setNotice("Report rejected.");
      setRejecting(null);
    });

  const close = (report) =>
    run(async () => {
      await reportsService.updateReportStatus(report.id, "Closed", user.uid);
      await notifyReporter(
        report,
        "Report closed",
        `Your ${report.disasterType} report has been closed. Thank you.`,
      );
      await logAction(user.uid, "report_close", { reportId: report.id });
      setNotice("Report closed.");
    });

  const setPriority = (report, priority) =>
    run(async () => {
      await reportsService.updateReport(report.id, { priority });
      await logAction(user.uid, "report_priority", {
        reportId: report.id,
        from: report.priority,
        to: priority,
      });
      await notifyReporter(
        report,
        "Priority updated",
        `Your ${report.disasterType} report priority is now ${priority}.`,
      );
      setNotice(`Priority set to ${priority}.`);
    });

  const assign = (report, team) =>
    run(async () => {
      await assignmentsService.createAssignment({
        reportId: report.id,
        teamId: team.id,
        status: "dispatched",
        dispatchedBy: user.uid,
      });
      await reportsService.updateReport(report.id, { teamId: team.id });
      await reportsService.updateReportStatus(report.id, "Team Assigned", user.uid);
      await teamsService.updateTeam(team.id, { status: "assigned" });
      await notifyReporter(report, "Rescue team assigned", `${team.name} is responding to your report.`);
      await logAction(user.uid, "report_assign", { reportId: report.id, teamId: team.id });
      setNotice(`${team.name} assigned.`);
    });

  const assignCluster = (cluster, team) =>
    run(async () => {
      const created = await clustersService.createCluster({
        center: { lat: cluster.lat, lng: cluster.lng },
        cell: cluster.key,
        reportIds: cluster.reports.map((r) => r.id),
        reportCount: cluster.count,
        peopleAffected: cluster.people,
        priority: cluster.priority,
        status: "open",
      });
      await assignmentsService.createAssignment({
        clusterId: created.id,
        teamId: team.id,
        status: "dispatched",
        dispatchedBy: user.uid,
      });
      await Promise.all(
        cluster.reports.map(async (r) => {
          await reportsService.updateReport(r.id, { clusterId: created.id, teamId: team.id });
          await reportsService.updateReportStatus(r.id, "Team Assigned", user.uid);
          await notifyReporter(r, "Rescue team assigned", `${team.name} is responding to your area.`);
        }),
      );
      await teamsService.updateTeam(team.id, { status: "assigned" });
      await logAction(user.uid, "cluster_assign", { clusterId: created.id, teamId: team.id });
      setNotice(`Cluster of ${cluster.count} assigned to ${team.name}.`);
    });

  return (
    <AppShell
      wide
      title="Dispatch"
      subtitle="Verify, prioritize, and assign rescue teams to incidents."
      actions={
        <>
          <div className="flex rounded-full bg-white p-0.5 ring-1 ring-inset ring-slate-200">
            {[
              { id: "pins", label: "Pins" },
              { id: "density", label: "Density" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMapMode(m.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  mapMode === m.id ? "bg-blue-700 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      <div className="flex h-[calc(100vh-16rem)] min-h-[520px] gap-4">
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ReportMap
            reports={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mode={mapMode}
          />
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
            <p className="mb-1 font-semibold text-slate-700">Priority</p>
            <div className="flex items-center gap-3">
              {PRIORITIES.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 capitalize text-slate-500">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: PRIORITY_COLORS[p] }}
                  />
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            {[
              { id: "reports", label: "Reports" },
              { id: "clusters", label: `Clusters${suggested.length ? ` (${suggested.length})` : ""}` },
              { id: "teams", label: "Teams" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "border-b-2 border-blue-700 text-blue-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "teams" ? (
            <TeamsPanel teams={teams} uid={user.uid} />
          ) : tab === "clusters" ? (
            <ClustersPanel
              suggested={suggested}
              clusters={clusters}
              reportById={reportById}
              teams={teams}
              busy={busy}
              onAssign={assignCluster}
            />
          ) : selected ? (
            <ReportDetail
              report={selected}
              teams={teams}
              userById={users}
              duplicateOf={duplicates.get(selected.id) ?? null}
              busy={busy}
              onBack={() => setSelectedId(null)}
              onVerify={() => verify(selected)}
              onReject={() => setRejecting(selected)}
              onClose={() => close(selected)}
              onPriority={(p) => setPriority(selected, p)}
              onAssign={(team) => assign(selected, team)}
              onMarkDuplicate={() => markDuplicate(selected)}
              onOpenReport={setSelectedId}
            />
          ) : (
            <ReportList
              reports={filtered}
              loading={loading}
              error={error}
              filter={filter}
              typeFilter={typeFilter}
              duplicates={duplicates}
              onFilter={setFilter}
              onTypeFilter={setTypeFilter}
              onSelect={setSelectedId}
            />
          )}
        </aside>
      </div>

      {rejecting ? (
        <ReasonDialog
          report={rejecting}
          busy={busy}
          onClose={() => setRejecting(null)}
          onSubmit={(reason) => reject(rejecting, reason)}
        />
      ) : null}
    </AppShell>
  );
}

function ReportList({
  reports,
  loading,
  error,
  filter,
  typeFilter,
  duplicates,
  onFilter,
  onTypeFilter,
  onSelect,
}) {
  const statuses = ["all", "Submitted", "Verified", "Team Assigned", "Rescue in Progress", "Resolved"];
  return (
    <>
      <div className="space-y-2 border-b border-slate-200 px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => onFilter(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-600"
        >
          <option value="all">All disaster types</option>
          {DISASTER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Spinner className="h-4 w-4" /> Loading reports…
          </div>
        ) : error ? (
          <Alert tone="danger">
            {error}. Check Firestore rules for the dispatcher role.
          </Alert>
        ) : reports.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No reports here"
            description="Try another status or disaster type filter."
          />
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onSelect(r.id)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{r.disasterType}</span>
                    <div className="flex items-center gap-1">
                      {duplicates?.has(r.id) ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Possible duplicate
                        </span>
                      ) : null}
                      <span className={statusChip(r.status)}>{r.status}</span>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: PRIORITY_COLORS[r.priority] ?? "#94A3B8" }}
                    />
                    {r.priority ?? "—"} · {formatDate(r.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ReportDetail({
  report,
  teams,
  userById,
  duplicateOf,
  busy,
  onBack,
  onVerify,
  onReject,
  onClose,
  onPriority,
  onAssign,
  onMarkDuplicate,
  onOpenReport,
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [contact, setContact] = useState(null);

  useEffect(() => {
    let active = true;
    getReportContact(report.id)
      .then((c) => active && setContact(c))
      .catch(() => active && setContact(null));
    return () => {
      active = false;
    };
  }, [report.id]);

  const assignable = report.status === "Verified" || report.status === "Awaiting Assignment";
  const reporter = userById?.[report.reporterId];

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
      >
        ← All reports
      </button>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{report.disasterType}</h3>
        <span className={statusChip(report.status)}>{report.status}</span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Reporter" value={reporter ? displayName(reporter) : report.reporterId} />
        <Row label="For" value={report.onBehalfOf === "other" ? "Someone else" : "Myself"} />
        <Row label="People affected" value={report.peopleAffected ?? "—"} />
        <Row
          label="Location"
          value={report.lat != null ? `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}` : "—"}
        />
        <Row label="Submitted" value={formatDate(report.createdAt)} />
      </dl>

      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>

      {report.imageUrls?.length ? (
        <div className="mt-3 flex gap-2">
          {report.imageUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt="report"
              className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-900/5"
            />
          ))}
        </div>
      ) : null}

      {duplicateOf ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-inset ring-amber-600/15">
          <p className="text-amber-900">
            <span className="font-semibold">Possible duplicate</span> of a nearby{" "}
            {duplicateOf.type ?? "report"} submitted within 24h.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onOpenReport(duplicateOf.of)}>
              View original
            </Button>
            <Button size="sm" variant="secondary" onClick={onMarkDuplicate} disabled={busy}>
              Mark as duplicate
            </Button>
          </div>
        </div>
      ) : null}

      {report.rejectionReason ? (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm ring-1 ring-inset ring-red-600/15">
          <p className="font-semibold text-red-700">Rejection reason</p>
          <p className="mt-0.5 text-red-600">{report.rejectionReason}</p>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Status timeline
        </p>
        <HistoryTimeline history={report.history} userById={userById} />
      </div>

      {contact ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-900/5">
          <p className="mb-1 font-semibold text-slate-700">Victim / contact</p>
          <p className="text-slate-600">
            {contact.victimName || "—"} · {contact.victimContact || "—"}
            {contact.relationship ? ` · ${contact.relationship}` : ""}
          </p>
          {contact.specialNeeds?.length ? (
            <p className="text-slate-500">Special needs: {contact.specialNeeds.join(", ")}</p>
          ) : null}
          {contact.notes ? <p className="text-slate-500">{contact.notes}</p> : null}
        </div>
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</p>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              disabled={busy}
              onClick={() => onPriority(p)}
              className={`rounded-full px-3 py-1 text-sm font-semibold capitalize disabled:opacity-60 ${
                report.priority === p ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={report.priority === p ? { background: PRIORITY_COLORS[p] } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="success" onClick={onVerify} disabled={busy}>
          <Icon name="check" className="h-4 w-4" />
          Verify
        </Button>
        <Button
          variant="secondary"
          onClick={onReject}
          disabled={busy}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          Reject
        </Button>
        {report.status === "Resolved" ? (
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            <Icon name="check" className="h-4 w-4" />
            Close incident
          </Button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Assign rescue team
        </p>
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams yet — create one in the Teams tab.</p>
        ) : (
          <div className="flex gap-2">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status ?? "available"})
                </option>
              ))}
            </select>
            <Button
              disabled={busy || !assignable}
              onClick={() => {
                const team = teams.find((t) => t.id === teamId);
                if (team) onAssign(team);
              }}
            >
              Assign
            </Button>
          </div>
        )}
        {!assignable ? (
          <p className="mt-2 text-xs text-slate-400">Verify the report before assigning.</p>
        ) : null}
        {report.teamId ? (
          <p className="mt-2 text-xs text-slate-500">
            Assigned team: {teams.find((t) => t.id === report.teamId)?.name ?? report.teamId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ClustersPanel({ suggested, clusters, reportById, teams, busy, onAssign }) {
  const [teamId, setTeamId] = useState("");
  const activeTeamId = teamId || teams[0]?.id || "";

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Suggested clusters
      </p>
      {suggested.length === 0 ? (
        <p className="mb-6 text-sm text-slate-500">
          No nearby groups of active reports right now.
        </p>
      ) : (
        <ul className="mb-6 space-y-3">
          {suggested.map((cluster) => (
            <li key={cluster.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  {cluster.count} reports nearby
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize text-white"
                  style={{ background: PRIORITY_COLORS[cluster.priority] }}
                >
                  {cluster.priority}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                ~{cluster.people} people affected · {cluster.lat.toFixed(3)}, {cluster.lng.toFixed(3)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {cluster.reports.slice(0, 4).map((r) => (
                  <span key={r.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {r.disasterType}
                  </span>
                ))}
                {cluster.reports.length > 4 ? (
                  <span className="px-1.5 py-0.5 text-[11px] text-slate-400">
                    +{cluster.reports.length - 4}
                  </span>
                ) : null}
              </div>
              {teams.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Create a team first.</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <select
                    value={activeTeamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-600"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const team = teams.find((t) => t.id === activeTeamId);
                      if (team) onAssign(cluster, team);
                    }}
                  >
                    Assign
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Active clusters
      </p>
      {clusters.length === 0 ? (
        <p className="text-sm text-slate-500">No clusters assigned yet.</p>
      ) : (
        <ul className="space-y-3">
          {clusters.map((cluster) => {
            const reportIds = cluster.reportIds ?? [];
            const resolved = reportIds.filter((id) => reportById[id]?.status === "Resolved").length;
            const pct = reportIds.length ? Math.round((resolved / reportIds.length) * 100) : 0;
            return (
              <li key={cluster.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Cluster · {cluster.reportCount ?? reportIds.length} reports
                  </span>
                  <Badge className="bg-blue-100 text-blue-800">{cluster.status ?? "open"}</Badge>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {resolved}/{reportIds.length} resolved · {cluster.peopleAffected ?? 0} people affected
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// `history[].at` is an epoch-ms number (web) or an ISO string (mobile).
function parseHistoryDate(at) {
  if (at == null) return null;
  if (typeof at?.toDate === "function") return at.toDate();
  if (typeof at === "number") {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof at === "string" && at.trim() !== "") {
    const numeric = Number(at);
    const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(at);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function HistoryTimeline({ history, userById }) {
  const entries = useMemo(
    () =>
      (history ?? [])
        .map((entry) => ({ ...entry, _date: parseHistoryDate(entry.at) }))
        .sort(
          (a, b) =>
            (a._date?.getTime() ?? Number.POSITIVE_INFINITY) -
            (b._date?.getTime() ?? Number.POSITIVE_INFINITY),
        ),
    [history],
  );

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No status history recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {entries.map((entry, index) => {
        const actor = userById?.[entry.by];
        const isLatest = index === entries.length - 1;
        return (
          <li key={`${entry.status}-${index}`} className="relative">
            <span
              className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                isLatest ? "bg-blue-600" : "bg-slate-300"
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className={statusChip(entry.status)}>{entry.status}</span>
              {isLatest ? <Badge className="bg-blue-50 text-blue-700">Current</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {entry._date ? entry._date.toLocaleString() : "—"}
              {actor
                ? ` · by ${displayName(actor)}`
                : entry.by
                  ? ` · ${String(entry.by).slice(0, 8)}…`
                  : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function ReasonDialog({ report, busy, onClose, onSubmit }) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Reject report</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {report.disasterType} · reason is shared with the reporter.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(reason.trim());
          }}
        >
          <Field label="Reason" hint="Shown to the reporter in their notifications.">
            <textarea
              required
              minLength={3}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate of an existing verified report."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon name="x" className="h-4 w-4" />}
              Reject report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function TeamsPanel({ teams, uid }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await logAction(uid, "team_create", { name });
      await teamsService.createTeam({ name: name.trim(), contact: contact.trim() });
      setName("");
      setContact("");
    } catch (err) {
      setError(err.message ?? "Could not create team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">New team</p>
      <div className="space-y-2">
        <Field label="Team name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alpha Rescue" />
        </Field>
        <Field label="Contact number">
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="e.g. +63 900 000 0000"
          />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button onClick={create} disabled={busy} className="w-full">
          {busy ? <Spinner className="h-4 w-4" /> : <Icon name="plus" className="h-4 w-4" />}
          Create team
        </Button>
      </div>

      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Teams ({teams.length})
      </p>
      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">No teams yet.</p>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
            >
              <span className="font-medium text-slate-800">{t.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {t.status ?? "available"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
