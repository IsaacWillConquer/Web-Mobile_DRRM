import { useEffect, useMemo, useState } from "react";
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
import { ROLES, STAFF_ROLES } from "../../config/appConfig";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  FilterChips,
  Icon,
  Input,
  Pager,
  SearchBar,
  Select,
  SlideOver,
  Spinner,
  StatusPill,
} from "../../components/ui";

const EMPTY_FORM = { name: "", email: "", password: "", role: "dispatcher" };
const PAGE_SIZE = 10;

const ROLE_META = {
  dispatcher: { label: "Dispatcher", tone: "violet" },
  rescueTeam: { label: "Rescue Team", tone: "blue" },
  dmo: { label: "Disaster Manager", tone: "amber" },
  admin: { label: "Administrator", tone: "emerald" },
};

const ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "dispatcher", label: "Dispatchers" },
  { key: "rescueTeam", label: "Rescue teams" },
  { key: "dmo", label: "Disaster managers" },
  { key: "admin", label: "Admins" },
];

function roleLabel(role) {
  return ROLE_META[role]?.label ?? role;
}
function roleTone(role) {
  return ROLE_META[role]?.tone ?? "slate";
}

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
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

  function openCreate() {
    setDrawerError("");
    setCreateOpen(true);
  }
  function closeCreate() {
    setDrawerError("");
    setCreateOpen(false);
  }
  function openEdit(member) {
    setDrawerError("");
    setEditing(member);
  }
  function closeEdit() {
    setDrawerError("");
    setEditing(null);
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const counts = useMemo(() => {
    const base = { all: staff.length };
    STAFF_ROLES.forEach((role) => {
      base[role] = staff.filter((m) => m.role === role).length;
    });
    return base;
  }, [staff]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!term) return true;
      return `${displayName(m)} ${m.email ?? ""} ${roleLabel(m.role)}`
        .toLowerCase()
        .includes(term);
    });
  }, [staff, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedStaff = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const chipOptions = ROLE_FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }));

  async function handleCreate(event) {
    event.preventDefault();
    setDrawerError("");
    setNotice("");
    setCreating(true);
    try {
      const created = await createStaff(form);
      await logAction(user?.uid, "staff_created", {
        targetUid: created.uid,
        email: created.email,
        role: created.role,
      });
      setNotice(`Created ${created.email} (${roleLabel(created.role)}).`);
      setForm(EMPTY_FORM);
      closeCreate();
    } catch (err) {
      setDrawerError(err?.message ?? "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(member, data) {
    setBusyUid(member.uid);
    setDrawerError("");
    setNotice("");
    try {
      await updateStaff(member.uid, data);
      await logAction(user?.uid, "staff_role_changed", {
        targetUid: member.uid,
        from: member.role,
        to: data.role,
      });
      setNotice(`Updated ${displayName(member)}.`);
      closeEdit();
    } catch (err) {
      setDrawerError(err?.message ?? "Could not update the account.");
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
      kicker="Administration"
      title="Staff"
      subtitle="Accounts and access for dispatchers, rescue teams, and disaster officers."
      actions={
        <Button onClick={openCreate}>
          <Icon name="plus" className="h-4 w-4" />
          Add staff account
        </Button>
      }
    >
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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <SearchBar
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or email…"
            className="w-full sm:w-72"
          />
          <FilterChips
            options={chipOptions}
            value={roleFilter}
            onChange={(key) => {
              setRoleFilter(key);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-slate-500">
            <Spinner /> Loading staff…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {staff.length === 0 ? "No staff accounts yet." : "No accounts match your filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff</th>
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
                      <tr key={member.uid}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              seed={member.uid}
                              name={displayName(member)}
                              email={member.email}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {displayName(member)}
                                {isSelf ? (
                                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                                    You
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {member.email ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={roleTone(member.role)}>
                            {roleLabel(member.role)}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={member.active ? "green" : "slate"}>
                            {member.active ? "Active" : "Disabled"}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              disabled={isBusy}
                              title="Edit"
                              aria-label={`Edit ${displayName(member)}`}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                            >
                              <Icon name="pencil" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(member)}
                              disabled={isSelf || isBusy}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                            >
                              {member.active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(member)}
                              disabled={isSelf || isBusy}
                              title="Delete"
                              aria-label={`Delete ${displayName(member)}`}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`Page ${currentPage} of ${pageCount} · ${filtered.length} staff`}
            />
          </>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Deleting removes the profile only; the Firebase Auth account can be removed from the
        console or with <code>scripts/create_staff.js</code>.
      </p>

      {createOpen ? (
        <SlideOver
          onClose={closeCreate}
          title="Add staff account"
          subtitle="Creates the login and the profile."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" form="create-staff" disabled={creating}>
                {creating ? <Spinner className="h-4 w-4" /> : null}
                {creating ? "Creating…" : "Create account"}
              </Button>
            </div>
          }
        >
          {drawerError ? (
            <Alert tone="danger" className="mb-4">
              {drawerError}
            </Alert>
          ) : null}
          <form id="create-staff" className="space-y-4" onSubmit={handleCreate}>
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
              <Select value={form.role} onChange={(e) => updateForm("role", e.target.value)}>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
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
          </form>
        </SlideOver>
      ) : null}

      {editing ? (
        <EditStaffDrawer
          member={editing}
          busy={busyUid === editing.uid}
          error={drawerError}
          onClose={closeEdit}
          onSave={(data) => handleSaveEdit(editing, data)}
        />
      ) : null}
    </AppShell>
  );
}

function EditStaffDrawer({ member, busy, error, onClose, onSave }) {
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState(member.role ?? "dispatcher");

  function submit(event) {
    event.preventDefault();
    onSave({ name: name.trim() || member.email, role });
  }

  return (
    <SlideOver
      onClose={onClose}
      title="Edit staff"
      subtitle={member.email}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-staff" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Save changes
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}
      <form id="edit-staff" className="space-y-4" onSubmit={submit}>
        <Field label="Full name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" hint="The sign-in email cannot be changed here.">
          <Input value={member.email ?? ""} readOnly disabled />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </SlideOver>
  );
}
