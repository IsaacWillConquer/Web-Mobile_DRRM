import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import * as assignmentsService from "../../core/services/assignmentsService";
import * as reportsService from "../../core/services/reportsService";
import * as rescueRecordsService from "../../core/services/rescueRecordsService";
import * as notificationsService from "../../core/services/notificationsService";
import * as teamsService from "../../core/services/teamsService";
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
import { ROLES } from "../../config/appConfig";
import { statusChip } from "../dispatch/constants";
import ResponderMap from "./ResponderMap";

const ASSIGNMENT_FLOW = {
  dispatched: { label: "Dispatched", tone: "bg-blue-100 text-blue-800" },
  accepted: { label: "Accepted", tone: "bg-indigo-100 text-indigo-800" },
  in_progress: { label: "En route", tone: "bg-amber-100 text-amber-800" },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Declined", tone: "bg-slate-200 text-slate-600" },
  cancelled: { label: "Cancelled", tone: "bg-slate-200 text-slate-600" },
};

function formatTime(ts) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleTimeString() : "just now";
}

const FILTERS = ["active", "completed", "all"];

// Rescue team members only get their own team's assignments (and just the
// reports on those assignments). Dispatchers, admins and DMOs get everything.
function useAssignmentsData({ isTeamMember, teamId }) {
  const [assignments, setAssignments] = useState([]);
  const [reports, setReports] = useState({});
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const noTeam = isTeamMember && !teamId;

  // Assignments
  useEffect(() => {
    if (noTeam) {
      setAssignments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return assignmentsService.watchAssignments(
      isTeamMember ? { teamId } : {},
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [isTeamMember, teamId, noTeam]);

  // Reports: staff list them all, a rescue team loads only the ones on its assignments.
  const reportKey = isTeamMember
    ? [...new Set(assignments.map((a) => a.reportId).filter(Boolean))].sort().join(",")
    : "";

  useEffect(() => {
    if (isTeamMember) {
      const ids = reportKey ? reportKey.split(",") : [];
      const unsubs = ids.map((id) =>
        reportsService.watchReport(
          id,
          (snap) => {
            if (!snap.exists()) return;
            setReports((prev) => ({ ...prev, [id]: { id, ...snap.data() } }));
          },
          () => {},
        ),
      );
      return () => unsubs.forEach((unsub) => unsub());
    }
    return reportsService.watchReports(
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
  }, [isTeamMember, reportKey]);

  // Teams (names + member list)
  useEffect(() => {
    return teamsService.watchTeams(
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setTeams(map);
      },
      () => {},
    );
  }, []);

  return { assignments, reports, teams, loading, error, noTeam };
}

export default function ResponderPage() {
  const { user, profile, role } = useAuth();
  const isTeamMember = role === ROLES.rescueTeam;
  // Dispatchers (and DMOs) can follow a rescue here, but only the assigned
  // rescue team (or an admin) confirms it and updates its progress.
  const canAct = role !== ROLES.dispatcher && role !== ROLES.dmo;
  const { assignments, reports, teams, loading, error, noTeam } = useAssignmentsData({
    isTeamMember,
    teamId: profile?.teamId ?? null,
  });
  const [filter, setFilter] = useState("active");
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [completing, setCompleting] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    if (filter === "all") return assignments;
    if (filter === "completed") return assignments.filter((a) => a.status === "completed");
    return assignments.filter(
      (a) => a.status !== "completed" && a.status !== "declined" && a.status !== "cancelled",
    );
  }, [assignments, filter]);

  // Pings every member of the assigned team so their phone shows the
  // "Rescue assigned" popup with the Start Tracking button.
  async function notifyTeam(assignment) {
    const team = teams[assignment.teamId];
    const members = team?.memberUids ?? [];
    const report = reports[assignment.reportId];
    const where =
      report?.lat != null ? ` at ${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}` : "";
    const results = await Promise.all(
      members.map((uid) =>
        notificationsService
          .createNotification({
            userId: uid,
            type: "rescue_assigned",
            title: "Rescue assigned",
            body: `${report?.disasterType ?? "Incident"} rescue${where}. Tap Start Tracking to head out.`,
            assignmentId: assignment.id,
            reportId: assignment.reportId ?? null,
          })
          .then(() => true)
          .catch(() => false),
      ),
    );
    return { sent: results.filter(Boolean).length, total: members.length };
  }

  async function confirmRescue(assignment) {
    setBusyId(assignment.id);
    setActionError("");
    setNotice("");
    try {
      await updateAssignmentStatus(assignment.id, "accepted", user.uid);
      const { sent, total } = await notifyTeam(assignment);
      await logAction(user.uid, "assignment_accept", { assignmentId: assignment.id });
      setNotice(
        total === 0
          ? "Rescue confirmed, but no members are linked to this team yet. Add members to the team in Dispatch."
          : `Rescue confirmed. ${sent} of ${total} team member(s) notified on mobile.`,
      );
    } catch (err) {
      setActionError(err.message ?? "Could not confirm the rescue.");
    } finally {
      setBusyId(null);
    }
  }

  async function resendNotification(assignment) {
    setBusyId(assignment.id);
    setActionError("");
    setNotice("");
    try {
      const { sent, total } = await notifyTeam(assignment);
      setNotice(`Notification re-sent to ${sent} of ${total} team member(s).`);
    } catch (err) {
      setActionError(err.message ?? "Could not notify the team.");
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

  // Selected card (defaults to the first one in the list)
  const activeAssignment =
    filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;
  const activeId = activeAssignment?.id ?? null;
  const activeReport = activeAssignment ? reports[activeAssignment.reportId] : null;

  return (
    <AppShell
      title="Responder"
      subtitle={
        canAct
          ? "Review the map, confirm the rescue, and follow the team live."
          : "Follow the assigned rescue teams live. View only."
      }
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
      {notice ? <Alert tone="success" className="mb-4">{notice}</Alert> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-500">
          <Spinner /> Loading assignments…
        </div>
      ) : noTeam ? (
        <EmptyState
          icon="responder"
          title="You're not on a rescue team yet"
          description="Ask a dispatcher to add you to a team. Rescues assigned to your team will show up here."
        />
      ) : error ? (
        <Alert tone="danger">
          {error}. Check Firestore rules for your role.
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="responder"
          title="No assignments here"
          description={
            isTeamMember
              ? "Rescues assigned to your team will show up here."
              : "Dispatchers create assignments from the Dispatch page. They'll show up here for the rescue team."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Left: assignment cards (click one to see it on the map) */}
          <div className="space-y-3 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
            {filtered.map((assignment) => {
              const report = reports[assignment.reportId];
              const flow = ASSIGNMENT_FLOW[assignment.status] ?? {
                label: assignment.status,
                tone: "bg-slate-100 text-slate-700",
              };
              const selected = assignment.id === activeId;
              return (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => setSelectedId(assignment.id)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                    selected
                      ? "border-blue-600 ring-2 ring-blue-600/15"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
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
                    <Badge className={flow.tone}>{flow.label}</Badge>
                  </div>
                  {report?.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{report.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-blue-700">View on map &rarr;</p>
                </button>
              );
            })}
          </div>

          {/* Right: map + details + actions for the selected assignment */}
          <Card className="flex flex-col overflow-hidden p-0">
            <div className="h-[380px] w-full p-3 pb-0">
              <ResponderMap
                destination={
                  activeReport?.lat != null
                    ? {
                        lat: activeReport.lat,
                        lng: activeReport.lng,
                        disasterType: activeReport.disasterType,
                        priority: activeReport.priority,
                      }
                    : null
                }
                responderLocation={
                  activeAssignment?.status === "in_progress" ? activeAssignment.responderLocation : null
                }
              />
            </div>

            {activeAssignment ? (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {activeReport?.disasterType ?? "Incident"} rescue
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Team: {teams[activeAssignment.teamId]?.name ?? "Unassigned"}
                      {activeReport ? (
                        <>
                          {" "}
                          · <span className={statusChip(activeReport.status)}>{activeReport.status}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canAct && activeAssignment.status === "dispatched" ? (
                      <>
                        <Button
                          onClick={() => confirmRescue(activeAssignment)}
                          disabled={busyId === activeAssignment.id}
                        >
                          {busyId === activeAssignment.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Icon name="check" className="h-4 w-4" />
                          )}
                          Confirm rescue
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => decline(activeAssignment)}
                          disabled={busyId === activeAssignment.id}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}

                    {canAct && activeAssignment.status === "accepted" ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => resendNotification(activeAssignment)}
                          disabled={busyId === activeAssignment.id}
                        >
                          Notify team again
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => start(activeAssignment)}
                          disabled={busyId === activeAssignment.id}
                        >
                          Start without app
                        </Button>
                      </>
                    ) : null}

                    {canAct && activeAssignment.status === "in_progress" ? (
                      <Button
                        variant="success"
                        onClick={() => setCompleting(activeAssignment)}
                        disabled={busyId === activeAssignment.id}
                      >
                        <Icon name="check" className="h-4 w-4" />
                        Complete &amp; record outcome
                      </Button>
                    ) : null}

                    {activeAssignment.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                        <Icon name="check" className="h-4 w-4" /> Resolved
                      </span>
                    ) : null}
                  </div>
                </div>

                {activeAssignment.status === "accepted" ? (
                  <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-900">
                    Confirmed. Waiting for the team to tap <strong>Start Tracking</strong> on their phone.
                  </p>
                ) : null}

                {activeAssignment.status === "in_progress" ? (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    {activeAssignment.responderLocation
                      ? `Team is en route. Last GPS update: ${formatTime(activeAssignment.responderLocation.updatedAt)}.`
                      : "Team started tracking. Waiting for the first GPS update..."}
                  </p>
                ) : null}

                {activeReport?.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{activeReport.description}</p>
                ) : null}

                {activeAssignment.notes ? (
                  <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                    <span className="font-bold">Dispatcher notes:</span> {activeAssignment.notes}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-400">Click an assignment card to see it on the map.</p>
            )}
          </Card>
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
