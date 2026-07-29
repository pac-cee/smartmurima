'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  const { theme = 'light' } = useTheme();

  return (
    <SonnerToaster
      theme={theme as ToasterProps['theme']}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group rounded-card border border-line bg-card text-ink-900 shadow-md text-sm',
          description: 'text-ink-500',
          actionButton: 'bg-green-600 text-white rounded-control',
          cancelButton: 'bg-[var(--surface-muted)] text-ink-700 rounded-control',
          success: 'border-green-200',
          error: 'border-green-800',
        },
      }}
      {...props}
    />
  );
}
