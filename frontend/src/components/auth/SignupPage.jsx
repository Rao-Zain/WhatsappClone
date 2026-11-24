import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";

import api from "../../../lib/api";
import { useAuth } from "../../context/AuthContext";

import AuthLayout, { AuthCardHeader } from "./AuthLayout";
import AuthAlert from "./AuthAlert";
import AuthForm from "./AuthForm";
import AuthFooter from "./AuthFooter";
import { otpInputClass, primaryButtonClass } from "./authStyles";
const INITIAL_FORM = {
  username: "",
  email: "",
  phone: "",
  password: "",
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [verificationStep, setVerificationStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

  // STEP 1: Submit registration details and request an OTP
  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!formData.username.trim()) {
      nextErrors.username = "Username is required.";
    } else if (formData.username.trim().length < 3) {
      nextErrors.username = "Username must contain at least 3 characters.";
    }

    const email = formData.email.trim();

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }

    if (formData.password.length < 8) {
      nextErrors.password = "Password must contain at least 8 characters.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");
      setSuccessMessage("");

      const response = await api.post("/auth/register", {
        username: formData.username.trim(),
        email,
        phone: formData.phone.trim(),
        password: formData.password,
      });

      if (!response.data?.requiresEmailVerification) {
        throw new Error(
          "The server did not confirm email verification is required."
        );
      }

      setVerifiedEmail(response.data.email || email);
      setOtp("");
      setVerificationStep(true);
      setSuccessMessage(
        response.data.message ||
          "Verification code sent. Check your email inbox."
      );
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.message ||
          "Unable to start registration. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Verify the email OTP and establish the session
  const handleVerifyOtp = async (event) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      setFormError("Enter the complete 6-digit verification code.");
      return;
    }

    try {
      setIsVerifying(true);
      setFormError("");
      setSuccessMessage("");

      const response = await api.post("/auth/verify-otp", {
        email: verifiedEmail,
        otp,
      });

      const { token, user } = response.data || {};

      if (!token || !user) {
        throw new Error(
          "Verification succeeded, but the server did not return the expected account details."
        );
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      setUser(user);

      navigate("/app", {
        replace: true,
        state: { signupSuccess: true },
      });
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.message ||
          "Unable to verify the code. Please try again."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setIsResending(true);
      setFormError("");
      setSuccessMessage("");

      const response = await api.post("/auth/resend-otp", {
        email: verifiedEmail,
      });

      setOtp("");
      setSuccessMessage(
        response.data?.message ||
          "A new verification code has been sent to your email."
      );
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Unable to resend the code. Please try again later."
      );
    } finally {
      setIsResending(false);
    }
  };

  const returnToSignup = () => {
    setVerificationStep(false);
    setOtp("");
    setFormError("");
    setSuccessMessage("");
  };

   return (
    <AuthLayout>
      {!verificationStep ? (
        <AuthCardHeader
          title="Create your account"
          subtitle="Join HexaChat in less than a minute. Verify your email to get started."
        />
      ) : (
        <div className="mb-7">
          <button
            type="button"
            onClick={returnToSignup}
            className="mb-5 inline-flex items-center gap-2 text-[13.5px] font-semibold text-[color:var(--wa-text-secondary)] transition hover:text-[color:var(--wa-accent)]"
          >
            <ArrowLeft size={16} />
            Back to signup
          </button>

          <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--wa-chip-active-bg)] text-[color:var(--wa-accent)]">
            <Mail size={24} />
          </span>

          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[color:var(--wa-text-primary)]">
            Verify your email
          </h1>

          <p className="mt-2 text-[14.5px] leading-6 text-[color:var(--wa-text-secondary)]">
            We&apos;ve sent a 6-digit verification code to
            <span className="mt-0.5 block break-all font-semibold text-[color:var(--wa-text-primary)]">
              {verifiedEmail}
            </span>
          </p>
        </div>
      )}

      {formError && <AuthAlert kind="error">{formError}</AuthAlert>}
      {successMessage && <AuthAlert kind="success">{successMessage}</AuthAlert>}

      {!verificationStep ? (
        <>
          <AuthForm
            mode="signup"
            formData={formData}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            stayLoggedIn={false}
            setStayLoggedIn={() => {}}
            isSubmitting={isSubmitting}
          />

          <AuthFooter
            mode="signup"
            onSwitchMode={(mode) => {
              if (mode === "login") {
                navigate("/login");
              }
            }}
          />
        </>
      ) : (
        <>
          <form onSubmit={handleVerifyOtp} noValidate className="w-full">
            <label
              htmlFor="signup-otp"
              className="mb-1.5 block text-[13px] font-semibold text-[color:var(--wa-text-strong)]"
            >
              Verification code
            </label>

            <input
              id="signup-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setFormError("");
              }}
              disabled={isVerifying}
              className={`${otpInputClass} border-[color:var(--wa-auth-input-border)]`}
            />

            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className={`${primaryButtonClass} mt-5`}
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Verify email
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-[color:var(--wa-border)] pt-5 text-center">
            <p className="mb-2 text-[12.5px] leading-5 text-[color:var(--wa-text-secondary)]">
              Didn&apos;t receive the email? Check your spam folder or request
              another code.
            </p>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResending || isVerifying}
              className="text-[13.5px] font-semibold text-[color:var(--wa-accent)] hover:text-[color:var(--wa-accent-hover)] hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
            >
              {isResending ? "Sending new code..." : "Resend verification code"}
            </button>
          </div>
        </>
      )}
    </AuthLayout>
  );

}