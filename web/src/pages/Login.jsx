import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, loginUser, logoutUser } from "../core/auth/authService";
import { useAuth } from "../core/auth/authContext";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, WEB_ROLES } from "../config/appConfig";
import { Alert, Button, Field, Icon, Input, Spinner } from "../components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-900/20">
            <Icon name="shield" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
            <p className="text-sm text-slate-500">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5">
          <p className="mb-6 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Staff Portal
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
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
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Accounts are issued by the administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
