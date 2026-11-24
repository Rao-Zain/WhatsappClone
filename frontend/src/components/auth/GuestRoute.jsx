
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function GuestRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
           <div className="flex h-screen items-center justify-center bg-[var(--wa-auth-page-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--wa-border)] border-t-[color:var(--wa-accent)]" />
      </div>
    );
  }

  return user ? <Navigate to="/app" replace /> : <Outlet />;
}
