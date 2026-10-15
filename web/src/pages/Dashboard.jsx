import { useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { logoutUser } from "../core/auth/authService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, ROLE_LABELS } from "../config/appConfig";

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logAction(user?.uid, "auth_logout");
    await logoutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{APP_NAME}</h1>
          <p className="text-xs text-slate-500">Disaster Rescue Reporting & Monitoring</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Signed in as</p>
          <h2 className="text-xl font-bold text-slate-900">
            {profile?.name ?? user?.email}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Role: <span className="font-semibold">{ROLE_LABELS[role] ?? "—"}</span>
          </p>
          {!role ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No role found on your profile yet. Ask an administrator to set it in the
              Firestore <code>users</code> collection.
            </p>
          ) : null}
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
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

        <p className="mt-6 text-xs text-slate-400">
          P1 scaffold — modules land in P2–P5.
        </p>
      </main>
    </div>
  );
}
