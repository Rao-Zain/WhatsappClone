
import { ExternalLink, ShieldCheck } from "lucide-react";

export default function AuthInstructions({ mode }) {
  const isSignup = mode === "signup";

  const instructions = isSignup
    ? [
        "Choose a username for your account.",
        "Provide your email and phone number.",
        "Verify your email to complete registration.",
      ]
    : [
        "Enter your registered username.",
        "Enter your account password.",
        "Log in to continue to your messages.",
      ];

  return (
    <div className="flex flex-col">
      <h1 className="mb-3 text-[27px] font-normal tracking-[-0.5px] sm:text-[29px]">
        {isSignup ? "Create your account" : "Log in"}
      </h1>

      <p className="mb-6 max-w-[350px] text-[14px] leading-6 text-[#54656f]">
        {isSignup
          ? "Join the conversation. Create your account to get started."
          : "Enter your account details to continue to your messages."}
      </p>

      <div className="space-y-5">
        {instructions.map((instruction, index) => (
          <div key={instruction} className="flex items-start gap-3">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-[#8696a0] text-[13px]">
              {index + 1}
            </div>

            <p className="pt-0.5 text-[14px] leading-5 text-[#3b4a54]">
              {instruction}
            </p>
          </div>
        ))}
      </div>

      <a
        href="#help"
        onClick={(event) => event.preventDefault()}
        className="mt-5 inline-flex w-fit items-center gap-1 text-[14px] font-medium underline decoration-[#00a884] decoration-2 underline-offset-4 hover:text-[#008f70]"
      >
        Need help?
        <ExternalLink size={13} />
      </a>

      <div className="mt-7 hidden items-center gap-2 md:flex">
        <ShieldCheck size={19} className="text-[#008f59]" />

        <span className="text-[12px] text-[#667781]">
          Simple, secure account access
        </span>
      </div>
    </div>
  );
}
