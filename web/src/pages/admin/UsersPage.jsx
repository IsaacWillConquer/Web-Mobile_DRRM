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
  Avatar,
  Button,
  Card,
  Field,
  FilterChips,
  Icon,
  Input,
  Pager,
  SearchBar,
  SlideOver,
  Spinner,
  StatusPill,
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

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "disabled", label: "Disabled" },
];

function areaOf(member) {
  const address = member?.profile?.address ?? {};
  const parts = [address.barangay, address.city].filter(Boolean);
  return parts.join(", ") || "—";
}

function formatMobile(e164) {
  const digits = String(e164 ?? "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return e164 || "—";
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [residents, setResidents] = useState([]);
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
  const [statusFilter, setStatusFilter] = useState("all");
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

  const counts = useMemo(
    () => ({
      all: residents.length,
      active: residents.filter((r) => r.active !== false).length,
      disabled: residents.filter((r) => r.active === false).length,
    }),
    [residents],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return residents.filter((r) => {
      if (statusFilter === "active" && r.active === false) return false;
      if (statusFilter === "disabled" && r.active !== false) return false;
      if (!term) return true;
      return [displayName(r), r.phone, r.email, areaOf(r)]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [residents, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedResidents = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const chipOptions = STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }));

  async function handleCreate(event) {
    event.preventDefault();
    setDrawerError("");
    setNotice("");
    setCreating(true);
    try {
      const created = await createResident(form);
      await logAction(user?.uid, "resident_created", {
        targetUid: created.uid,
        phone: created.phone,
      });
      setNotice(`Created mobile account for ${formatMobile(created.phone)}.`);
      setForm(EMPTY_FORM);
      closeCreate();
    } catch (err) {
      setDrawerError(err?.message ?? "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(member) {
    setBusyUid(member.uid);
    setDrawerError("");
    setNotice("");
    try {
      await setResidentActive(member.uid, !member.active);
      await logAction(user?.uid, "resident_active_changed", {
        targetUid: member.uid,
        active: !member.active,
      });
    } catch (err) {
      setDrawerError(err?.message ?? "Could not update status.");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Remove the profile for ${displayName(member)}?`)) return;
    setBusyUid(member.uid);
    setDrawerError("");
    setNotice("");
    try {
      await deleteResident(member.uid);
      await logAction(user?.uid, "resident_deleted", {
        targetUid: member.uid,
        phone: member.phone,
      });
      closeEdit();
    } catch (err) {
      setDrawerError(err?.message ?? "Could not delete the account.");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleSaveEdit(member, data) {
    setBusyUid(member.uid);
    setDrawerError("");
    setNotice("");
    try {
      await updateResident(member.uid, data);
      await logAction(user?.uid, "resident_updated", { targetUid: member.uid });
      setNotice(`Updated ${displayName(member)}.`);
      closeEdit();
    } catch (err) {
      setDrawerError(err?.message ?? "Could not update the profile.");
    } finally {
      setBusyUid(null);
    }
  }

  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <AppShell
      kicker="Administration"
      title="Mobile users"
      subtitle="Residents who report through the mobile app."
      actions={
        <Button onClick={openCreate}>
          <Icon name="plus" className="h-4 w-4" />
          Add resident
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
            placeholder="Search name, mobile number, or area…"
            className="w-full sm:w-80"
          />
          <FilterChips
            options={chipOptions}
            value={statusFilter}
            onChange={(key) => {
              setStatusFilter(key);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-slate-500">
            <Spinner /> Loading residents…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {residents.length === 0 ? "No mobile accounts yet." : "No accounts match your filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Resident</th>
                    <th className="px-5 py-3 font-medium">Mobile</th>
                    <th className="px-5 py-3 font-medium">Area</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedResidents.map((member) => {
                    const isBusy = busyUid === member.uid;
                    return (
                      <tr
                        key={member.uid}
                        onClick={() => !isBusy && openEdit(member)}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                      >
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
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {member.email || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {formatMobile(member.phone)}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{areaOf(member)}</td>
                        <td className="px-5 py-3 text-right">
                          <StatusPill tone={member.active ? "green" : "slate"}>
                            {member.active ? "Active" : "Disabled"}
                          </StatusPill>
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
              summary={`Showing ${start}–${end} of ${filtered.length} residents`}
            />
          </>
        )}
      </Card>

      {createOpen ? (
        <CreateResidentDrawer
          form={form}
          updateForm={updateForm}
          busy={creating}
          error={drawerError}
          onClose={closeCreate}
          onSubmit={handleCreate}
        />
      ) : null}

      {editing ? (
        <EditResidentDrawer
          member={residents.find((r) => r.uid === editing.uid) ?? editing}
          busy={busyUid === editing.uid}
          error={drawerError}
          onClose={closeEdit}
          onSave={(data) => handleSaveEdit(editing, data)}
          onToggleActive={() => handleToggleActive(editing)}
          onDelete={() => handleDelete(editing)}
        />
      ) : null}
    </AppShell>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{children}</p>
  );
}

function CreateResidentDrawer({ form, updateForm, busy, error, onClose, onSubmit }) {
  return (
    <SlideOver
      onClose={onClose}
      title="Add resident"
      subtitle="Residents sign in with their mobile number."
      width="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-resident" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {busy ? "Creating…" : "Create account"}
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}
      <form id="create-resident" className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionLabel>Sign-in</SectionLabel>
          <Field label="Mobile number" hint="10 digits, e.g. 9171234567">
            <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 focus-within:border-blue-500">
              <span className="text-sm font-semibold text-slate-500">+63</span>
              <input
                required
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="917 123 4567"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </Field>
          <Field label="Temporary password" hint="Share it with the resident; they can change it later.">
            <div className="mt-1 flex items-center gap-2">
              <Input
                required
                minLength={6}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                className="mt-0"
              />
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => updateForm("password", generatePassword())}
                className="shrink-0"
              >
                <Icon name="refresh" className="h-4 w-4" />
                Generate
              </Button>
            </div>
          </Field>
        </div>

        <div className="space-y-4">
          <SectionLabel>Profile</SectionLabel>
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
            <Field label="Middle name">
              <Input
                placeholder="Optional"
                value={form.middleName}
                onChange={(e) => updateForm("middleName", e.target.value)}
              />
            </Field>
            <Field label="Suffix">
              <Input
                placeholder="Optional"
                value={form.suffix}
                onChange={(e) => updateForm("suffix", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email" hint="Contact info only; not used to sign in.">
            <Input
              type="email"
              placeholder="Optional"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-4">
          <SectionLabel>Location</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City / Municipality">
              <Input
                placeholder="Optional"
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
              />
            </Field>
            <Field label="Barangay">
              <Input
                placeholder="Optional"
                value={form.barangay}
                onChange={(e) => updateForm("barangay", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Street">
            <Input
              placeholder="Optional"
              value={form.street}
              onChange={(e) => updateForm("street", e.target.value)}
            />
          </Field>
        </div>
      </form>
    </SlideOver>
  );
}

function addressValue(member, key) {
  return member?.profile?.address?.[key] ?? "";
}

function EditResidentDrawer({ member, busy, error, onClose, onSave, onToggleActive, onDelete }) {
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
    <SlideOver
      onClose={onClose}
      title="Edit resident"
      subtitle={formatMobile(member.phone)}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onToggleActive} disabled={busy}>
              {member.active ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="dangerOutline"
              onClick={onDelete}
              disabled={busy}
            >
              <Icon name="trash" className="h-4 w-4" />
              Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="edit-resident" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      }
    >
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}
      <form id="edit-resident" className="space-y-5" onSubmit={submit}>
        <div className="space-y-4">
          <SectionLabel>Profile</SectionLabel>
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
              <Input placeholder="Optional" value={data.middleName} onChange={(e) => set("middleName", e.target.value)} />
            </Field>
            <Field label="Suffix">
              <Input placeholder="Optional" value={data.suffix} onChange={(e) => set("suffix", e.target.value)} />
            </Field>
          </div>
          <Field label="Email" hint="Contact info only; not used to sign in.">
            <Input type="email" placeholder="Optional" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        <div className="space-y-4">
          <SectionLabel>Location</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City / Municipality">
              <Input placeholder="Optional" value={data.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Barangay">
              <Input placeholder="Optional" value={data.barangay} onChange={(e) => set("barangay", e.target.value)} />
            </Field>
          </div>
          <Field label="Street">
            <Input placeholder="Optional" value={data.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
        </div>
      </form>
    </SlideOver>
  );
}
