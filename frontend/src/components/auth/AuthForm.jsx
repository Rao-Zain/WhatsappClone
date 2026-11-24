import { ArrowRight, Lock, Mail, Phone, RefreshCw, User } from "lucide-react";
import { Link } from "react-router-dom";
import AuthInput from "./AuthInput";
import { primaryButtonClass } from "./authStyles";

export default function AuthForm({
  mode,
  formData,
  errors,
  onChange,
  onSubmit,
  stayLoggedIn,
  setStayLoggedIn,
  isSubmitting = false,
}) {
  const isSignup = mode === "signup";

  return (
    <form onSubmit={onSubmit} noValidate>
      <AuthInput
        id="username"
        label="Username"
        name="username"
        icon={User}
        placeholder="Enter your username"
        value={formData.username}
        onChange={onChange}
        error={errors.username}
        autoComplete="username"
        disabled={isSubmitting}
      />

      {isSignup && (
        <>
          <AuthInput
            id="email"
            label="Email address"
            name="email"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={formData.email}
            onChange={onChange}
            error={errors.email}
            autoComplete="email"
            disabled={isSubmitting}
          />

          <AuthInput
            id="phone"
            label="Phone number"
            name="phone"
            type="tel"
            icon={Phone}
            placeholder="+92 300 1234567"
            value={formData.phone}
            onChange={onChange}
            error={errors.phone}
            autoComplete="tel"
            disabled={isSubmitting}
          />
        </>
      )}

      <AuthInput
        id="password"
        label="Password"
        name="password"
        type="password"
        icon={Lock}
        placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
        value={formData.password}
        onChange={onChange}
        error={errors.password}
        autoComplete={isSignup ? "new-password" : "current-password"}
        disabled={isSubmitting}
        labelAction={
          !isSignup && (
            <Link
              to="/forgot-password"
              className="text-[12.5px] font-semibold text-[color:var(--wa-accent)] transition hover:text-[color:var(--wa-accent-hover)] hover:underline underline-offset-4"
            >
              Forgot password?
            </Link>
          )
        }
      />

      {!isSignup && (
        <label className="mb-6 mt-1 flex cursor-pointer select-none items-center gap-2.5 text-[13.5px] text-[color:var(--wa-text-strong)]">
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(event) => setStayLoggedIn(event.target.checked)}
            className="h-[18px] w-[18px] rounded accent-[var(--wa-accent)]"
          />
          Keep me signed in on this browser
        </label>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`${primaryButtonClass} ${isSignup ? "mt-2" : ""}`}
      >
        {isSubmitting ? (
          <>
            <RefreshCw size={18} className="animate-spin" />
            {isSignup ? "Creating account..." : "Signing in..."}
          </>
        ) : (
          <>
            {isSignup ? "Create account" : "Log in"}
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-[color:var(--wa-text-secondary)]">
        <Lock size={12} />
        Secure sign-in
      </p>
    </form>
  );
}