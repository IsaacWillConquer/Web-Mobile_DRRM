import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../core/auth/authService";
import { logAction } from "../core/audit/logAction";
import { APP_NAME } from "../config/appConfig";

function friendlyError(err) {
  const code = err?.code ?? "";
  if (code.includes("email-already-in-use")) return "That email is already registered.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid email.";
  if (code.includes("invalid-api-key") || code.includes("configuration")) {
    return "Firebase is not configured yet. See docs/SETUP.md.";
  }
  return "Unable to create the account. Try again.";
}

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await registerUser(form);
      await logAction(user.uid, "auth_register");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-600";
  const label = "text-sm font-medium text-slate-700";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">{APP_NAME}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className={label}>Full name</span>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={field}
            />
          </label>

          <label className="block">
            <span className={label}>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={field}
            />
          </label>

          <label className="block">
            <span className={label}>Phone</span>
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="e.g. 09171234567"
              className={field}
            />
          </label>

          <label className="block">
            <span className={label}>Password</span>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className={field}
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
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
