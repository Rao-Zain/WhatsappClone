import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";

import api from "../../../lib/api";
import { useAuth } from "../../context/AuthContext";

import AuthHeader from "./AuthHeader";
import DownloadBanner from "./DownloadBanner";
import AuthInstructions from "./AuthInstructions";
import AuthForm from "./AuthForm";
import AuthFooter from "./AuthFooter";

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
    <div className="relative h-full w-full overflow-y-auto bg-[#f0f2f5] font-sans text-[#111b21] antialiased">
      {/* WhatsApp desktop top green banner */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[222px] bg-[#00a884] lg:block"
        aria-hidden="true"
      />

      {/* Page Content wrapper: regular document flow with vertical padding */}
      <div className="relative z-10 flex  flex-col">
        <AuthHeader />

        <main className="mx-auto w-full max-w-[1020px] flex-1 px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <DownloadBanner />

          {/* Main Card */}
          <section className="mt-3 w-full rounded-2xl border border-[#e9edef] bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8 sm:shadow-md lg:p-12">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_minmax(320px,380px)] lg:gap-12">
              {/* Left Column: Instructions */}
              <div className="border-b border-[#e9edef] pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <AuthInstructions mode="signup" />
              </div>

              {/* Right Column: Form or OTP */}
              <div className="w-full min-w-0">
                {formError && (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl border border-red-200 bg-[#fde8e8] px-4 py-3 text-sm text-[#bc1c1c]"
                  >
                    {formError}
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    className="mb-4 rounded-xl border border-[#b7e4c7] bg-[#d9fdd3] px-4 py-3 text-sm text-[#166534]"
                  >
                    {successMessage}
                  </div>
                )}

                {!verificationStep ? (
                  <>
                    {isSubmitting && (
                      <p
                        className="mb-3 text-xs sm:text-sm text-[#667781]"
                        role="status"
                      >
                        Creating your account and sending the verification code...
                      </p>
                    )}

                    <AuthForm
                      mode="signup"
                      formData={formData}
                      errors={errors}
                      onChange={handleChange}
                      onSubmit={handleSubmit}
                      stayLoggedIn={false}
                      setStayLoggedIn={() => {}}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                    <button
                      type="button"
                      onClick={returnToSignup}
                      className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#54656f] transition-colors hover:text-[#008f69]"
                    >
                      <ArrowLeft size={16} />
                      Back to signup
                    </button>

                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#d9fdd3] text-[#00a884] sm:h-14 sm:w-14">
                      <Mail size={24} className="sm:size-[26px]" />
                    </div>

                    <h2 className="mb-2 text-lg font-bold sm:text-xl text-[#111b21]">
                      Verify your email
                    </h2>

                    <p className="mb-6 text-sm leading-relaxed text-[#667781]">
                      We've sent a 6-digit verification code to:
                      <span className="mt-1 block break-all font-semibold text-[#111b21]">
                        {verifiedEmail}
                      </span>
                    </p>

                    <form
                      onSubmit={handleVerifyOtp}
                      noValidate
                      className="w-full"
                    >
                      <label
                        htmlFor="signup-otp"
                        className="mb-2 block text-left text-xs sm:text-sm font-medium text-[#111b21]"
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
                          setOtp(
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 6)
                          );
                          setFormError("");
                        }}
                        disabled={isVerifying}
                        className="w-full rounded-xl border border-[#d1d7db] bg-white px-3 py-3 text-center text-xl sm:text-2xl tracking-[0.35em] sm:tracking-[0.45em] font-mono outline-none transition placeholder:text-[#c5cbd0] focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 disabled:bg-[#f0f2f5]"
                      />

                      <button
                        type="submit"
                        disabled={isVerifying || otp.length !== 6}
                        className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#02906f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw
                              size={17}
                              className="animate-spin text-white"
                            />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={17} />
                            Verify email
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 w-full text-center">
                      <p className="mb-2 text-xs leading-5 text-[#667781]">
                        Didn't receive the email? Check your spam folder
                        or request another code.
                      </p>

                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isResending || isVerifying}
                        className="text-xs sm:text-sm font-medium text-[#008f69] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isResending
                          ? "Sending new code..."
                          : "Resend verification code"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {!verificationStep && (
            <div className="mt-6 w-full pb-8">
              <AuthFooter
                mode="signup"
                onSwitchMode={(mode) => {
                  if (mode === "login") {
                    navigate("/login");
                  }
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}