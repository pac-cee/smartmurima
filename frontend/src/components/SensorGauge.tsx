'use client';

import { useEffect, useState } from 'react';
import { CountUp } from '@/components/CountUp';
import { cn } from '@/lib/utils';

/**
 * Radial gauge — a green arc filling a hairline track. The single most
 * characteristic element of a field's live state, sized for glanceability.
 */
export function SensorGauge({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  decimals = 0,
  size = 148,
  optimalMin,
  optimalMax,
}: {
  value: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  decimals?: number;
  size?: number;
  optimalMin?: number;
  optimalMax?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270-degree sweep, starting at 135deg (bottom-left)
  const sweep = 270;
  const startAngle = 135;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweep / 360) * circumference;

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setProgress(ratio);
      return;
    }
    const t = requestAnimationFrame(() => setProgress(ratio));
    return () => cancelAnimationFrame(t);
  }, [ratio]);

  const inOptimal =
    optimalMin !== undefined && optimalMax !== undefined
      ? value >= optimalMin && value <= optimalMax
      : true;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[0deg]">
          <g transform={`rotate(${startAngle} ${cx} ${cy})`}>
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--green-100)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={inOptimal ? 'var(--green-600)' : 'var(--green-800)'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLength * progress} ${circumference}`}
              style={{ transition: 'stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)' }}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="flex items-baseline gap-0.5">
            <CountUp
              value={value}
              decimals={decimals}
              className="tabular text-3xl font-bold text-ink-900"
            />
            {unit && <span className="text-sm font-medium text-ink-500">{unit}</span>}
          </span>
          <span
            className={cn(
              'mt-1 rounded-pill px-2 py-0.5 text-[11px] font-medium',
              inOptimal ? 'bg-green-50 text-green-700' : 'bg-[var(--surface-muted)] text-ink-500',
            )}
          >
            {inOptimal ? 'Optimal' : 'Watch'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-ink-700">{label}</p>
    </div>
  );
}
