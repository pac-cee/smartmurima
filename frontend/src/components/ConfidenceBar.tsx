import { cn } from '@/lib/utils';

/** A green-ramp confidence meter. Higher confidence reads as a fuller, deeper bar. */
export function ConfidenceBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const tone = pct >= 80 ? 'bg-green-600' : pct >= 60 ? 'bg-green-500' : 'bg-green-400';
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">{label}</span>
          <span className="tabular font-semibold text-ink-900">{pct}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-green-100"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Confidence'}
      >
        <div
          className={cn('h-full rounded-pill transition-[width] duration-700 ease-out', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
