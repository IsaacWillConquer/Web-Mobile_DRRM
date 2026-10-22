import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { logoutUser } from "../core/auth/authService";
import { watchReports } from "../core/services/reportsService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS, ROLES } from "../config/appConfig";
import { Icon } from "./ui";
import NotificationBell from "./NotificationBell";

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
  { to: "/admin/activity", label: "Activity", icon: "activity", roles: [ROLES.admin, ROLES.dmo] },
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
  const [attention, setAttention] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsub = watchReports(
      { status: "Submitted" },
      (snap) => setAttention(snap.size),
      () => {},
    );
    return unsub;
  }, []);

  const items = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  async function handleLogout() {
    await logAction(user?.uid, "auth_logout");
    await logoutUser();
    navigate("/login", { replace: true });
  }

  const nav = (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`
          }
        >
          <Icon name={item.icon} className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.to === "/dispatch" && attention > 0 ? (
            <span
              title={`${attention} report${attention > 1 ? "s" : ""} awaiting verification`}
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {attention > 9 ? "9+" : attention}
            </span>
          ) : null}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white">
            <Icon name="shield" className="h-4 w-4" />
          </span>
          <h1 className="text-sm font-bold text-slate-900">{APP_NAME}</h1>
        </span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </header>

      {/* Backdrop (mobile) */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      {/* Sidebar: static on lg, drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm shadow-blue-900/20">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-bold text-slate-900">{APP_NAME}</h1>
              <p className="text-xs text-slate-500">{APP_TAGLINE}</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">{nav}</nav>

          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center gap-3 px-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {initials(profile?.name, user?.email)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {profile?.name ?? user?.email}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {ROLE_LABELS[role] ?? "No role"}
                </span>
              </div>
              <NotificationBell />
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
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
    </div>
  );
}
