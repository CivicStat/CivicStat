interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const isAangenomen = status === "Aangenomen";
  const sizeClasses = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide border border-border whitespace-nowrap ${sizeClasses} ${
        isAangenomen
          ? "bg-surface-sub text-ink"
          : "bg-mist text-text-secondary"
      }`}
    >
      {isAangenomen ? (
        <svg width={size === "sm" ? 10 : 12} height={size === "sm" ? 10 : 12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width={size === "sm" ? 10 : 12} height={size === "sm" ? 10 : 12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {status}
    </span>
  );
}
