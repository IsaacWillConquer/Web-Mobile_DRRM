import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { useAuth } from "../core/auth/authContext";
import { Badge, Card, Icon } from "../components/ui";
import { LDRRMO_HOTLINE, ROLE_LABELS, ROLES, SAFETY_NOTICE } from "../config/appConfig";

const MODULES = [
  {
    to: "/dispatch",
    title: "Dispatch",
    description: "Verify, prioritize, and assign rescue teams to incidents on the live map.",
    icon: "dispatch",
    roles: [ROLES.dispatcher, ROLES.dmo, ROLES.admin],
    accent: "bg-blue-50 text-blue-700",
  },
  {
    to: "/responder",
    title: "Responder",
    description: "Accept assignments, update response status, and record rescue outcomes.",
    icon: "responder",
    roles: [ROLES.rescueTeam, ROLES.dispatcher, ROLES.admin],
    accent: "bg-amber-50 text-amber-700",
  },
  {
    to: "/dmo",
    title: "Analytics",
    description: "Incident trends, statistics, and exportable operational reports.",
    icon: "analytics",
    roles: [ROLES.dmo, ROLES.admin],
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/admin/staff",
    title: "Staff",
    description: "Create staff accounts and manage roles and access.",
    icon: "staff",
    roles: [ROLES.admin],
    accent: "bg-violet-50 text-violet-700",
  },
];

export default function Dashboard() {
  const { profile, role } = useAuth();
  const modules = MODULES.filter((m) => role && m.roles.includes(role));

  return (
    <AppShell
      title={`Welcome, ${profile?.name ?? "there"}`}
      subtitle="Disaster Rescue Reporting & Monitoring — staff operations."
    >
      {!role ? (
        <Card className="mb-6 border-l-4 border-amber-400 p-5">
          <div className="flex items-start gap-3">
            <span className="text-amber-500">
              <Icon name="alert" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">No role assigned yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ask an administrator to set your <code>role</code> in the Firestore{" "}
                <code>users</code> collection.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-6 flex items-start gap-3 border-l-4 border-amber-400 p-4">
            <span className="mt-0.5 text-amber-500">
              <Icon name="alert" className="h-5 w-5" />
            </span>
            <p className="text-sm text-amber-900">
              {SAFETY_NOTICE}{" "}
              <a
                href={`tel:${LDRRMO_HOTLINE}`}
                className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-700"
              >
                {LDRRMO_HOTLINE}
              </a>
            </p>
          </Card>
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icon name="shield" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Signed in as</p>
              <p className="font-semibold text-slate-900">{profile?.name ?? "—"}</p>
            </div>
          </div>
          <Badge className="bg-blue-50 text-blue-700">{ROLE_LABELS[role] ?? role}</Badge>
          </Card>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Link key={module.to} to={module.to} className="group">
            <Card className="h-full p-6 transition-shadow group-hover:shadow-md">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.accent}`}
              >
                <Icon name={module.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 flex items-center gap-1 font-semibold text-slate-900">
                {module.title}
                <span className="text-slate-300 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </h3>
              <p className="mt-1 text-sm text-slate-500">{module.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
