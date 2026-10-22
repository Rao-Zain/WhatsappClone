
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function GuestRoute() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fcf5eb]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d9fdd3] border-t-[#25d366]" />
      </div>
    );
  }

  return user ? <Navigate to="/app" replace /> : <Outlet />;
}
