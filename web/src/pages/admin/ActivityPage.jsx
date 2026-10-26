import { Fragment, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { watchLogs } from "../../core/services/logsService";
import { watchAllUsers } from "../../core/services/usersService";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FilterChips,
  Icon,
  Pager,
  SearchBar,
  Spinner,
  StatusPill,
} from "../../components/ui";

const PAGE_SIZE = 25;

const ACTION_LABELS = {
  auth_login: "Signed in",
  auth_logout: "Signed out",
  web_login_blocked: "Login blocked",
  staff_created: "Staff account created",
  staff_role_changed: "Staff role changed",
  staff_active_changed: "Staff enabled/disabled",
  staff_deleted: "Staff profile deleted",
  resident_created: "Mobile account created",
  resident_updated: "Mobile account updated",
  resident_active_changed: "Mobile account enabled/disabled",
  resident_deleted: "Mobile account deleted",
  report_verify: "Report verified",
  report_reject: "Report rejected",
  report_assign: "Team assigned",
  report_assign_backup: "Backup team assigned",
  cluster_assign: "Team assigned",
  assignment_accept: "Assignment accepted",
  assignment_decline: "Assignment declined",
  assignment_start: "Rescue started",
  assignment_complete: "Rescue completed",
  team_create: "Rescue team created",
};

const CATEGORY = {
  auth_login: "signin",
  auth_logout: "signin",
  web_login_blocked: "signin",
  report_verify: "dispatch",
  report_reject: "dispatch",
  report_assign: "dispatch",
  report_assign_backup: "dispatch",
  cluster_assign: "dispatch",
  assignment_accept: "dispatch",
  assignment_decline: "dispatch",
  assignment_start: "dispatch",
  assignment_complete: "dispatch",
  team_create: "dispatch",
  staff_created: "staff",
  staff_role_changed: "staff",
  staff_active_changed: "staff",
  staff_deleted: "staff",
  resident_created: "staff",
  resident_updated: "staff",
  resident_active_changed: "staff",
  resident_deleted: "staff",
};

const ACTION_TONES = {
  auth_login: "slate",
  auth_logout: "slate",
  web_login_blocked: "red",
  report_verify: "green",
  report_reject: "red",
  report_assign: "blue",
  report_assign_backup: "blue",
  cluster_assign: "blue",
  assignment_accept: "green",
  assignment_decline: "red",
  assignment_start: "blue",
  assignment_complete: "green",
  team_create: "blue",
  staff_created: "violet",
  staff_role_changed: "violet",
  staff_active_changed: "violet",
  staff_deleted: "red",
  resident_created: "violet",
  resident_updated: "violet",
  resident_active_changed: "violet",
  resident_deleted: "red",
};

const CATEGORY_FILTERS = [
  { key: "all", label: "All actions" },
  { key: "signin", label: "Sign-ins" },
  { key: "dispatch", label: "Dispatch" },
  { key: "staff", label: "Staff changes" },
];

const RANGES = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "all", label: "All time", hours: null },
];

function nowMillis() {
  return Date.now();
}

function toDate(ts) {
  if (!ts) return null;
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeLabel(ts) {
  const date = toDate(ts);
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayKey(ts) {
  const date = toDate(ts);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(ts) {
  const date = toDate(ts);
  if (!date) return "Unknown";
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const formatted = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return isToday ? `Today, ${formatted}` : formatted;
}

function formatDetails(details) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = ["time,actor,uid,action,details"];
  rows.forEach((row) => {
    const date = toDate(row.createdAt);
    lines.push(
      [
        date ? date.toISOString() : "",
        row._actor,
        row.uid,
        row.action,
        formatDetails(row.details),
      ]
        .map(escape)
        .join(","),
    );
  });
  return lines.join("\n");
}

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [range, setRange] = useState("7d");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubLogs = watchLogs(
      { max: 500 },
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    const unsubUsers = watchAllUsers((rows) => {
      const map = {};
      rows.forEach((u) => {
        map[u.uid] = u;
      });
      setUsers(map);
    }, () => {});
    return () => {
      unsubLogs();
      unsubUsers();
    };
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rangeDef = RANGES.find((r) => r.key === range);
    const cutoff =
      rangeDef?.hours != null ? nowMillis() - rangeDef.hours * 3600000 : null;

    return logs
      .filter((l) => {
        if (categoryFilter !== "all" && CATEGORY[l.action] !== categoryFilter) return false;
        if (cutoff != null) {
          const date = toDate(l.createdAt);
          if (!date || date.getTime() < cutoff) return false;
        }
        if (!term) return true;
        const actor = users[l.uid];
        const haystack = [
          l.action,
          ACTION_LABELS[l.action] ?? "",
          actor ? `${actor.name ?? ""} ${actor.email ?? ""}` : "",
          formatDetails(l.details),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .map((l) => ({ ...l, _actor: users[l.uid]?.name ?? users[l.uid]?.email ?? l.uid }));
  }, [logs, users, search, categoryFilter, range]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const groups = useMemo(() => {
    const out = [];
    let current = null;
    pagedRows.forEach((row) => {
      const key = dayKey(row.createdAt);
      if (!current || current.key !== key) {
        current = { key, label: dayLabel(row.createdAt), rows: [] };
        out.push(current);
      }
      current.rows.push(row);
    });
    return out;
  }, [pagedRows]);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kapit-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const start = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, rows.length);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  return (
    <AppShell
      kicker="Administration"
      title="Activity"
      subtitle="Audit trail of sign-ins, staff changes, and dispatch actions."
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          <Icon name="download" className="h-4 w-4" />
          Export CSV
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search actor, action, details…"
          className="w-full sm:w-72"
        />
        <FilterChips
          options={CATEGORY_FILTERS}
          value={categoryFilter}
          onChange={(key) => {
            setCategoryFilter(key);
            setPage(1);
          }}
        />
        <div className="relative ml-auto">
          <select
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-500">
          <Spinner /> Loading activity…
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm text-red-700">{error}. Check Firestore rules for your role.</p>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No activity found"
          description="Audit entries appear as staff sign in and dispatch actions happen."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="bg-slate-50/60">
                      <td
                        colSpan={4}
                        className="px-5 py-2 text-xs font-semibold text-slate-500"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {timeLabel(row.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar seed={row.uid} name={row._actor} className="h-7 w-7 text-[10px]" />
                            <span className="font-medium text-slate-800">{row._actor}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={ACTION_TONES[row.action] ?? "slate"}>
                            {ACTION_LABELS[row.action] ?? row.action ?? "—"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {formatDetails(row.details) || "—"}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={`Showing ${start}–${end} of ${rows.length} entries · ${rangeLabel}`}
          />
        </Card>
      )}
    </AppShell>
  );
}
