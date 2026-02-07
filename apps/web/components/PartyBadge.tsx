import { getPartyColor } from "../lib/utils";

interface PartyBadgeProps {
  abbreviation: string;
  colorNeutral?: string | null;
  size?: "sm" | "md";
}

export default function PartyBadge({
  abbreviation,
  colorNeutral,
  size = "sm",
}: PartyBadgeProps) {
  const color = getPartyColor(abbreviation, colorNeutral);
  const dotSize = size === "sm" ? 8 : 10;

  return (
    <span className={`badge ${size === "md" ? "px-2.5 py-1 text-[13px]" : ""}`}>
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: dotSize, height: dotSize, backgroundColor: color }}
      />
      {abbreviation}
    </span>
  );
}
