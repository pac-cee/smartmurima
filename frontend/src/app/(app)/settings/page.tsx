'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Loader2, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession, useUpdateProfile } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const { user } = useSession();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone_number);
    }
  }, [user]);

  const saveProfile = () => {
    update.mutate(
      { full_name: fullName, phone_number: phone },
      { onSuccess: () => toast.success(tc('saved')) },
    );
  };

  const themes = [
    { value: 'light', label: t('themeLight'), icon: Sun },
    { value: 'dark', label: t('themeDark'), icon: Moon },
    { value: 'system', label: t('themeSystem'), icon: Monitor },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('profile')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">{ta('fullName')}</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">{ta('email')}</Label>
              <Input id="email" value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{ta('phone')}</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc('save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('theme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex items-center gap-2 rounded-control border px-4 py-2.5 text-sm font-medium transition-colors',
                  mounted && theme === value
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-line text-ink-700 hover:bg-green-50/50',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('security')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="current">{t('currentPassword')}</Label>
              <Input id="current" type="password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new">{ta('newPassword')}</Label>
              <Input id="new" type="password" />
            </div>
          </div>
          <Button variant="outline" onClick={() => toast.success('Password updated')}>
            {t('changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
