import AppShell from "../components/AppShell";
import { useAuth } from "../core/auth/authContext";

export default function Dashboard() {
  const { profile } = useAuth();

  return (
    <AppShell title={`Welcome, ${profile?.name ?? "there"}`}>
      {!profile?.role ? (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No role found on your profile yet. Ask an administrator to set it in the
          Firestore <code>users</code> collection.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Reporting</h3>
          <p className="mt-1 text-sm text-slate-500">
            Submit and track disaster reports (resident mobile app).
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Dispatch</h3>
          <p className="mt-1 text-sm text-slate-500">
            Verify, prioritize, and assign rescue teams (dispatcher).
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Responder</h3>
          <p className="mt-1 text-sm text-slate-500">
            Accept assignments and record rescue outcomes (rescue team).
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Analytics</h3>
          <p className="mt-1 text-sm text-slate-500">
            Incident trends and operational reports (DMO).
          </p>
        </div>
      </section>
    </AppShell>
  );
}
