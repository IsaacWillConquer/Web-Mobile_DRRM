import { Link } from "react-router-dom";
import {
  APP_NAME,
  APP_TAGLINE,
  CREDITS_LINE,
  DEVELOPERS,
  TERMS_OF_USE,
} from "../config/appConfig";
import { Card } from "../components/ui";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/login"
          className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
        >
          ← Back to sign in
        </Link>

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-900/5">
            <img src="/kapit-mark.png" alt="" className="h-[78%] w-[78%] object-contain" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{APP_NAME}</p>
            <h1 className="text-2xl font-bold text-slate-900">
              Terms of Use & Privacy
            </h1>
            <p className="text-sm text-slate-500">{APP_TAGLINE}</p>
          </div>
        </div>

        <Card className="p-8">
          <div className="space-y-6">
            {TERMS_OF_USE.map((section) => (
              <section key={section.title}>
                <h2 className="text-sm font-semibold text-slate-900">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          {DEVELOPERS} · {CREDITS_LINE}
        </p>
      </div>
    </div>
  );
}
