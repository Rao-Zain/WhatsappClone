import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../../lib/api";
import AuthHeader from "./AuthHeader";
import DownloadBanner from "./DownloadBanner";
import AuthInstructions from "./AuthInstructions";
import AuthForm from "./AuthForm";
import AuthFooter from "./AuthFooter";
import AuthLoading from "./AuthLoading";
import { useAuth } from "../../context/AuthContext";

const INITIAL_FORM = {
  username: "",
  email: "",
  phone: "",
  password: "",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const signupSuccess = location.state?.signupSuccess;

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));

    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!formData.username.trim()) {
      nextErrors.username = "Username or email is required.";
    }

    if (!formData.password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsLoading(true);
      setFormError("");

      const response = await api.post("/auth/login", {
        username: formData.username.trim(),
        password: formData.password,
      });

      const { token, user } = response.data;

      if (!token) {
        throw new Error("The server did not return an authentication token.");
      }

      localStorage.removeItem("token");
      sessionStorage.removeItem("token");

      const storage = stayLoggedIn ? localStorage : sessionStorage;

      storage.setItem("token", token);

      if (user) {
        storage.setItem("user", JSON.stringify(user));
        setUser(user);
      }

      navigate("/app", {
        replace: true,
        state: { loginSuccess: true },
      });
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.message ||
          "Login failed. Please check your credentials and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <AuthLoading onLogout={() => setIsLoading(false)} />;
  }

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#f0f2f5] font-sans text-[#111b21] antialiased">
      {/* WhatsApp desktop top green banner */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[222px] bg-[#00a884] lg:block"
        aria-hidden="true"
      />

      {/* Main page content wrapper */}
      <div className="relative z-10 flex min-h-full flex-col">
        <AuthHeader />

        <main className="mx-auto w-full max-w-[1020px] flex-1 px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {signupSuccess && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-[#b7e4c7] bg-[#d9fdd3] px-4 py-3 text-sm text-[#166534] shadow-xs"
            >
              Your account has been created successfully. Please log in.
            </div>
          )}

          <DownloadBanner />

          {/* Main Auth Card */}
          <section className="mt-3 w-full rounded-2xl border border-[#e9edef] bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8 sm:shadow-md lg:p-12">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_minmax(320px,380px)] lg:gap-12">
              {/* Left Column: Instructions */}
              <div className="border-b border-[#e9edef] pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <AuthInstructions mode="login" />
              </div>

              {/* Right Column: Form */}
              <div className="w-full min-w-0">
                {formError && (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl border border-red-200 bg-[#fde8e8] px-4 py-3 text-sm text-[#bc1c1c] shadow-xs"
                  >
                    {formError}
                  </div>
                )}

                <AuthForm
                  mode="login"
                  formData={formData}
                  errors={errors}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                  stayLoggedIn={stayLoggedIn}
                  setStayLoggedIn={setStayLoggedIn}
                />
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-6 w-full pb-8">
            <AuthFooter
              mode="login"
              onSwitchMode={(mode) => {
                if (mode === "signup") {
                  navigate("/signup");
                }
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}