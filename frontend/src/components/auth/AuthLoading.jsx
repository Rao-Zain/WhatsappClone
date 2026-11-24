import { useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import HexaLogo from "./HexaLogo";

export default function AuthLoading({ onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <main className="hexa-loading-screen">
      <section
        className="hexa-loading-content"
        aria-live="polite"
        aria-label="Loading your chats"
      >
        <div className="hexa-loading-logo">
          <HexaLogo size={64} tone="brand" />
        </div>

        <p className="hexa-loading-brand">HexaChat</p>
        <p className="hexa-loading-title">Loading your chats</p>

        <div
          className="hexa-progress-track"
          role="progressbar"
          aria-label="Loading chats"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="hexa-progress-bar" />
        </div>

        <p className="hexa-loading-note">
          <LockKeyhole size={13} strokeWidth={1.8} />
          <span>Secure connection</span>
        </p>
      </section>

      <button type="button" onClick={handleLogout} className="hexa-logout-button">
        Cancel
      </button>

      <style>{`
        .hexa-loading-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: var(--wa-auth-page-bg);
          color: var(--wa-text-primary);
          font-family: var(--wa-font);
        }
        .hexa-loading-content {
          position: absolute;
          top: 45%;
          left: 50%;
          display: flex;
          width: min(320px, calc(100% - 40px));
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -50%);
        }
        .hexa-loading-logo { margin-bottom: 14px; animation: hexa-pulse 1.8s ease-in-out infinite; }
        .hexa-loading-brand { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
        .hexa-loading-title { margin: 4px 0 0; color: var(--wa-text-secondary); font-size: 15px; line-height: 24px; }
        .hexa-progress-track {
          position: relative; width: 190px; height: 4px; margin-top: 24px;
          overflow: hidden; border-radius: 999px; background: var(--wa-progress-track);
        }
        .hexa-progress-bar {
          position: absolute; inset: 0; border-radius: inherit; background: var(--wa-accent);
          transform: scaleX(0.15); transform-origin: left center;
          animation: hexa-loading-progress 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .hexa-loading-note {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin: 26px 0 0; color: var(--wa-text-secondary); font-size: 12px; line-height: 18px;
        }
        .hexa-logout-button {
          position: absolute; bottom: max(100px, 11.1vh); left: 50%;
          min-width: 100px; height: 42px; padding: 0 22px; transform: translateX(-50%);
          border: 1px solid var(--wa-border); border-radius: 999px;
          background: var(--wa-auth-card-bg); color: var(--wa-text-strong);
          font-size: 14px; font-weight: 500; cursor: pointer; transition: background 150ms ease;
        }
        .hexa-logout-button:hover { background: var(--wa-hover); }
        @keyframes hexa-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes hexa-loading-progress {
          0% { transform: translateX(-100%) scaleX(0.45); }
          50% { transform: translateX(55%) scaleX(0.9); }
          100% { transform: translateX(220%) scaleX(0.45); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hexa-progress-bar { animation: none; transform: scaleX(0.7); }
          .hexa-loading-logo { animation: none; }
        }
      `}</style>
    </main>
  );
}