
import { ChevronRight, Info, LockKeyhole } from "lucide-react";
import AuthInput from "./AuthInput";

export default function AuthForm({
  mode,
  formData,
  errors,
  onChange,
  onSubmit,
  stayLoggedIn,
  setStayLoggedIn,
}) {
  const isSignup = mode === "signup";

  return (
    <form onSubmit={onSubmit} noValidate>
      <AuthInput
        id="username"
        label="Username"
        name="username"
        placeholder="Enter your username"
        value={formData.username}
        onChange={onChange}
        error={errors.username}
        autoComplete="username"
      />

      {isSignup && (
        <>
          <AuthInput
            id="email"
            label="Email address"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={onChange}
            error={errors.email}
            autoComplete="email"
          />

          <AuthInput
            id="phone"
            label="Phone number"
            name="phone"
            type="tel"
            placeholder="+92 300 1234567"
            value={formData.phone}
            onChange={onChange}
            error={errors.phone}
            autoComplete="tel"
          />
        </>
      )}

      <AuthInput
        id="password"
        label="Password"
        name="password"
        type="password"
        placeholder={
          isSignup ? "At least 8 characters" : "Enter your password"
        }
        value={formData.password}
        onChange={onChange}
        error={errors.password}
        autoComplete={isSignup ? "new-password" : "current-password"}
      />

      {!isSignup && (
        <label className="mb-5 flex cursor-pointer items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(event) => setStayLoggedIn(event.target.checked)}
            className="h-4 w-4 accent-[#00a884]"
          />

          Stay logged in on this browser

          <Info size={13} className="text-[#667781]" />
        </label>
      )}

      <button
        type="submit"
        className="mt-3 flex w-full items-center text-white justify-center gap-2 rounded-full border  bg-[#25d366] px-5 py-3 text-[14px] font-semibold transition hover:bg-[#20c45e] active:scale-[0.99]"
      >
        {isSignup ? "Create account" : "Log in"}
        <ChevronRight size={17} />
      </button>

      <p className="mt-3 text-center text-[11px] leading-5 text-[#667781]">
        <LockKeyhole
          size={12}
          className="mr-1 inline-block align-[-2px]"
        />
        Secure account access
      </p>
    </form>
  );
}
