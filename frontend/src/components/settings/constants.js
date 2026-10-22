import {
  UserRound,
  KeyRound,
  LockKeyhole,
  Bot,
  MessageSquareText,
  Bell,
  Keyboard,
  CircleHelp,
} from "lucide-react";

export const FONT =
  "[font-family:'Segoe_UI','Helvetica_Neue',Helvetica,Arial,sans-serif]";

export const SCROLL =
  "[scrollbar-color:#c7c7c7_transparent] [scrollbar-width:thin]";

export const DEFAULT_PROFILE = {
  name: "Zain@Rao",
  about: "Share a thought",
  username: "ZainiRao",
  pin: "1236",
  phone: "+92 326 9787057",
};

export const SETTINGS_ITEMS = [
  { id: "profile", label: "Profile", description: "Name, profile picture, username", icon: UserRound },
  { id: "account", label: "Account", description: "Security notifications, account info", icon: KeyRound },
  { id: "privacy", label: "Privacy", description: "Blocked contacts, disappearing messages", icon: LockKeyhole },
  { id: "agents", label: "Agents", description: "Agents connected to this account", icon: Bot },
  { id: "chats", label: "Chats", description: "Theme, wallpaper, chat settings", icon: MessageSquareText },
  { id: "notifications", label: "Notifications", description: "Messages, groups, sounds", icon: Bell },
  { id: "shortcuts", label: "Keyboard shortcuts", description: "Quick actions", icon: Keyboard },
  { id: "help", label: "Help and feedback", description: "Help center, contact us, privacy policy", icon: CircleHelp },
];