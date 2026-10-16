import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { WEB_ROLES } from "../../config/appConfig";

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user || profile?.active === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const allowed = roles ?? WEB_ROLES;
  if (!role || !allowed.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
