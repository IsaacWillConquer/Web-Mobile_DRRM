import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { logoutUser } from "../core/auth/authService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS, ROLES } from "../config/appConfig";

const NAV = [
  { to: "/dashboard", label: "Overview", roles: null },
  { to: "/dispatch", label: "Dispatch", roles: [ROLES.dispatcher, ROLES.dmo] },
  { to: "/responder", label: "Responder", roles: [ROLES.rescueTeam, ROLES.dispatcher] },
  { to: "/dmo", label: "Analytics", roles: [ROLES.dmo] },
];

export default function AppShell({ title, subtitle, children }) {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

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
          <p className="text-xs text-slate-500">{APP_TAGLINE}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-sm font-medium text-slate-800">
              {profile?.name ?? user?.email}
            </span>
            <span className="block text-xs text-slate-500">
              {ROLE_LABELS[role] ?? "No role"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white px-6">
        <div className="mx-auto flex max-w-5xl gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `border-b-2 px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {title ? (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
