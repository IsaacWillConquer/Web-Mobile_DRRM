import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../core/auth/authContext";
import { logAction } from "../../core/audit/logAction";
import {
  createResident,
  deleteResident,
  displayName,
  setResidentActive,
  updateResident,
  watchResidents,
} from "../../core/services/usersService";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Input,
  Pagination,
  Spinner,
} from "../../components/ui";

const EMPTY_FORM = {
  phone: "",
  password: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  email: "",
  city: "",
  barangay: "",
  street: "",
};
const PAGE_SIZE = 10;

function areaOf(member) {
  const address = member?.profile?.address ?? {};
  const parts = [address.barangay, address.city].filter(Boolean);
  return parts.join(", ") || "—";
}

export default function UsersPage() {
  const { user } = useAuth();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsubscribe = watchResidents(
      (rows) => {
        setResidents(rows);
        setLoading(false);
      },
      (err) => {
        setError(err?.message ?? "Unable to load residents.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return residents;
    return residents.filter((r) =>
      [
        displayName(r),
        r.phone,
        r.email,
        areaOf(r),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [residents, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedResidents = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreating(true);
    try {
      const created = await createResident(form);
      await logAction(user?.uid, "resident_created", {
        targetUid: created.uid,
        phone: created.phone,
      });
      setNotice(`Created mobile account for ${created.phone}.`);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err?.message ?? "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(member) {
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await setResidentActive(member.uid, !member.active);
      await logAction(user?.uid, "resident_active_changed", {
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
    if (!window.confirm(`Remove the profile for ${displayName(member)}?`)) return;
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await deleteResident(member.uid);
      await logAction(user?.uid, "resident_deleted", {
        targetUid: member.uid,
        phone: member.phone,
      });
    } catch (err) {
      setError(err?.message ?? "Could not delete the account.");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleSaveEdit(member, data) {
    setBusyUid(member.uid);
    setError("");
    setNotice("");
    try {
      await updateResident(member.uid, data);
      await logAction(user?.uid, "resident_updated", { targetUid: member.uid });
      setNotice(`Updated ${displayName(member)}.`);
      setEditing(null);
    } catch (err) {
      setError(err?.message ?? "Could not update the profile.");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <AppShell
      title="Mobile Users"
      subtitle="Residents who report through the mobile app. Administrators only."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon name="plus" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">Add mobile account</h3>
              <p className="text-xs text-slate-500">
                Residents sign in with the mobile number and password.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <Field label="Mobile number" hint="10 digits, e.g. 9171234567">
              <Input
                required
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </Field>
            <Field label="Temporary password" hint="At least 6 characters.">
              <Input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => updateForm("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last name">
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => updateForm("lastName", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Middle name (optional)">
                <Input
                  value={form.middleName}
                  onChange={(e) => updateForm("middleName", e.target.value)}
                />
              </Field>
              <Field label="Suffix (optional)">
                <Input
                  value={form.suffix}
                  onChange={(e) => updateForm("suffix", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Email (optional)" hint="Contact info only; not used to sign in.">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </Field>
            <Field label="City / Municipality (optional)">
              <Input
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
              />
            </Field>
            <Field label="Barangay (optional)">
              <Input
                value={form.barangay}
                onChange={(e) => updateForm("barangay", e.target.value)}
              />
            </Field>
            <Field label="Street (optional)">
              <Input
                value={form.street}
                onChange={(e) => updateForm("street", e.target.value)}
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
            <div className="border-b border-slate-100 p-4">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, mobile number, or area…"
                className="mt-0"
              />
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-slate-500">
                <Spinner /> Loading residents…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                {residents.length === 0
                  ? "No mobile accounts yet."
                  : `No accounts match “${search.trim()}”.`}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Mobile</th>
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Area</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedResidents.map((member) => {
                        const isBusy = busyUid === member.uid;
                        return (
                          <tr key={member.uid}>
                            <td className="px-5 py-3 font-medium text-slate-900">
                              {displayName(member)}
                            </td>
                            <td className="px-5 py-3 text-slate-600">{member.phone || "—"}</td>
                            <td className="px-5 py-3 text-slate-600">{member.email || "—"}</td>
                            <td className="px-5 py-3 text-slate-600">{areaOf(member)}</td>
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
                                  onClick={() => setEditing(member)}
                                  disabled={isBusy}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleToggleActive(member)}
                                  disabled={isBusy}
                                >
                                  {member.active ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleDelete(member)}
                                  disabled={isBusy}
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
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </>
            )}
          </Card>

          <p className="mt-4 text-xs text-slate-400">
            Residents sign in on the mobile app with their mobile number. Deleting removes the
            profile only; the Firebase Auth account can be removed from the console.
          </p>
        </section>
      </div>

      {editing ? (
        <EditResidentDialog
          member={editing}
          busy={busyUid === editing.uid}
          onClose={() => setEditing(null)}
          onSave={(data) => handleSaveEdit(editing, data)}
        />
      ) : null}
    </AppShell>
  );
}

function addressValue(member, key) {
  return member?.profile?.address?.[key] ?? "";
}

function EditResidentDialog({ member, busy, onClose, onSave }) {
  const [data, setData] = useState({
    firstName: member.firstName ?? "",
    middleName: member.middleName ?? "",
    lastName: member.lastName ?? "",
    suffix: member.suffix ?? "",
    email: member.email ?? "",
    city: addressValue(member, "city"),
    barangay: addressValue(member, "barangay"),
    street: addressValue(member, "street"),
  });

  function set(key, value) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const name = [data.firstName, data.middleName, data.lastName, data.suffix]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");
    onSave({
      firstName: data.firstName.trim(),
      middleName: data.middleName.trim(),
      lastName: data.lastName.trim(),
      suffix: data.suffix.trim(),
      name: name || member.phone,
      email: data.email.trim(),
      profile: {
        ...(member.profile ?? {}),
        address: {
          ...(member.profile?.address ?? {}),
          city: data.city.trim(),
          barangay: data.barangay.trim(),
          street: data.street.trim(),
        },
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit resident</h3>
            <p className="mt-0.5 text-sm text-slate-500">{member.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input required value={data.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input required value={data.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Middle name">
              <Input value={data.middleName} onChange={(e) => set("middleName", e.target.value)} />
            </Field>
            <Field label="Suffix">
              <Input value={data.suffix} onChange={(e) => set("suffix", e.target.value)} />
            </Field>
          </div>
          <Field label="Email" hint="Contact info only; not used to sign in.">
            <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="City / Municipality">
            <Input value={data.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Barangay">
            <Input value={data.barangay} onChange={(e) => set("barangay", e.target.value)} />
          </Field>
          <Field label="Street">
            <Input value={data.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
