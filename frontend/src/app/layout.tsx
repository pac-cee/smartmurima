import type { Metadata, Viewport } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'SmartMurima',
    template: '%s · SmartMurima',
  },
  description:
    'AI-driven precision agriculture for smallholder farmers and cooperatives in Bugesera, Rwanda.',
  applicationName: 'SmartMurima',
};

export const viewport: Viewport = {
  themeColor: '#166534',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-paper font-sans text-ink-900 antialiased">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
