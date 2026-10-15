import AppShell from "../../components/AppShell";

export default function ResponderPage() {
  return (
    <AppShell
      title="Responder"
      subtitle="Accept assignments, update status, and record rescue outcomes."
    >
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="font-semibold text-slate-900">Responder module</h3>
        <p className="mt-1 text-sm text-slate-500">
          Assigned incidents, accept/decline, status updates, and outcome records
          (P3 — Web #2).
        </p>
      </div>
    </AppShell>
  );
}
