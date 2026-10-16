import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import * as reportsService from "../../core/services/reportsService";
import * as teamsService from "../../core/services/teamsService";
import * as assignmentsService from "../../core/services/assignmentsService";
import { getReportContact } from "../../core/services/reportContactsService";
import { PRIORITIES } from "../../config/appConfig";
import ReportMap from "./ReportMap";
import { PRIORITY_COLORS, statusChip } from "./constants";

function formatDate(ts) {
  if (!ts) return "—";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return date.toLocaleString();
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

export default function DispatchPage() {
  const { user } = useAuth();
  const { reports, loading, error } = useReports();
  const { teams } = useTeams();

  const [tab, setTab] = useState("reports");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? reports : reports.filter((r) => r.status === filter)),
    [reports, filter],
  );
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const verify = (report) =>
    run(async () => {
      await logAction(user.uid, "report_verify", { reportId: report.id });
      await reportsService.updateReport(report.id, { verifiedBy: user.uid });
      await reportsService.updateReportStatus(report.id, "Verified", user.uid);
    });

  const reject = (report) =>
    run(() =>
      reportsService.updateReportStatus(report.id, "Rejected", user.uid),
    );

  const setPriority = (report, priority) =>
    run(() => reportsService.updateReport(report.id, { priority }));

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
    });

  return (
    <AppShell
      wide
      title="Dispatch"
      subtitle="Verify, prioritize, and assign rescue teams."
    >
      <div className="flex h-[calc(100vh-190px)] gap-4">
        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ReportMap
            reports={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <aside className="flex w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            {["reports", "teams"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold capitalize ${
                  tab === t
                    ? "border-b-2 border-blue-700 text-blue-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "teams" ? (
            <TeamsPanel teams={teams} uid={user.uid} />
          ) : selected ? (
            <ReportDetail
              report={selected}
              teams={teams}
              busy={busy}
              onBack={() => setSelectedId(null)}
              onVerify={() => verify(selected)}
              onReject={() => reject(selected)}
              onPriority={(p) => setPriority(selected, p)}
              onAssign={(team) => assign(selected, team)}
            />
          ) : (
            <ReportList
              reports={filtered}
              loading={loading}
              error={error}
              filter={filter}
              onFilter={setFilter}
              onSelect={setSelectedId}
            />
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function ReportList({ reports, loading, error, filter, onFilter, onSelect }) {
  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 py-2">
        {["all", "Submitted", "Under Verification", "Verified", "Team Assigned", "Resolved"].map(
          (s) => (
            <button
              key={s}
              onClick={() => onFilter(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                filter === s
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ),
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading reports…</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">
            {error}. Check Firestore rules for the dispatcher role.
          </p>
        ) : reports.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No reports in this filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onSelect(r.id)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {r.disasterType}
                    </span>
                    <span className={statusChip(r.status)}>{r.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {r.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        background: PRIORITY_COLORS[r.priority] ?? "#94A3B8",
                      }}
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
  busy,
  onBack,
  onVerify,
  onReject,
  onPriority,
  onAssign,
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

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <button
        onClick={onBack}
        className="mb-3 text-sm font-medium text-blue-700 hover:underline"
      >
        ← All reports
      </button>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{report.disasterType}</h3>
        <span className={statusChip(report.status)}>{report.status}</span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Reporter" value={report.reporterId} />
        <Row label="For" value={report.onBehalfOf === "other" ? "Someone else" : "Myself"} />
        <Row label="People affected" value={report.peopleAffected ?? "—"} />
        <Row
          label="Location"
          value={
            report.lat != null ? `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}` : "—"
          }
        />
        <Row label="Submitted" value={formatDate(report.createdAt)} />
      </dl>

      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
        {report.description}
      </p>

      {report.imageUrls?.length ? (
        <div className="mt-3 flex gap-2">
          {report.imageUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt="report"
              className="h-20 w-20 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}

      {contact ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-slate-700">Victim / contact</p>
          <p className="text-slate-600">
            {contact.victimName || "—"} · {contact.victimContact || "—"}
            {contact.relationship ? ` · ${contact.relationship}` : ""}
          </p>
          {contact.specialNeeds?.length ? (
            <p className="text-slate-500">
              Special needs: {contact.specialNeeds.join(", ")}
            </p>
          ) : null}
          {contact.notes ? (
            <p className="text-slate-500">{contact.notes}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          Priority
        </p>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              disabled={busy}
              onClick={() => onPriority(p)}
              className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
                report.priority === p
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={report.priority === p ? { background: PRIORITY_COLORS[p] } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={onVerify}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Verify
        </button>
        <button
          disabled={busy}
          onClick={onReject}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Reject
        </button>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          Assign rescue team
        </p>
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">
            No teams yet — create one in the Teams tab.
          </p>
        ) : (
          <div className="flex gap-2">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status ?? "available"})
                </option>
              ))}
            </select>
            <button
              disabled={busy || !assignable}
              onClick={() => {
                const team = teams.find((t) => t.id === teamId);
                if (team) onAssign(team);
              }}
              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              Assign
            </button>
          </div>
        )}
        {!assignable ? (
          <p className="mt-2 text-xs text-slate-400">
            Verify the report before assigning.
          </p>
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

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await logAction(uid, "team_create", { name });
      await teamsService.createTeam({ name: name.trim(), contact: contact.trim() });
      setName("");
      setContact("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
        New team
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Contact number"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        onClick={create}
        disabled={busy}
        className="mb-4 w-full rounded-lg bg-blue-700 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        Create team
      </button>

      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
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
