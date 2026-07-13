import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── ProtectedRoute ──────────────────────────────────────────
// Purpose: Gate authenticated-only route trees. Renders the nested routes when the user has
// a session; otherwise redirects to /login, passing the page they were trying to reach as a
// `next` query param so AuthPage can send them back after they sign in.
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}
