import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUserProfile, loginUser, logoutUser } from "../core/auth/authService";
import { useAuth } from "../core/auth/authContext";
import { logAction } from "../core/audit/logAction";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TAGLINE,
  CREDITS_LINE,
  DEVELOPERS,
  LDRRMO_HOTLINE,
  WEB_ROLES,
} from "../config/appConfig";
import { Alert, Button, Field, Icon, Input, Spinner } from "../components/ui";

const FEATURES = [
  {
    icon: "dispatch",
    title: "Verify reports on a live map",
    detail: "Oldest report first, so no one waits unseen.",
  },
  {
    icon: "staff",
    title: "Assign the right team",
    detail: "Track each rescue from assigned to resolved.",
  },
  {
    icon: "activity",
    title: "Full audit trail",
    detail: "Every sign-in and dispatch action is logged.",
  },
];

const STAFF_ONLY =
  "This portal is for administrators, dispatchers, rescue teams, and disaster " +
  "management officers. Residents, please use the mobile app.";

const DISABLED =
  "This account has been disabled. Contact an administrator to restore access.";

function blockReason(profile) {
  if (!profile || !WEB_ROLES.includes(profile.role)) return STAFF_ONLY;
  if (profile.active === false) return DISABLED;
  return null;
}

function friendlyError(err) {
  const code = err?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "Incorrect email or password.";
  }
  if (code.includes("user-not-found")) return "No account found for that email.";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  if (code.includes("invalid-email")) return "Please enter a valid email.";
  if (code.includes("invalid-api-key") || code.includes("configuration")) {
    return "Firebase is not configured yet. See docs/SETUP.md.";
  }
  return "Unable to sign in. Check your connection and try again.";
}

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    (async () => {
      const profile = await getUserProfile(user.uid);
      if (!active) return;
      const reason = blockReason(profile);
      if (!reason) {
        navigate("/dashboard", { replace: true });
      } else {
        await logoutUser();
        setError(reason);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, loading, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const credential = await loginUser({ email, password });
      const profile = await getUserProfile(credential.user.uid);
      const reason = blockReason(profile);
      if (reason) {
        await logAction(credential.user.uid, "web_login_blocked", {
          role: profile?.role ?? null,
          active: profile?.active ?? null,
        });
        await logoutUser();
        setError(reason);
        return;
      }
      await logAction(credential.user.uid, "auth_login");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 p-10 text-white lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-blue-950/30">
            <img src="/kapit-mark.png" alt="" className="h-[78%] w-[78%] object-contain" />
          </span>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-50 ring-1 ring-inset ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {APP_TAGLINE}
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight xl:text-5xl">
            Coordinate every rescue,
            <br />
            in real time.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-blue-100/90">{APP_DESCRIPTION}</p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon name={feature.icon} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{feature.title}</span>
                  <span className="block text-xs text-blue-100/80">{feature.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-blue-100/70">
          {DEVELOPERS} · {CREDITS_LINE}
        </p>
      </aside>

      <main className="flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow ring-1 ring-slate-900/5">
              <img src="/kapit-mark.png" alt="" className="h-[78%] w-[78%] object-contain" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold text-slate-900">{APP_NAME}</p>
              <p className="text-[11px] text-slate-500">{APP_TAGLINE}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-100">
              Staff Portal
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in with the account issued by your administrator.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@agency.gov.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-0 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
                  </button>
                </div>
              </label>

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Icon name="logout" className="h-4 w-4" />
                )}
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-inset ring-slate-900/5">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                Accounts are issued by the administrator. Need access? Contact your LDRRMO
                admin.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-100/70 px-4 py-2.5 text-center text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            <span>
              Life-threatening emergency? Call the LDRRMO hotline{" "}
              <a
                href={`tel:${LDRRMO_HOTLINE}`}
                className="font-semibold underline underline-offset-2"
              >
                {LDRRMO_HOTLINE}
              </a>
            </span>
          </div>

          <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
            Submitting a report does not guarantee immediate rescue. By signing in you agree to
            our{" "}
            <Link to="/terms" className="font-medium text-slate-500 hover:underline">
              Terms of Use & Privacy
            </Link>
            .
          </p>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400 lg:hidden">
            {DEVELOPERS} · {CREDITS_LINE}
          </p>
        </div>
      </main>
    </div>
  );
}
