
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { NavCountsProvider } from "./context/NavCountsContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import SettingsPage from "./components/settings/SettingsPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";

export default function App() {
  return (
    <BrowserRouter>
        <AuthProvider>
        <NavCountsProvider>
        <div className="h-dvh min-h-0 w-full overflow-hidden">
          <Routes>
            {/* Routes for users who are not logged in */}
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Routes that require authentication */}
            <Route element={<ProtectedRoute />}>
              <Route path="/app/*" element={<AppLayout />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route
              path="/"
              element={<Navigate to="/app" replace />}
            />

            <Route
              path="*"
              element={<Navigate to="/app" replace />}
            />
          </Routes>
        </div>
        </NavCountsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
