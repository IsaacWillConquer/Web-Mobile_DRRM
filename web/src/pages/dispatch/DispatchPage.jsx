import AppShell from "../../components/AppShell";

export default function DispatchPage() {
  return (
    <AppShell
      title="Dispatch"
      subtitle="Verify reports, set priority, and assign rescue teams."
    >
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="font-semibold text-slate-900">Dispatch module</h3>
        <p className="mt-1 text-sm text-slate-500">
          Live map of reports/clusters, verification + prioritization, and team assignment
          (P2 — Web Lead).
        </p>
      </div>
    </AppShell>
  );
}
