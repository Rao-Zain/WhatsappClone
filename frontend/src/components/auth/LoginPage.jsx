import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../../lib/api";
import AuthLayout, { AuthCardHeader } from "./AuthLayout";
import AuthAlert from "./AuthAlert";
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
    const passwordReset = location.state?.passwordReset;
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
    <AuthLayout>
      <AuthCardHeader
        title="Welcome back"
        subtitle="Log in to pick up your conversations right where you left off."
      />

      {signupSuccess && (
        <AuthAlert kind="success">
          Your account has been created successfully. Please log in.
        </AuthAlert>
      )}

      {passwordReset && (
        <AuthAlert kind="success">
          Your password has been changed. Please log in with your new password.
        </AuthAlert>
      )}

      {formError && <AuthAlert kind="error">{formError}</AuthAlert>}

      <AuthForm
        mode="login"
        formData={formData}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        stayLoggedIn={stayLoggedIn}
        setStayLoggedIn={setStayLoggedIn}
      />

      <AuthFooter
        mode="login"
        onSwitchMode={(mode) => {
          if (mode === "signup") {
            navigate("/signup");
          }
        }}
      />
    </AuthLayout>
  );
}
