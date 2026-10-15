import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, loginUser, logoutUser } from "../core/auth/authService";
import { useAuth } from "../core/auth/authContext";
import { logAction } from "../core/audit/logAction";
import { APP_NAME, APP_TAGLINE, WEB_ROLES } from "../config/appConfig";

const STAFF_ONLY =
  "This portal is for dispatchers, rescue teams, and disaster management officers. " +
  "Residents, please use the mobile app.";

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
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    (async () => {
      const profile = await getUserProfile(user.uid);
      if (!active) return;
      if (profile && WEB_ROLES.includes(profile.role)) {
        navigate("/dashboard", { replace: true });
      } else {
        await logoutUser();
        setError(STAFF_ONLY);
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
      if (!profile || !WEB_ROLES.includes(profile.role)) {
        await logAction(credential.user.uid, "web_login_blocked", {
          role: profile?.role ?? null,
        });
        await logoutUser();
        setError(STAFF_ONLY);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-slate-500">{APP_TAGLINE}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-blue-700">
          Staff Portal
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-600"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are issued by the administrator.
        </p>
      </div>
    </div>
  );
}
