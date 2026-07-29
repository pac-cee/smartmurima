'use client';

import { WifiOff } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';

// A node is considered live if we have seen telemetry within this window. The
// simulator publishes every ~5s and the ESP32 firmware every ~60s.
const ONLINE_WINDOW_MS = 3 * 60_000;

/**
 * Compact live/offline indicator for a field's sensors, driven by the most
 * recent reading timestamp (or a node's last_seen). Green pulse when live,
 * muted when the sensor has gone quiet.
 */
export function SensorStatus({
  lastSeen,
  className,
}: {
  lastSeen: string | null | undefined;
  className?: string;
}) {
  if (!lastSeen) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-ink-500',
          className,
        )}
      >
        <WifiOff className="size-3.5" /> No sensor data
      </span>
    );
  }

  const online = Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium',
        online ? 'bg-green-50 text-green-700' : 'bg-[var(--surface-muted)] text-ink-500',
        className,
      )}
    >
      {online ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-pill bg-green-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-pill bg-green-600" />
        </span>
      ) : (
        <WifiOff className="size-3.5" />
      )}
      {online ? 'Live' : 'Offline'} · {relativeTime(lastSeen)}
    </span>
  );
}
