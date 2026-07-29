import { cn } from '@/lib/utils';

/** SmartMurima mark: a sprouting leaf inside a rounded tile. */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid size-9 place-items-center rounded-[10px]',
          onDark ? 'bg-green-600' : 'bg-green-600',
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 21V11"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 12C12 8 15 5 20 5C20 9 17 12 12 12Z"
            fill="#D1FADF"
          />
          <path
            d="M12 14C12 11 9.5 8.5 5 9C5 12.5 7.5 14.5 12 14Z"
            fill="#A6F4C5"
          />
        </svg>
      </span>
      <span
        className={cn(
          'text-lg font-bold tracking-tight',
          onDark ? 'text-white' : 'text-ink-900',
        )}
      >
        Smart<span className={onDark ? 'text-green-200' : 'text-green-600'}>Murima</span>
      </span>
    </span>
  );
}
