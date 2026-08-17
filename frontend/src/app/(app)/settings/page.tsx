'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Loader2, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LocationPicker } from '@/components/LocationPicker';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useChangePassword, useSession, useUpdateProfile } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const tl = useTranslations('location');
  const { user } = useSession();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone_number);
      setLocation(user.location ?? undefined);
    }
  }, [user]);

  const saveProfile = () => {
    update.mutate(
      { full_name: fullName, phone_number: phone, location: location ?? null },
      { onSuccess: () => toast.success(tc('saved')) },
    );
  };

  const changePassword = useChangePassword();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('passwordMismatch'));
      return;
    }
    changePassword.mutate(
      { old_password: oldPassword, new_password: newPassword },
      {
        onSuccess: () => {
          toast.success(t('passwordChanged'));
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: (err) => {
          const fieldError =
            err instanceof ApiError ? err.fieldErrors?.old_password?.[0] : undefined;
          const message = fieldError ?? (err instanceof ApiError ? err.message : t('passwordError'));
          setPwError(message);
          toast.error(message);
        },
      },
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
          <div className="space-y-1.5">
            <Label>{tl('label')}</Label>
            <LocationPicker
              value={location}
              onChange={setLocation}
              currentLabel={user?.location_path}
            />
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
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="current">{t('currentPassword')}</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">{ta('newPassword')}</Label>
                <Input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="confirm">{t('confirmPassword')}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {pwError && <p className="text-xs text-ink-700">{pwError}</p>}
            <Button
              type="submit"
              variant="outline"
              disabled={changePassword.isPending || !oldPassword || !newPassword || !confirmPassword}
            >
              {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
