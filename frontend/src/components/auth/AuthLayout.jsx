import { Lock, MessageSquareText, PhoneCall, ShieldCheck } from "lucide-react";
import HexaLogo from "./HexaLogo";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Real-time messaging",
    text: "Fast, reliable chats with reactions, replies and media.",
  },
  {
    icon: PhoneCall,
    title: "Voice & video calls",
    text: "Crystal-clear calls with the people who matter.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Secure sign-in and full control over who can reach you.",
  },
];

/* Soft hexagon pattern for the brand panel (shape only, color from theme) */
const HEX_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 34L0 84V66m56 0v18L28 100' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E\")";

function Wordmark({ className = "" }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      HexaChat
    </span>
  );
}

function BrandPanel() {
  return (
    <aside
      className="relative hidden overflow-hidden text-[color:var(--wa-auth-hero-fg)] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16"
      style={{
        background:
          "linear-gradient(145deg, var(--wa-auth-hero-from), var(--wa-auth-hero-to))",
      }}
    >
      {/* Hexagon pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: "var(--wa-auth-hero-pattern)",
          WebkitMaskImage: HEX_PATTERN,
          maskImage: HEX_PATTERN,
          WebkitMaskSize: "56px 100px",
          maskSize: "56px 100px",
        }}
      />
      {/* Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <HexaLogo size={42} />
        <Wordmark className="text-[22px]" />
      </div>

      <div className="relative max-w-[460px]">
        <h2 className="text-[34px] font-semibold leading-[1.15] tracking-tight xl:text-[40px]">
          Conversations that feel effortless.
        </h2>
        <p className="mt-4 text-[15px] leading-6 text-[color:var(--wa-auth-hero-fg-soft)]">
          Message, call and share moments with your people, all in one clean,
          fast and secure place.
        </p>

        <ul className="mt-9 space-y-5">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--wa-auth-hero-glass-border)] bg-[var(--wa-auth-hero-glass)] backdrop-blur-sm">
                <Icon size={20} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[13.5px] leading-5 text-[color:var(--wa-auth-hero-fg-soft)]">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex items-center gap-2 text-[12.5px] text-[color:var(--wa-auth-hero-fg-soft)]">
        <Lock size={13} />
        &copy; {new Date().getFullYear()} HexaChat. All rights reserved.
      </p>
    </aside>
  );
}

/* Page shell shared by Login, Signup and Forgot password.
   Desktop: brand panel on the left, form on the right.
   Mobile / tablet: compact brand header above the form card. */
export default function AuthLayout({ children, maxWidth = "max-w-[460px]" }) {
  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--wa-auth-page-bg)] font-sans text-[color:var(--wa-text-primary)] antialiased">
      <div className="flex min-h-full flex-col lg:grid lg:grid-cols-[minmax(420px,5fr)_6fr]">
        <BrandPanel />

        {/* Compact brand header (below lg) */}
        <header
          className="flex items-center gap-2.5 px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] text-[color:var(--wa-auth-hero-fg)] sm:px-8 lg:hidden"
          style={{
            background:
              "linear-gradient(135deg, var(--wa-auth-hero-from), var(--wa-auth-hero-to))",
          }}
        >
          <HexaLogo size={34} />
          <Wordmark className="text-[19px]" />
        </header>

        <main className="relative -mt-10 flex flex-1 items-start justify-center px-4 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:py-12">
          <div className={`w-full ${maxWidth}`}>
            <section className="rounded-3xl border border-[color:var(--wa-auth-card-border)] bg-[var(--wa-auth-card-bg)] p-6 shadow-[0_18px_50px_-18px_var(--c-shadow)] sm:p-9">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* Title block used at the top of every auth card */
export function AuthCardHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="mb-7">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--wa-chip-active-bg)] text-[color:var(--wa-accent)]">
          <Icon size={24} />
        </span>
      )}
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[color:var(--wa-text-primary)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[14.5px] leading-6 text-[color:var(--wa-text-secondary)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}