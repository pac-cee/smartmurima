import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-green-600 text-white shadow-sm hover:bg-green-700 active:bg-green-800',
        outline:
          'border border-line bg-transparent text-ink-900 hover:bg-green-50 hover:border-green-300',
        ghost: 'text-ink-700 hover:bg-green-50 hover:text-green-900',
        subtle: 'bg-green-50 text-green-800 hover:bg-green-100',
        link: 'text-green-700 underline-offset-4 hover:underline',
        danger:
          'border border-green-800 bg-green-50 text-ink-900 hover:bg-green-100 dark:bg-green-900/20',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-control px-3',
        lg: 'h-12 rounded-control px-7 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
