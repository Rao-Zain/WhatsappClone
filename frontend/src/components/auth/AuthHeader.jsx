
import { FaWhatsapp } from "react-icons/fa";

export default function AuthHeader() {
  return (
    <header className="flex h-[58px] items-center border-b border-[#e6ded3] px-5 sm:px-9">
      <button
        type="button"
        onClick={() => {
          window.location.href = "/login";
        }}
        className="flex items-center gap-1.5 text-[#00c853]"
        aria-label="WhatsApp home"
      >
        <FaWhatsapp
          size={30}
          className="shrink-0"
          aria-hidden="true"
        />

        <span className="text-[15px] font-semibold tracking-tight">
          WhatsApp
        </span>
      </button>
    </header>
  );
}
