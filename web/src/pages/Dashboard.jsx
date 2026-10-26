import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../core/auth/authContext";
import { watchReports } from "../core/services/reportsService";
import { watchTeams } from "../core/services/teamsService";
import { Card, Icon, Spinner, StatusPill } from "../components/ui";
import { LDRRMO_HOTLINE, SAFETY_NOTICE } from "../config/appConfig";
import {
  formatDuration,
  isActiveStatus,
  statusChip,
  tsMillis,
} from "./dispatch/constants";
import ReportMap from "./dispatch/ReportMap";

const TYPE_META = {
  Flood: { icon: "waves", tint: "bg-blue-50 text-blue-600" },
  Fire: { icon: "flame", tint: "bg-rose-50 text-rose-600" },
  Earthquake: { icon: "activity", tint: "bg-amber-50 text-amber-600" },
  Landslide: { icon: "mountain", tint: "bg-orange-50 text-orange-600" },
  Typhoon: { icon: "cyclone", tint: "bg-indigo-50 text-indigo-600" },
  "Storm Surge": { icon: "waves", tint: "bg-cyan-50 text-cyan-600" },
  Other: { icon: "alert", tint: "bg-slate-100 text-slate-500" },
};

function typeMeta(type) {
  return TYPE_META[type] ?? TYPE_META.Other;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function nowMillis() {
  return Date.now();
}

function startOfTodayMillis() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function resolvedAtMillis(report) {
  const history = Array.isArray(report.history) ? report.history : [];
  let last = null;
  history.forEach((entry) => {
    if (entry?.status === "Resolved") {
      const ms = tsMillis(entry.at);
      if (ms != null) last = ms;
    }
  });
  return last;
}

function StatCard({ label, value, caption, icon, tint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-400">{caption}</p>
    </Card>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubReports = watchReports(
      {},
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    const unsubTeams = watchTeams(
      (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => {
      unsubReports();
      unsubTeams();
    };
  }, []);

  const stats = useMemo(() => {
    const now = nowMillis();
    const weekAgo = now - 7 * 24 * 3600000;
    const startOfTodayMs = startOfTodayMillis();

    const active = reports.filter((r) => isActiveStatus(r.status));
    const awaiting = reports.filter(
      (r) => r.status === "Submitted" || r.status === "Under Verification",
    );
    const inProgress = reports.filter((r) => r.status === "Rescue in Progress");

    let newToday = 0;
    active.forEach((r) => {
      const ms = tsMillis(r.createdAt);
      if (ms != null && ms >= startOfTodayMs) newToday += 1;
    });

    let oldestWaiting = 0;
    awaiting.forEach((r) => {
      const ms = tsMillis(r.createdAt);
      if (ms != null) oldestWaiting = Math.max(oldestWaiting, now - ms);
    });

    const resolvedThisWeek = reports.filter((r) => {
      const ms = resolvedAtMillis(r);
      return ms != null && ms >= weekAgo;
    });
    let totalResponse = 0;
    let counted = 0;
    resolvedThisWeek.forEach((r) => {
      const created = tsMillis(r.createdAt);
      const done = resolvedAtMillis(r);
      if (created != null && done != null && done >= created) {
        totalResponse += done - created;
        counted += 1;
      }
    });
    const avgResponse = counted > 0 ? totalResponse / counted : null;

    return {
      activeCount: active.length,
      newToday,
      awaitingCount: awaiting.length,
      oldestWaiting,
      inProgressCount: inProgress.length,
      onMission: teams.filter((t) => t.status === "assigned").length,
      resolvedCount: resolvedThisWeek.length,
      avgResponse,
      active,
    };
  }, [reports, teams]);

  const queue = useMemo(() => {
    const now = nowMillis();
    return stats.active
      .map((r) => {
        const ms = tsMillis(r.createdAt);
        return { ...r, _waiting: ms != null ? Math.max(0, now - ms) : 0 };
      })
      .sort((a, b) => b._waiting - a._waiting)
      .slice(0, 5);
  }, [stats.active]);

  const available = teams.filter((t) => t.status !== "assigned");
  const firstName = (profile?.name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <AppShell
      kicker="Operations"
      title={`${greeting()}, ${firstName}`}
      subtitle="Here's what's happening across your area right now."
      actions={
        <Link
          to="/dispatch"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 transition-colors hover:bg-blue-800"
        >
          <Icon name="dispatch" className="h-4 w-4" />
          Open dispatch
        </Link>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
        <span className="flex items-center gap-2">
          <Icon name="alert" className="h-4 w-4 shrink-0 text-amber-500" />
          {SAFETY_NOTICE}
        </span>
        <a
          href={`tel:${LDRRMO_HOTLINE}`}
          className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-700"
        >
          {LDRRMO_HOTLINE}
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active incidents"
          value={stats.activeCount}
          caption={`${stats.newToday} new since this morning`}
          icon="activity"
          tint="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Awaiting verification"
          value={stats.awaitingCount}
          caption={`Oldest waiting ${formatDuration(stats.oldestWaiting)}`}
          icon="clock"
          tint="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Rescue in progress"
          value={stats.inProgressCount}
          caption={`${stats.onMission} team${stats.onMission === 1 ? "" : "s"} on mission`}
          icon="responder"
          tint="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Resolved this week"
          value={stats.resolvedCount}
          caption={
            stats.avgResponse != null
              ? `Avg. response ${formatDuration(stats.avgResponse)}`
              : "No completed rescues yet"
          }
          icon="check"
          tint="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="font-semibold text-slate-900">Rescue queue</h3>
              <p className="text-xs text-slate-400">Oldest report first.</p>
            </div>
            <Link
              to="/dispatch"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
            >
              View all in Dispatch
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-10 text-slate-500">
              <Spinner /> Loading incidents…
            </div>
          ) : queue.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No active incidents. Nice work.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map((report, index) => {
                const meta = typeMeta(report.disasterType);
                return (
                  <li key={report.id}>
                    <Link
                      to="/dispatch"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}
                      >
                        <Icon name={meta.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          <span className="text-slate-400">#{index + 1}</span>{" "}
                          {report.disasterType}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {report.description || "No description"}
                        </p>
                      </div>
                      <span className="hidden whitespace-nowrap text-sm font-semibold text-red-500 sm:block">
                        {formatDuration(report._waiting)} waiting
                      </span>
                      <span className={`${statusChip(report.status)} whitespace-nowrap`}>
                        {report.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="font-semibold text-slate-900">Live map</h3>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="h-44 w-full">
              <ReportMap reports={stats.active} compact />
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs text-slate-500">
              {[
                { label: "6h+", color: "#EF4444" },
                { label: "3–6h", color: "#F59E0B" },
                { label: "<1h", color: "#3B82F6" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="font-semibold text-slate-900">Rescue teams</h3>
              <span className="text-xs text-slate-400">
                {available.length} of {teams.length} available
              </span>
            </div>
            {teams.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No teams yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {teams.slice(0, 5).map((team) => {
                  const onMission = team.status === "assigned";
                  return (
                    <li key={team.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Icon name="staff" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {team.name}
                      </span>
                      <StatusPill tone={onMission ? "amber" : "green"}>
                        {onMission ? "On mission" : "Available"}
                      </StatusPill>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
