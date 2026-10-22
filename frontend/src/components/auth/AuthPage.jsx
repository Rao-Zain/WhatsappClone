
import { useState } from "react";
import AuthHeader from "./AuthHeader";
import DownloadBanner from "./DownloadBanner";
import AuthInstructions from "./AuthInstructions";
import AuthForm from "./AuthForm";
import AuthFooter from "./AuthFooter";
import { Check } from "lucide-react";

const INITIAL_FORM = {
  username: "",
  email: "",
  phone: "",
  password: "",
};

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const isSignup = mode === "signup";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setFormData({ ...INITIAL_FORM });
    setErrors({});
    setSubmitted(false);
  };

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

    setSubmitted(false);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.username.trim()) {
      nextErrors.username = "Username is required.";
    }

    if (isSignup) {
      if (!formData.email.trim()) {
        nextErrors.email = "Email is required.";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
      ) {
        nextErrors.email = "Enter a valid email address.";
      }

      if (!formData.phone.trim()) {
        nextErrors.phone = "Phone number is required.";
      }

      if (formData.password.length < 8) {
        nextErrors.password =
          "Password must contain at least 8 characters.";
      }
    } else if (!formData.password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    // UI preview only. Connect your API here later.
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fcf5eb] font-sans text-[#111b21]">
      <AuthHeader />

      <main className="mx-auto flex w-full max-w-[900px] flex-col px-4 pb-8 pt-8 sm:px-6 sm:pt-[50px]">
        <DownloadBanner />

        <section className="rounded-[24px] border border-[#202c33] bg-white px-5 py-7 shadow-sm sm:px-[45px] sm:py-[40px]">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_300px] md:gap-9">
            <AuthInstructions mode={mode} />

            <div className="min-w-0">
              {submitted ? (
                <div
                  role="status"
                  className="flex min-h-[280px] flex-col items-center justify-center text-center"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#d9fdd3] text-[#008f59]">
                    <Check size={29} />
                  </div>

                  <h2 className="mb-2 text-lg font-semibold">
                    {isSignup
                      ? "Signup form completed"
                      : "Login form completed"}
                  </h2>

                  <p className="mb-5 text-sm leading-6 text-[#667781]">
                    This is only a design preview. No account has
                    been created and no login has been performed.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="rounded-full bg-[#25d366] px-6 py-2.5 text-sm font-medium hover:bg-[#20c45e]"
                  >
                    Back to form
                  </button>
                </div>
              ) : (
                <AuthForm
                  mode={mode}
                  formData={formData}
                  errors={errors}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                  stayLoggedIn={stayLoggedIn}
                  setStayLoggedIn={setStayLoggedIn}
                />
              )}
            </div>
          </div>
        </section>

        <AuthFooter mode={mode} onSwitchMode={switchMode} />
      </main>
    </div>
  );
}
