import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import * as assignmentsService from "../../core/services/assignmentsService";
import * as reportsService from "../../core/services/reportsService";
import * as rescueRecordsService from "../../core/services/rescueRecordsService";
import * as notificationsService from "../../core/services/notificationsService";
import { updateAssignmentStatus } from "../../core/services/assignmentsService";
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
import { statusChip } from "../dispatch/constants";

const ASSIGNMENT_FLOW = {
  dispatched: { label: "Dispatched", tone: "bg-blue-100 text-blue-800" },
  accepted: { label: "Accepted", tone: "bg-indigo-100 text-indigo-800" },
  in_progress: { label: "En route", tone: "bg-amber-100 text-amber-800" },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Declined", tone: "bg-slate-200 text-slate-600" },
  cancelled: { label: "Cancelled", tone: "bg-slate-200 text-slate-600" },
};

const FILTERS = ["active", "completed", "all"];

function useAssignmentsData() {
  const [assignments, setAssignments] = useState([]);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubA = assignmentsService.watchAssignments(
      {},
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    const unsubR = reportsService.watchReports(
      {},
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setReports(map);
      },
      () => {},
    );
    return () => {
      unsubA();
      unsubR();
    };
  }, []);

  return { assignments, reports, loading, error };
}

export default function ResponderPage() {
  const { user } = useAuth();
  const { assignments, reports, loading, error } = useAssignmentsData();
  const [filter, setFilter] = useState("active");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [completing, setCompleting] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "all") return assignments;
    if (filter === "completed") return assignments.filter((a) => a.status === "completed");
    return assignments.filter(
      (a) => a.status !== "completed" && a.status !== "declined" && a.status !== "cancelled",
    );
  }, [assignments, filter]);

  async function accept(assignment) {
    setBusyId(assignment.id);
    setActionError("");
    try {
      await updateAssignmentStatus(assignment.id, "accepted", user.uid);
      await logAction(user.uid, "assignment_accept", { assignmentId: assignment.id });
    } catch (err) {
      setActionError(err.message ?? "Could not accept the assignment.");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(assignment) {
    setBusyId(assignment.id);
    setActionError("");
    try {
      await updateAssignmentStatus(assignment.id, "declined", user.uid);
      await logAction(user.uid, "assignment_decline", { assignmentId: assignment.id });
    } catch (err) {
      setActionError(err.message ?? "Could not decline the assignment.");
    } finally {
      setBusyId(null);
    }
  }

  async function start(assignment) {
    setBusyId(assignment.id);
    setActionError("");
    try {
      await updateAssignmentStatus(assignment.id, "in_progress", user.uid);
      if (assignment.reportId) {
        await reportsService.updateReportStatus(
          assignment.reportId,
          "Rescue in Progress",
          user.uid,
        );
        const report = reports[assignment.reportId];
        if (report?.reporterId) {
          await notificationsService
            .createNotification({
              userId: report.reporterId,
              title: "Rescue in progress",
              body: `A rescue team is responding to your ${report.disasterType ?? "incident"} report.`,
              reportId: assignment.reportId,
            })
            .catch(() => {});
        }
      }
      await logAction(user.uid, "assignment_start", { assignmentId: assignment.id });
    } catch (err) {
      setActionError(err.message ?? "Could not update the assignment.");
    } finally {
      setBusyId(null);
    }
  }

  async function complete(assignment, outcome) {
    setBusyId(assignment.id);
    setActionError("");
    try {
      await rescueRecordsService.createRescueRecord({
        assignmentId: assignment.id,
        reportId: assignment.reportId ?? null,
        teamId: assignment.teamId ?? null,
        peopleRescued: outcome.peopleRescued,
        notes: outcome.notes,
        recordedBy: user.uid,
      });
      await updateAssignmentStatus(assignment.id, "completed", user.uid);
      if (assignment.reportId) {
        await reportsService.updateReportStatus(assignment.reportId, "Resolved", user.uid);
        const report = reports[assignment.reportId];
        if (report?.reporterId) {
          await notificationsService.createNotification({
            userId: report.reporterId,
            title: "Rescue completed",
            body: `Your ${report.disasterType ?? "incident"} report has been resolved.`,
            reportId: assignment.reportId,
          });
        }
      }
      await logAction(user.uid, "assignment_complete", {
        assignmentId: assignment.id,
        peopleRescued: outcome.peopleRescued,
      });
      setCompleting(null);
    } catch (err) {
      setActionError(err.message ?? "Could not complete the assignment.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(
    () => ({
      active: assignments.filter(
        (a) => a.status !== "completed" && a.status !== "declined" && a.status !== "cancelled",
      ).length,
      completed: assignments.filter((a) => a.status === "completed").length,
      all: assignments.length,
    }),
    [assignments],
  );

  return (
    <AppShell
      title="Responder"
      subtitle="Accept assignments, update status, and record rescue outcomes."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={counts.active} tone="text-amber-600" icon="clock" />
        <StatCard
          label="Completed"
          value={counts.completed}
          tone="text-emerald-600"
          icon="check"
        />
        <StatCard label="Total" value={counts.all} tone="text-blue-700" icon="inbox" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-500">
          <Spinner /> Loading assignments…
        </div>
      ) : error ? (
        <Alert tone="danger">
          {error}. Check Firestore rules for your role.
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="responder"
          title="No assignments here"
          description="Dispatchers create assignments from the Dispatch page. They'll show up here for the rescue team."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((assignment) => {
            const report = reports[assignment.reportId];
            const flow = ASSIGNMENT_FLOW[assignment.status] ?? {
              label: assignment.status,
              tone: "bg-slate-100 text-slate-700",
            };
            const busy = busyId === assignment.id;
            return (
              <Card key={assignment.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {report?.disasterType ?? "Incident"}
                    </h3>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                      <Icon name="location" className="h-3.5 w-3.5" />
                      {report?.lat != null
                        ? `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`
                        : "Location unavailable"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={flow.tone}>{flow.label}</Badge>
                    {report ? <span className={statusChip(report.status)}>{report.status}</span> : null}
                  </div>
                </div>

                {report?.description ? (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{report.description}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {assignment.status === "dispatched" ? (
                    <>
                      <Button size="sm" onClick={() => accept(assignment)} disabled={busy}>
                        {busy ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => decline(assignment)}
                        disabled={busy}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}

                  {assignment.status === "accepted" ? (
                    <Button size="sm" variant="primary" onClick={() => start(assignment)} disabled={busy}>
                      <Icon name="responder" className="h-4 w-4" />
                      Start response
                    </Button>
                  ) : null}

                  {assignment.status === "in_progress" ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setCompleting(assignment)}
                      disabled={busy}
                    >
                      <Icon name="check" className="h-4 w-4" />
                      Complete &amp; record outcome
                    </Button>
                  ) : null}

                  {assignment.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                      <Icon name="check" className="h-4 w-4" /> Resolved
                    </span>
                  ) : null}

                  {assignment.status === "declined" || assignment.status === "cancelled" ? (
                    <span className="text-sm text-slate-400">
                      {ASSIGNMENT_FLOW[assignment.status]?.label ?? assignment.status}
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {completing ? (
        <OutcomeDialog
          assignment={completing}
          report={reports[completing.reportId]}
          busy={busyId === completing.id}
          onClose={() => setCompleting(null)}
          onSubmit={(outcome) => complete(completing, outcome)}
        />
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value, tone, icon }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 ${tone}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      </div>
    </Card>
  );
}

function OutcomeDialog({ assignment, report, busy, onClose, onSubmit }) {
  const [peopleRescued, setPeopleRescued] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Record outcome</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {report?.disasterType ?? "Incident"} · {assignment.teamId ? "Team" : "Unassigned"}
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
            onSubmit({ peopleRescued: Number(peopleRescued) || 0, notes });
          }}
        >
          <Field label="People rescued" hint="Leave 0 if no one was evacuated.">
            <Input
              type="number"
              min="0"
              value={peopleRescued}
              onChange={(e) => setPeopleRescued(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Condition, actions taken, follow-up needed…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
              Mark resolved
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
