import AppShell from "../../components/AppShell";

export default function DmoPage() {
  return (
    <AppShell
      title="Analytics"
      subtitle="Monitor incident trends and generate operational reports."
    >
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="font-semibold text-slate-900">DMO module</h3>
        <p className="mt-1 text-sm text-slate-500">
          Incident charts plus CSV/PDF report export (P3 — Web #2).
        </p>
      </div>
    </AppShell>
  );
}
