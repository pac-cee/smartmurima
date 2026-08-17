'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocations } from '@/hooks/useLocations';

/**
 * Cascading Province -> District -> Sector picker backed by GET /locations.
 * Emits the selected **sector** Location id (or undefined) via `onChange`.
 *
 * Editing note: the backend gives us only a sector id + a display path, not the
 * parent chain, so on edit screens we surface `currentLabel` for context and
 * let the farmer re-pick from the top. Not touching the picker leaves the
 * existing location unchanged (the caller sends no `location` field).
 */
export function LocationPicker({
  value,
  onChange,
  currentLabel,
  disabled,
}: {
  value?: string | null;
  onChange: (sectorId: string | undefined) => void;
  currentLabel?: string | null;
  disabled?: boolean;
}) {
  const t = useTranslations('location');
  const [province, setProvince] = useState<string | undefined>(undefined);
  const [district, setDistrict] = useState<string | undefined>(undefined);

  const provinces = useLocations('province');
  const districts = useLocations('district', province);
  const sectors = useLocations('sector', district);

  return (
    <div className="space-y-3">
      {currentLabel ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <MapPin className="size-3.5 text-green-600" />
          {t('current')}: <span className="font-medium text-ink-700">{currentLabel}</span>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{t('province')}</Label>
          <Select
            value={province}
            onValueChange={(v) => {
              setProvince(v);
              setDistrict(undefined);
              onChange(undefined);
            }}
            disabled={disabled || provinces.isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectProvince')} />
            </SelectTrigger>
            <SelectContent>
              {provinces.data?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('district')}</Label>
          <Select
            value={district}
            onValueChange={(v) => {
              setDistrict(v);
              onChange(undefined);
            }}
            disabled={disabled || !province || districts.isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectDistrict')} />
            </SelectTrigger>
            <SelectContent>
              {districts.data?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('sector')}</Label>
          <Select
            value={value ?? undefined}
            onValueChange={(v) => onChange(v)}
            disabled={disabled || !district || sectors.isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectSector')} />
            </SelectTrigger>
            <SelectContent>
              {sectors.data?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
