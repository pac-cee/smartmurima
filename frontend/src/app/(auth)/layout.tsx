import { getTranslations } from 'next-intl/server';
import { CloudSun, Droplets, Leaf, MessageCircle } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Logo } from '@/components/Logo';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

  const highlights = [
    { icon: Droplets, label: 'Soil moisture, temperature, and humidity in real time' },
    { icon: Leaf, label: 'Photo-based crop disease detection' },
    { icon: MessageCircle, label: 'An assistant that answers in Kinyarwanda' },
    { icon: CloudSun, label: 'Weather-aware irrigation advice' },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Green hero */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-green-800 p-10 text-green-100 lg:flex">
        <div className="field-rows pointer-events-none absolute inset-0 opacity-70" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-green-600/30 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <Logo onDark />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight text-white text-balance">
            {t('heroHeadline')}
          </h1>
          <p className="mt-4 text-green-100/90">{t('heroBody')}</p>
          <ul className="mt-8 space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-green-50/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-tile bg-white/10">
                  <Icon className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-green-200/70">
          Bugesera District · Eastern Province · Rwanda
        </p>
      </div>

      {/* Form column */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <LanguageToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
