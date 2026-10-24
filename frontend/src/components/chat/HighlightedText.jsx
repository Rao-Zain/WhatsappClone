import { escapeRegExp } from "./searchUtils";

// Shows `text` with every match of `query` highlighted (case-insensitive).
export default function HighlightedText({ text, query }) {
  const needle = (query || "").trim();

  if (!needle) return text;

  // Splitting on a capturing group puts every match at an odd position.
  const parts = String(text).split(new RegExp(`(${escapeRegExp(needle)})`, "gi"));

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded-sm bg-[#fde047] px-0.5 text-[#1f2937]">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
