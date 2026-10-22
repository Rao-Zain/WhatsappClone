import { useEffect, useState } from "react";
import NavigationRail from "../layout/NavigationRail";
import { DEFAULT_PROFILE, FONT } from "./constants";
import SettingsMenuView from "./SettingsMenuView";
import EditProfileView from "./EditProfileView";
import SettingsWorkspace from "./SettingsWorkspace";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../../lib/api";
import { getSocket } from "../../../lib/socket";

export default function SettingsPage({
  onLogout,
  profileImage,
  onProfileImageChange,
  profile,
  onProfileChange,
}) {
  const { logout, user, setUser } = useAuth();
  const [view, setView] = useState("menu"); // "menu" | "profile"
  const [avatar, setAvatar] = useState(
    user?.profilePicture || profileImage || null
  );

  const [info, setInfo] = useState({
    ...DEFAULT_PROFILE,
    ...profile,
    name: user?.name ?? profile?.name ?? DEFAULT_PROFILE.name ?? "",
    username: user?.username ?? profile?.username ?? DEFAULT_PROFILE.username,
    about: user?.about ?? profile?.about ?? DEFAULT_PROFILE.about,
  });

  const navigate = useNavigate();

  const handleLogout = () => {
    // Go offline for other people before the session is cleared.
    try {
      getSocket().disconnect();
    } catch {
      /* socket was never created */
    }

    logout();
    navigate("/login", { replace: true });
  };

  // Follow the parent if it does change the picture
  useEffect(() => {
    setAvatar(user?.profilePicture || profileImage || null);
  }, [user?.profilePicture, profileImage]);

  useEffect(() => {
    if (!user) return;

    setInfo((previous) => ({
      ...previous,
      name: user.name ?? previous.name,
      username: user.username ?? previous.username,
      about: user.about ?? previous.about,
    }));
  }, [user?.name, user?.username, user?.about]);

  const [avatarError, setAvatarError] = useState("");

  const saveAvatar = async (dataUrl) => {
    try {
      setAvatarError("");

      const response = await api.patch("/auth/profile-picture", {
        profilePicture: dataUrl,
      });

      const updatedUser = response.data.user;

      // Update shared authentication state immediately.
      setUser((currentUser) => ({
        ...currentUser,
        ...updatedUser,
      }));

      // Keep any existing cached user data synchronized.
      for (const storage of [localStorage, sessionStorage]) {
        const storedUser = storage.getItem("user");

        if (storedUser) {
          storage.setItem(
            "user",
            JSON.stringify({
              ...JSON.parse(storedUser),
              ...updatedUser,
            })
          );
        }
      }

      setAvatar(updatedUser.profilePicture);
      onProfileImageChange?.(updatedUser.profilePicture);

      return true;
    } catch (error) {
      setAvatarError(
        error.response?.data?.message ||
          "Unable to save your profile picture. Please try again."
      );

      return false;
    }
  };

  const updateProfile = async (patch) => {
    try {
      const { data } = await api.patch("/auth/profile", patch);
      const updatedUser = data.user;

      // Update the global user only after the server confirms success
      setUser((prev) => ({ ...prev, ...updatedUser }));

      // Update the displayed profile only after successful saving
      setInfo((prev) => ({
        ...prev,
        ...updatedUser,
      }));

      return true;
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not save your profile. Please try again."
      );

      return false;
    }
  };

  return (
    <div
      className={`flex h-dvh min-h-0 w-full overflow-hidden bg-[var(--wa-rail-bg)] text-[color:var(--wa-text-primary)] ${FONT}`}
    >
      <NavigationRail profileImage={avatar} />

      {/* Phone: full width. Tablet: 430. Laptop and up: 575. */}
      <div className="flex h-full w-[575px] min-w-0 shrink-0 grow-0 overflow-hidden border-r border-[color:var(--wa-border)] bg-[var(--wa-sidebar-bg)] max-[1100px]:w-[430px] max-[700px]:w-auto max-[700px]:flex-1">
        <aside className="h-full w-full min-w-0 flex-1 overflow-hidden bg-[var(--wa-sidebar-bg)]">
          {view === "menu" ? (
            <SettingsMenuView
              info={info}
              avatar={avatar}
              onOpenProfile={() => setView("profile")}
              onLogout={handleLogout}
              onBack={() => navigate("/")}
            />
          ) : (
            <EditProfileView
              info={info}
              avatar={avatar}
              avatarError={avatarError}
              onBack={() => setView("menu")}
              onSaveAvatar={saveAvatar}
              onUpdate={updateProfile}
            />
          )}
        </aside>
      </div>

      <SettingsWorkspace onGoToCalls={() => navigate("/calls")} />
    </div>
  );
}