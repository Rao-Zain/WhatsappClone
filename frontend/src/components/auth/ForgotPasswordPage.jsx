import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, RefreshCw } from "lucide-react";

import api from "../../../lib/api";
import AuthHeader from "./AuthHeader";
import AuthInput from "./AuthInput";

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

  const primaryButton =
    "mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#02906f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#f0f2f5] font-sans text-[#111b21] antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[222px] bg-[#00a884] lg:block"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-full flex-col">
        <AuthHeader />

        <main className="mx-auto w-full max-w-[520px] flex-1 px-4 py-6 sm:px-6 sm:py-10">
          <section className="w-full rounded-2xl border border-[#e9edef] bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8 sm:shadow-md">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-[#008f69]">
                <KeyRound size={22} />
              </span>
              <h1 className="text-xl font-semibold sm:text-2xl">
                {step === "email" ? "Forgot your password?" : "Choose a new password"}
              </h1>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-[#fde8e8] px-4 py-3 text-sm text-[#bc1c1c] shadow-xs"
              >
                {formError}
              </div>
            )}

            {step === "email" ? (
              <form onSubmit={handleSendCode} noValidate>
                <p className="mb-5 text-sm leading-6 text-[#667781]">
                  Enter the email address of your account. We will send you a
                  6-digit code to reset your password.
                </p>

                <AuthInput
                  id="forgot-email"
                  label="Email address"
                  name="email"
                  type="email"
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
                      <RefreshCw size={17} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset code"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleReset} noValidate>
                {notice && (
                  <div
                    role="status"
                    className="mb-4 flex items-start gap-2 rounded-xl border border-[#b7e4c7] bg-[#d9fdd3] px-4 py-3 text-sm text-[#166534]"
                  >
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                <p className="mb-4 text-sm leading-6 text-[#667781]">
                  Code sent to{" "}
                  <span className="break-all font-semibold text-[#111b21]">{email.trim()}</span>
                </p>

                <label
                  htmlFor="reset-otp"
                  className="mb-1.5 block text-[13px] font-medium"
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
                  className={`mb-1 w-full rounded-xl border bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none transition placeholder:text-[#c5cbd0] focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 disabled:bg-[#f0f2f5] sm:text-2xl ${
                    errors.otp ? "border-red-400" : "border-[#d1d7db]"
                  }`}
                />

                {errors.otp && (
                  <p className="mb-3 text-xs text-red-600">{errors.otp}</p>
                )}

                <div className="mt-4">
                  <AuthInput
                    id="reset-new-password"
                    label="New password"
                    name="newPassword"
                    type="password"
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
                      <RefreshCw size={17} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </button>

                <div className="mt-5 text-center text-xs leading-5 text-[#667781]">
                  <p className="mb-1">Didn't get the email? Check your spam folder.</p>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isBusy}
                    className="text-sm font-medium text-[#008f69] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
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
                    className="text-sm font-medium text-[#008f69] hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="font-medium text-[#008f69] hover:underline">
                Back to log in
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}