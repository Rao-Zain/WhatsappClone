import { Camera, UserRound } from "lucide-react";

export default function AvatarButton({
  avatar,
  onClick,
  label,
  showHint = false,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9edef] ${className}`}
    >
      {avatar ? (
        <img
          src={avatar}
          alt="Your profile"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <UserRound size={66} strokeWidth={1.4} className="text-[#8696a0]" />
      )}

      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-[#111b21]/50 px-5 text-center text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Camera size={22} />
        {showHint && (
          <span className="text-[11px] font-medium leading-[14px]">
            CHANGE PROFILE PHOTO
          </span>
        )}
      </span>
    </button>
  );
}