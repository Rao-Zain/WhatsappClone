import { useRef, useState } from "react";
import { ArrowLeft, Smile } from "lucide-react";
import AvatarButton from "./AvatarButton";
import CropModal from "./CropModal";
import { EditableField, PhoneField, UsernameField } from "./ProfileFields";
import { SCROLL } from "./constants";

export default function EditProfileView({
  info,
  avatar,
  avatarError,
  onBack,
  onSaveAvatar,
  onUpdate,
  onUsernameClick,
}) {
  const fileRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);

  const handlePick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file?.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-[var(--wa-sidebar-bg)] text-[color:var(--wa-text-primary)] ${SCROLL}`}
    >
      <header className="flex h-[62px] items-center gap-4 pl-2.5 sm:pl-[10px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-10 place-items-center rounded-full text-[color:var(--wa-header-icon)] hover:bg-[var(--wa-hover)]"
        >
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <h1 className="text-base font-normal leading-6">Edit profile</h1>
      </header>

      <div className="flex flex-col items-center px-6 pt-8 sm:pt-[42px]">
        <AvatarButton
          avatar={avatar}
          label="Change profile photo"
          onClick={() => fileRef.current?.click()}
          showHint
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handlePick}
          className="hidden"
        />

        {avatarError && (
          <p role="alert" className="mt-3 text-center text-sm text-[color:var(--wa-danger)]">
            {avatarError}
          </p>
        )}
      </div>

      <div className="px-5 pt-10 sm:px-[30px] sm:pt-[61px]">
        <EditableField
          label="About"
          value={info.about}
          onSave={(about) => onUpdate({ about })}
          maxLength={139}
          className="pb-10 sm:pb-[58px]"
          icon={<Smile size={24} strokeWidth={1.8} className="shrink-0 text-[color:var(--wa-accent)]" />}
        />
        <EditableField
          label="Name"
          value={info.name}
          onSave={(name) => onUpdate({ name })}
          maxLength={25}
          className="pb-9 sm:pb-[52px]"
        />
        <UsernameField
          username={info.username}
          pin={info.pin}
          onSave={(username) => onUpdate({ username })}
          className="pb-9 sm:pb-[52px]"
        />
        <PhoneField phone={info.phone} className="pb-10" />
      </div>

      {cropSrc && (
        <CropModal
          key={cropSrc}
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onUploadAnother={() => fileRef.current?.click()}
          onConfirm={async (dataUrl) => {
            const saved = await onSaveAvatar(dataUrl);

            if (saved) {
              setCropSrc(null);
            }
          }}
        />
      )}
    </div>
  );
}