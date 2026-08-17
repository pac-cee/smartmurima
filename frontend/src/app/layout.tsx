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
  // Stop Chrome/Google Translate from rewriting text nodes, which mutates the
  // DOM out from under React and throws "Failed to execute 'insertBefore'".
  other: { google: 'notranslate' },
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
    <html lang={locale} translate="no" suppressHydrationWarning>
      <body className="min-h-screen bg-paper font-sans text-ink-900 antialiased" suppressHydrationWarning>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
