
import { useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";

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
    <main className="whatsapp-loading-screen">
      {/* Center loading content */}
      <section
        className="whatsapp-loading-content"
        aria-live="polite"
        aria-label="Loading your chats"
      >
        {/* WhatsApp-style outline icon */}
        <svg
          className="whatsapp-loading-logo"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M8 37.5L10.7 29.3C8.9 26.5 8 23.3 8 20
               C8 10.9 15.4 3.5 24.5 3.5
               C33.6 3.5 41 10.9 41 20
               C41 29.1 33.6 36.5 24.5 36.5
               C21.4 36.5 18.4 35.6 15.8 34L8 37.5Z"
            stroke="currentColor"
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 14.5C18.4 13.3 17.9 13.3 17.3 13.3
               H15.8C15 13.3 14.1 14.3 13.8 15.3
               C13.4 16.4 13.7 18.2 14.6 20
               C16.4 23.7 19.4 26.7 23.1 28.5
               C25 29.4 26.7 29.7 27.9 29.1
               C28.9 28.7 29.8 27.8 30 27
               C30.2 26.4 30.2 25.8 29.8 25.6
               L25.8 23.7C25.3 23.5 24.9 23.5 24.5 24
               L22.8 25.7C22.5 26 22.1 26 21.7 25.8
               C19.6 24.8 17.8 23.1 16.8 21
               C16.6 20.6 16.6 20.2 16.9 19.9
               L18.3 18.3C18.6 18 18.7 17.5 18.5 17.1
               L19 14.5Z"
            fill="currentColor"
            opacity="0.8"
          />
        </svg>

        <p className="whatsapp-loading-title">
          Loading your chats
        </p>

        {/* Animated green progress indicator */}
        <div
          className="whatsapp-progress-track"
          role="progressbar"
          aria-label="Loading chats"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="whatsapp-progress-bar" />
        </div>

        <p className="whatsapp-encryption">
          <LockKeyhole size={13} strokeWidth={1.8} />
          <span>End-to-end encrypted</span>
        </p>
      </section>

      {/* Bottom logout button */}
      <button
        type="button"
        onClick={handleLogout}
        className="whatsapp-logout-button"
      >
        Log out
      </button>

      <style>{`
        .whatsapp-loading-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: #f7f5f4;
          color: #111b21;
          font-family: Arial, Helvetica, sans-serif;
        }

        .whatsapp-loading-content {
          position: absolute;
          top: 45%;
          left: 50%;
          display: flex;
          width: min(320px, calc(100% - 40px));
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -50%);
        }

        .whatsapp-loading-logo {
          width: 48px;
          height: 48px;
          color: #dcdad9;
          margin-bottom: 16px;
        }

        .whatsapp-loading-title {
          margin: 0;
          color: #111b21;
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
        }

        .whatsapp-progress-track {
          position: relative;
          width: 186px;
          height: 4px;
          margin-top: 23px;
          overflow: hidden;
          border-radius: 999px;
          background: #e6e4e2;
        }

        .whatsapp-progress-bar {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          border-radius: inherit;
          background: #00a884;
          transform: scaleX(0.15);
          transform-origin: left center;
          animation: whatsapp-loading-progress 1.5s
            cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .whatsapp-encryption {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin: 28px 0 0;
          color: #667781;
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
        }

        .whatsapp-logout-button {
          position: absolute;
          bottom: max(100px, 11.1vh);
          left: 50%;
          min-width: 94px;
          height: 42px;
          padding: 0 20px;
          transform: translateX(-50%);
          border: 0;
          border-radius: 999px;
          background: #ffffff;
          color: #54656f;
          font-size: 14px;
          font-weight: 400;
          cursor: pointer;
          transition: background 150ms ease;
        }

        .whatsapp-logout-button:hover {
          background: #eae6e4;
        }

        @keyframes whatsapp-loading-progress {
          0% {
            transform: translateX(-100%) scaleX(0.45);
          }
          50% {
            transform: translateX(55%) scaleX(0.9);
          }
          100% {
            transform: translateX(220%) scaleX(0.45);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .whatsapp-progress-bar {
            animation: none;
            transform: scaleX(0.7);
          }
        }
      `}</style>
    </main>
  );
}
