import { linkClass } from "./authStyles";

export default function AuthFooter({ mode, onSwitchMode }) {
  const isSignup = mode === "signup";

  return (
    <div className="mt-7 border-t border-[color:var(--wa-border)] pt-5 text-center">
      <p className="text-[14px] text-[color:var(--wa-text-secondary)]">
        {isSignup ? "Already have an account?" : "New to HexaChat?"}{" "}
        <button
          type="button"
          onClick={() => onSwitchMode(isSignup ? "login" : "signup")}
          className={linkClass}
        >
          {isSignup ? "Log in" : "Create an account"}
        </button>
      </p>

      <a
        href="#terms"
        onClick={(event) => event.preventDefault()}
        className="mt-4 inline-block text-[12px] text-[color:var(--wa-text-secondary)] hover:underline"
      >
        Terms &amp; Privacy Policy
      </a>
    </div>
  );
}