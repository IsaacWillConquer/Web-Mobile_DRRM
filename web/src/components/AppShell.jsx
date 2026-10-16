import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { logoutUser } from "../core/auth/authService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS, ROLES } from "../config/appConfig";
import { Icon } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: "overview", roles: null },
  {
    to: "/dispatch",
    label: "Dispatch",
    icon: "dispatch",
    roles: [ROLES.dispatcher, ROLES.dmo, ROLES.admin],
  },
  {
    to: "/responder",
    label: "Responder",
    icon: "responder",
    roles: [ROLES.rescueTeam, ROLES.dispatcher, ROLES.admin],
  },
  { to: "/dmo", label: "Analytics", icon: "analytics", roles: [ROLES.dmo, ROLES.admin] },
  { to: "/admin/staff", label: "Staff", icon: "staff", roles: [ROLES.admin] },
];

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AppShell({ title, subtitle, actions, children, wide = false }) {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  async function handleLogout() {
    await logAction(user?.uid, "auth_logout");
    await logoutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm shadow-blue-900/20">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-slate-900">{APP_NAME}</h1>
              <p className="hidden text-xs text-slate-500 sm:block">{APP_TAGLINE}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <span className="block text-sm font-semibold text-slate-800">
                {profile?.name ?? user?.email}
              </span>
              <span className="block text-xs text-slate-500">
                {ROLE_LABELS[role] ?? "No role"}
              </span>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
              {initials(profile?.name, user?.email)}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1 overflow-x-auto">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-blue-700 text-blue-700"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className={`mx-auto ${wide ? "max-w-none" : "max-w-7xl"} px-6 py-8`}>
        {title || actions ? (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              {title ? <h2 className="text-2xl font-bold text-slate-900">{title}</h2> : null}
              {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex gap-2">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
