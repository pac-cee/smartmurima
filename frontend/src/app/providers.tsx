'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { makeQueryClient } from '@/lib/query-client';

function MswGate({ children }: { children: ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const { startWorker } = await import('@/mocks/browser');
      await startWorker();
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!ready) return null;
  return <>{children}</>;
}

export function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Kigali">
      <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <MswGate>{children}</MswGate>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
