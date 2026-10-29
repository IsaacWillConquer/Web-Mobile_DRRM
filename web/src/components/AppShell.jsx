import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { logoutUser } from "../core/auth/authService";
import { watchReports } from "../core/services/reportsService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, ROLE_LABELS, ROLES } from "../config/appConfig";
import { Icon } from "./ui";
import NotificationBell from "./NotificationBell";
import ReportAlerts from "./ReportAlerts";

const NAV = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: "overview",
    roles: [ROLES.dispatcher, ROLES.dmo, ROLES.admin],
    section: "Operations",
  },
  {
    to: "/dispatch",
    label: "Dispatch",
    icon: "dispatch",
    roles: [ROLES.dispatcher, ROLES.admin],
    section: "Operations",
  },
  {
    to: "/responder",
    label: "Responder",
    icon: "responder",
    roles: [ROLES.rescueTeam, ROLES.dispatcher, ROLES.admin],
    section: "Operations",
  },
  {
    to: "/dmo",
    label: "Analytics",
    icon: "analytics",
    roles: [ROLES.dmo, ROLES.admin],
    section: "Operations",
  },
  {
    to: "/admin/activity",
    label: "Activity",
    icon: "activity",
    roles: [ROLES.admin, ROLES.dmo],
    section: "Administration",
  },
  {
    to: "/admin/staff",
    label: "Staff",
    icon: "staff",
    roles: [ROLES.admin],
    section: "Administration",
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: "users",
    roles: [ROLES.admin],
    section: "Administration",
  },
];

function LogoMark({ className = "h-9 w-9" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5 ${className}`}
    >
      <img src="/kapit-mark.png" alt="" className="h-[78%] w-[78%] object-contain" />
    </span>
  );
}

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function AppShell({ title, subtitle, kicker, actions, children, wide = false }) {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const [attention, setAttention] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only dispatch-level roles can read every report (rescue teams only see their own).
    if (role !== ROLES.dispatcher && role !== ROLES.admin) return undefined;
    const unsub = watchReports(
      { status: "Submitted" },
      (snap) => setAttention(snap.size),
      () => {},
    );
    return unsub;
  }, [role]);

  const items = NAV.filter((item) => !item.roles || (role && item.roles.includes(role)));

  async function handleLogout() {
    await logAction(user?.uid, "auth_logout");
    await logoutUser();
    navigate("/login", { replace: true });
  }

  const sections = [];
  for (const item of items) {
    let group = sections.find((s) => s.name === item.section);
    if (!group) {
      group = { name: item.section, items: [] };
      sections.push(group);
    }
    group.items.push(item);
  }

  const navItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
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
  );

  const nav = (
    <>
      {sections.map((section) => (
        <div key={section.name} className="flex flex-col gap-1">
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {section.name}
          </p>
          {section.items.map(navItem)}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <ReportAlerts />
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
          <LogoMark className="h-8 w-8" />
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
            <LogoMark className="h-10 w-10" />
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">{APP_NAME}</h1>
              <p className="text-[11px] leading-tight text-slate-500">{APP_TAGLINE}</p>
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
                {kicker ? (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                    {kicker}
                  </p>
                ) : null}
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
