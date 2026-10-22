import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import {
  createStaff,
  deleteStaff,
  displayName,
  setStaffActive,
  syncDispatcherConfig,
  updateStaff,
  watchStaff,
} from "../../core/services/usersService";
import { ROLE_LABELS, ROLES, STAFF_ROLES } from "../../config/appConfig";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Input,
  Pagination,
  Select,
  Spinner,
} from "../../components/ui";

const EMPTY_FORM = { name: "", email: "", password: "", role: "dispatcher" };
const PAGE_SIZE = 10;

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubscribe = watchStaff(
      (rows) => {
        setStaff(rows);
        setLoading(false);
      },
      (err) => {
        setError(err?.message ?? "Unable to load staff.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  // Keep config/dispatch (the new-report ping targets) in sync with staff roles.
  useEffect(() => {
    if (!user) return;
    const uids = staff
      .filter((m) => m.role === ROLES.dispatcher || m.role === ROLES.admin)
      .map((m) => m.uid);
    syncDispatcherConfig(uids).catch(() => {});
  }, [staff, user]);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const pageCount = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedStaff = staff.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreating(true);
    try {
      const created = await createStaff(form);
      await logAction(user?.uid, "staff_created", {
        targetUid: created.uid,
        email: created.email,
        role: created.role,
      });
      setNotice(`Created ${created.email} (${ROLE_LABELS[created.role] ?? created.role}).`);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err?.message ?? "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(member, role) {
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await updateStaff(member.uid, { role });
      await logAction(user?.uid, "staff_role_changed", {
        targetUid: member.uid,
        from: member.role,
        to: role,
      });
    } catch (err) {
      setError(err?.message ?? "Could not update role.");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleToggleActive(member) {
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await setStaffActive(member.uid, !member.active);
      await logAction(user?.uid, "staff_active_changed", {
        targetUid: member.uid,
        active: !member.active,
      });
    } catch (err) {
      setError(err?.message ?? "Could not update status.");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Remove the profile for ${member.email}?`)) return;
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await deleteStaff(member.uid);
      await logAction(user?.uid, "staff_deleted", {
        targetUid: member.uid,
        email: member.email,
      });
    } catch (err) {
      setError(err?.message ?? "Could not delete staff.");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <AppShell
      title="Staff Management"
      subtitle="Create accounts and manage roles and access. Administrators only."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon name="plus" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">Add staff account</h3>
              <p className="text-xs text-slate-500">Creates the login and profile.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <Field label="Full name">
              <Input
                required
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => updateForm("role", e.target.value)}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] ?? role}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Temporary password"
              hint="Share it with the staff member; they can change it later."
            >
              <Input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Spinner className="h-4 w-4" /> : null}
              {creating ? "Creating…" : "Create account"}
            </Button>
          </form>
        </Card>

        <section>
          {notice ? (
            <Alert tone="success" className="mb-4">
              {notice}
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          ) : null}

          <Card className="overflow-hidden">
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-slate-500">
                <Spinner /> Loading staff…
              </div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No staff accounts yet.
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedStaff.map((member) => {
                      const isSelf = member.uid === user?.uid;
                      const isBusy = busyUid === member.uid;
                      return (
                        <tr key={member.uid} className={isSelf ? "bg-slate-50/60" : undefined}>
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {displayName(member)}
                            {isSelf ? (
                              <Badge className="ml-2 bg-slate-200 text-slate-600">You</Badge>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{member.email}</td>
                          <td className="px-5 py-3">
                            <Select
                              value={member.role}
                              disabled={isSelf || isBusy}
                              onChange={(e) => handleRoleChange(member, e.target.value)}
                              className="mt-0 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {STAFF_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role] ?? role}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              className={
                                member.active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-200 text-slate-600"
                              }
                            >
                              {member.active ? "Active" : "Disabled"}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleToggleActive(member)}
                                disabled={isSelf || isBusy}
                              >
                                {member.active ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleDelete(member)}
                                disabled={isSelf || isBusy}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                total={staff.length}
                onPageChange={setPage}
              />
              </>
            )}
          </Card>

          <p className="mt-4 text-xs text-slate-400">
            Deleting removes the profile only; the Firebase Auth account can be removed from
            the console or with <code>scripts/create_staff.js</code>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
