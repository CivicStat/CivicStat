interface VoteBarProps {
  voor: number;
  tegen: number;
  afwezig?: number;
  height?: number;
  showLabels?: boolean;
}

export default function VoteBar({
  voor,
  tegen,
  afwezig = 0,
  height = 8,
  showLabels = false,
}: VoteBarProps) {
  const total = voor + tegen + afwezig || 1;
  const pVoor = (voor / total) * 100;
  const pTegen = (tegen / total) * 100;

  return (
    <div className="w-full">
      <div
        className="flex overflow-hidden bg-bar-afwezig"
        style={{ height, borderRadius: height / 2 }}
      >
        <div
          className="bg-bar-voor transition-[width] duration-500 ease-out"
          style={{ width: `${pVoor}%` }}
        />
        <div
          className="bg-bar-tegen transition-[width] duration-500 ease-out"
          style={{ width: `${pTegen}%` }}
        />
      </div>
      {showLabels && (
        <div className="mt-1.5 flex justify-between text-xs text-text-secondary">
          <span className="font-semibold text-ink">Voor: {voor}</span>
          <span>
            Tegen: {tegen}
            {afwezig > 0 ? ` · Afwezig: ${afwezig}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
