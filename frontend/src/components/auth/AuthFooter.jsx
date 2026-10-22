
import { LockKeyhole } from "lucide-react";

export default function AuthFooter({ mode, onSwitchMode }) {
  const isSignup = mode === "signup";

  return (
    <>
      <div className="mt-7 border-t border-[#e9edef] pt-5 text-center text-[13px] sm:mt-8">
        {isSignup ? (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => onSwitchMode("login")}
              className="font-medium underline decoration-[#00a884] decoration-2 underline-offset-4 hover:text-[#008f70]"
            >
              Log in
            </button>
          </p>
        ) : (
          <p>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onSwitchMode("signup")}
              className="font-medium underline decoration-[#00a884] decoration-2 underline-offset-4 hover:text-[#008f70]"
            >
              Get started
            </button>
          </p>
        )}
      </div>

      <footer className="mt-7 flex flex-col items-center gap-4 text-center">
        <p className="flex items-center gap-2 text-[13px] text-[#667781]">
          <LockKeyhole size={15} />
          Your personal messages are end-to-end encrypted
        </p>

        <a
          href="#terms"
          onClick={(event) => event.preventDefault()}
          className="text-[11px] text-[#667781] hover:underline"
        >
          Terms &amp; Privacy Policy
        </a>
      </footer>
    </>
  );
}
