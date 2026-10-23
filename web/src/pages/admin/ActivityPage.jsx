import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { watchLogs } from "../../core/services/logsService";
import { watchAllUsers } from "../../core/services/usersService";
import { Button, Card, EmptyState, Icon, Input, Pagination, Spinner } from "../../components/ui";

const PAGE_SIZE = 15;

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
  report_priority: "Report priority changed",
  report_assign: "Team assigned (report)",
  cluster_assign: "Team assigned (cluster)",
  assignment_accept: "Assignment accepted",
  assignment_decline: "Assignment declined",
  assignment_start: "Rescue started",
  assignment_complete: "Rescue completed",
  team_create: "Rescue team created",
};

function formatDate(ts) {
  if (!ts) return "—";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
    lines.push(
      [
        formatDate(row.createdAt),
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
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubLogs = watchLogs(
      {},
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

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [logs]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs
      .filter((l) => {
        if (actionFilter !== "all" && l.action !== actionFilter) return false;
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
  }, [logs, users, search, actionFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drrm-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Activity"
      subtitle="Audit trail of sign-ins, staff changes, and dispatch actions."
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          <Icon name="download" className="h-4 w-4" />
          CSV
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, action, details…"
            className="mt-0"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-600"
        >
          {actions.map((action) => (
            <option key={action} value={action}>
              {action === "all" ? "All actions" : ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>
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
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{row._actor}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {ACTION_LABELS[row.action] ?? row.action ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDetails(row.details) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={rows.length}
            onPageChange={setPage}
          />
        </Card>
      )}
    </AppShell>
  );
}
