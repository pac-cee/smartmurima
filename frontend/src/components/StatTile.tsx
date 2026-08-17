import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { CountUp } from '@/components/CountUp';
import { cn } from '@/lib/utils';

export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  decimals = 0,
  delta,
  deltaLabel,
  className,
}: {
  icon: LucideIcon;
  label: string;
  // `null`/`undefined`/non-finite (e.g. a field with no telemetry yet) renders
  // an em dash instead of NaN.
  value: number | null | undefined;
  unit?: string;
  decimals?: number;
  delta?: number;
  deltaLabel?: string;
  className?: string;
}) {
  const trend = delta === undefined ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const hasValue = typeof value === 'number' && Number.isFinite(value);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card border border-line bg-card p-5 shadow-sm transition-shadow duration-150 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-tile bg-green-50 text-green-700">
          <Icon className="size-5" />
        </span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-xs font-medium tabular',
              trend === 'down' ? 'bg-[var(--surface-muted)] text-ink-500' : 'bg-green-50 text-green-700',
            )}
          >
            <TrendIcon className="size-3" />
            {Math.abs(delta ?? 0)}
            {deltaLabel}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="mt-1 flex items-baseline gap-1">
          {typeof value === 'number' && Number.isFinite(value) ? (
            <CountUp
              value={value}
              decimals={decimals}
              className="tabular text-3xl font-bold text-ink-900"
            />
          ) : (
            <span className="tabular text-3xl font-bold text-ink-900">—</span>
          )}
          {unit && hasValue && <span className="text-base font-medium text-ink-500">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
