import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Lock, Mail, RefreshCw, ShieldCheck } from "lucide-react";

import api from "../../../lib/api";
import AuthLayout, { AuthCardHeader } from "./AuthLayout";
import AuthAlert from "./AuthAlert";
import AuthInput from "./AuthInput";
import { linkClass, otpInputClass, primaryButtonClass } from "./authStyles";

const RESEND_SECONDS = 60; // keep in sync with OTP_RESEND_COOLDOWN_SECONDS on the server
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Forgot password:
   step 1 - enter your email, we send a 6-digit code
   step 2 - enter the code and a new password */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // "email" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Counts down the "Resend code" wait.
  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async () => {
    const response = await api.post("/auth/forgot-password", {
      email: email.trim(),
    });

    setNotice(response.data.message || "");
    setCooldown(RESEND_SECONDS);
  };

  // STEP 1: ask for a code
  const handleSendCode = async (event) => {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }

    try {
      setIsBusy(true);
      setErrors({});
      setFormError("");

      await requestCode();
      setStep("reset");
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "We could not send the code. Please try again."
      );
    } finally {
      setIsBusy(false);
    }
  };

  // Send a new code (same request as step 1)
  const handleResend = async () => {
    if (cooldown > 0 || isBusy) return;

    try {
      setIsBusy(true);
      setFormError("");
      setOtp("");

      await requestCode();
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "We could not send a new code. Please try again."
      );
    } finally {
      setIsBusy(false);
    }
  };

  // STEP 2: code + new password
  const handleReset = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!/^\d{6}$/.test(otp)) {
      nextErrors.otp = "Enter the 6-digit code from the email.";
    }

    if (newPassword.length < 8) {
      nextErrors.newPassword = "Password must be at least 8 characters.";
    } else if (newPassword.length > 72) {
      nextErrors.newPassword = "Password cannot be longer than 72 characters.";
    }

    if (!nextErrors.newPassword && newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "The passwords do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setIsBusy(true);
      setFormError("");

      await api.post("/auth/reset-password", {
        email: email.trim(),
        otp,
        newPassword,
      });

      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "We could not reset your password. Please try again."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const primaryButton = `${primaryButtonClass} mt-2`;

  return (
    <AuthLayout>
      <AuthCardHeader
        icon={KeyRound}
        title={step === "email" ? "Forgot your password?" : "Choose a new password"}
        subtitle={
          step === "email"
            ? "Enter the email address of your account and we'll send you a 6-digit code to reset your password."
            : undefined
        }
      />

      {formError && <AuthAlert kind="error">{formError}</AuthAlert>}

      {step === "email" ? (
        <form onSubmit={handleSendCode} noValidate>
          <AuthInput
            id="forgot-email"
            label="Email address"
            name="email"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors({});
              setFormError("");
            }}
            error={errors.email}
            autoComplete="email"
          />

          <button type="submit" disabled={isBusy} className={primaryButton}>
            {isBusy ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset code"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} noValidate>
          {notice && <AuthAlert kind="success">{notice}</AuthAlert>}

          <p className="-mt-3 mb-5 text-[14px] leading-6 text-[color:var(--wa-text-secondary)]">
            Code sent to{" "}
            <span className="break-all font-semibold text-[color:var(--wa-text-primary)]">
              {email.trim()}
            </span>
          </p>

          <label
            htmlFor="reset-otp"
            className="mb-1.5 block text-[13px] font-semibold text-[color:var(--wa-text-strong)]"
          >
            Reset code
          </label>

          <input
            id="reset-otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            disabled={isBusy}
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
              setErrors((previous) => ({ ...previous, otp: "" }));
              setFormError("");
            }}
            className={`${otpInputClass} ${
              errors.otp
                ? "border-[color:var(--wa-danger)]"
                : "border-[color:var(--wa-auth-input-border)]"
            }`}
          />

          {errors.otp && (
            <p className="mt-1.5 text-[12.5px] text-[color:var(--wa-danger)]">
              {errors.otp}
            </p>
          )}

          <div className="mt-5">
            <AuthInput
              id="reset-new-password"
              label="New password"
              name="newPassword"
              type="password"
              icon={Lock}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setErrors((previous) => ({ ...previous, newPassword: "" }));
                setFormError("");
              }}
              error={errors.newPassword}
              autoComplete="new-password"
            />

            <AuthInput
              id="reset-confirm-password"
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              icon={ShieldCheck}
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((previous) => ({ ...previous, confirmPassword: "" }));
                setFormError("");
              }}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={isBusy} className={primaryButton}>
            {isBusy ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Reset password"
            )}
          </button>

          <div className="mt-6 border-t border-[color:var(--wa-border)] pt-5 text-center text-[12.5px] leading-5 text-[color:var(--wa-text-secondary)]">
            <p className="mb-1.5">Didn&apos;t get the email? Check your spam folder.</p>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isBusy}
              className="text-[13.5px] font-semibold text-[color:var(--wa-accent)] hover:text-[color:var(--wa-accent-hover)] hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>

            <span className="mx-2">·</span>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setErrors({});
                setFormError("");
                setNotice("");
              }}
              className="text-[13.5px] font-semibold text-[color:var(--wa-accent)] hover:text-[color:var(--wa-accent-hover)] hover:underline underline-offset-4"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      <p className="mt-7 border-t border-[color:var(--wa-border)] pt-5 text-center text-[14px]">
        <Link to="/login" className={`${linkClass} inline-flex items-center gap-1.5`}>
          <ArrowLeft size={15} />
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}