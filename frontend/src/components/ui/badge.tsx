import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-green-600 text-white',
        soft: 'border-transparent bg-green-50 text-green-800',
        outline: 'border-line text-ink-700',
        attention: 'border-green-800 bg-green-50 text-green-900',
        critical: 'border-transparent bg-green-50 text-ink-900 dark:bg-green-900/25',
        muted: 'border-transparent bg-[var(--surface-muted)] text-ink-500',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
