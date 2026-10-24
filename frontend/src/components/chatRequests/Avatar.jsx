import { UserRound } from "lucide-react";

export default function Avatar({ user, size = 49 }) {
  const style = { width: size, height: size };

  return user?.profilePicture ? (
    <img
      src={user.profilePicture}
      alt=""
      style={style}
      className="shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-[var(--wa-avatar-neutral-bg)] text-[color:var(--wa-avatar-neutral-fg)]"
    >
      <UserRound size={Math.round(size / 2)} />
    </span>
  );
}