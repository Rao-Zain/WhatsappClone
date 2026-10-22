
import { Download, Phone } from "lucide-react";

export default function DownloadBanner() {
  return (
    <section className="mb-[14px] hidden min-h-[130px] items-center gap-5 rounded-[24px] border border-[#202c33] bg-white px-8 py-5 sm:flex">
      <div className="flex h-[78px] w-[135px] shrink-0 items-center justify-center">
        <div className="relative flex h-[65px] w-[110px] items-center justify-center rounded-md border-[1.5px] border-[#202c33] bg-[#fcf5eb]">
          <div className="absolute -bottom-2 left-[-9px] h-2 w-[116px] rounded-b-md border border-[#202c33] bg-[#d9fdd3]" />

          <div className="absolute left-3 top-[-3px] flex h-[64px] w-[32px] flex-col items-center rounded-sm border border-[#202c33] bg-[#25d366] pt-1 text-[7px]">
            <span>×</span>
            <span className="mt-1 text-[12px]">☰</span>
          </div>

          <Phone
            className="ml-7 text-[#008f59]"
            size={27}
            fill="#25d366"
            strokeWidth={1.5}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="mb-1 text-[16px] font-semibold">
          Download WhatsApp for Windows
        </h2>

        <p className="max-w-[420px] text-[14px] leading-5 text-[#202c33]">
          Get extra features like voice and video calling,
          screen sharing and more.
        </p>
      </div>

      <button
        type="button"
        className="flex shrink-0 items-center text-white gap-3 rounded-full border border-white/50 bg-[#25d366] px-7 py-3 text-sm font-bold transition hover:bg-[#20c45e]"
      >
        Download
        <Download size={14} />
      </button>
    </section>
  );
}
