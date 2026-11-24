/* HexaChat mark: a hexagon holding a chat bubble.
   tone="light" -> for dark / gradient backgrounds (white mark)
   tone="brand" -> for light surfaces (brand-colored mark) */
export default function HexaLogo({ size = 40, tone = "light", className = "" }) {
  const isLight = tone === "light";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M24 2.5 42.6 13.25v21.5L24 45.5 5.4 34.75v-21.5L24 2.5Z"
        fill={isLight ? "rgba(255,255,255,0.16)" : "var(--wa-accent)"}
        stroke={isLight ? "#ffffff" : "var(--wa-accent)"}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M17 15.5h14a4.5 4.5 0 0 1 4.5 4.5v6a4.5 4.5 0 0 1-4.5 4.5h-6.2l-5.1 4.2a.6.6 0 0 1-1-.5v-3.8A4.5 4.5 0 0 1 12.5 26v-6A4.5 4.5 0 0 1 17 15.5Z"
        fill="#ffffff"
      />
      <circle cx="19" cy="23" r="1.7" fill={isLight ? "var(--wa-auth-hero-to)" : "var(--wa-accent)"} />
      <circle cx="24" cy="23" r="1.7" fill={isLight ? "var(--wa-auth-hero-to)" : "var(--wa-accent)"} />
      <circle cx="29" cy="23" r="1.7" fill={isLight ? "var(--wa-auth-hero-to)" : "var(--wa-accent)"} />
    </svg>
  );
}