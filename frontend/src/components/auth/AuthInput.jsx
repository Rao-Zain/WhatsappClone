
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function AuthInput({
  id,
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-medium"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#202c33] outline-none transition placeholder:text-[#8696a0] focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10 ${
            error ? "border-red-400" : "border-[#d1d7db]"
          } ${isPassword ? "pr-11" : ""}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((previous) => !previous)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667781] hover:text-[#111b21]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
