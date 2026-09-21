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
import type { Location } from '@/lib/schemas';

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
  const tc = useTranslations('common');
  // '' -- not undefined -- is the "nothing picked yet" value. Radix reads an
  // undefined `value` as "uncontrolled" and then keeps its own internal
  // selection, so a select that went from a value back to undefined (clearing
  // the district when the province changes) kept showing the stale choice.
  // Empty strings keep all three selects controlled for their whole lifetime.
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');

  const provinces = useLocations('province');
  const districts = useLocations('district', province || undefined);
  const sectors = useLocations('sector', district || undefined);

  return (
    <div className="space-y-3">
      {currentLabel ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <MapPin className="size-3.5 text-green-600" />
          {t('current')}: <span className="font-medium text-ink-700">{currentLabel}</span>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <LevelSelect
          label={t('province')}
          placeholder={t('selectProvince')}
          value={province}
          onValueChange={(v) => {
            if (v === province) return;
            setProvince(v);
            // A new province invalidates whatever district/sector was picked.
            setDistrict('');
            onChange(undefined);
          }}
          options={provinces.data}
          loading={provinces.isLoading}
          error={provinces.error}
          onRetry={() => void provinces.refetch()}
          disabled={disabled}
          emptyLabel={t('noOptions')}
          failedLabel={t('loadFailed')}
          retryLabel={tc('retry')}
        />

        <LevelSelect
          label={t('district')}
          placeholder={t('selectDistrict')}
          value={district}
          onValueChange={(v) => {
            if (v === district) return;
            setDistrict(v);
            onChange(undefined);
          }}
          options={districts.data}
          loading={districts.isLoading}
          error={districts.error}
          onRetry={() => void districts.refetch()}
          disabled={disabled || !province}
          emptyLabel={t('noOptions')}
          failedLabel={t('loadFailed')}
          retryLabel={tc('retry')}
        />

        <LevelSelect
          label={t('sector')}
          placeholder={t('selectSector')}
          value={value ?? ''}
          onValueChange={(v) => onChange(v)}
          options={sectors.data}
          loading={sectors.isLoading}
          error={sectors.error}
          onRetry={() => void sectors.refetch()}
          disabled={disabled || !district}
          emptyLabel={t('noOptions')}
          failedLabel={t('loadFailed')}
          retryLabel={tc('retry')}
        />
      </div>
    </div>
  );
}

/**
 * One rung of the cascade. Always controlled (`value` is '' when nothing is
 * picked) and, when the list comes back empty or the request fails, says so
 * inside the dropdown rather than opening onto a blank panel.
 */
function LevelSelect({
  label,
  placeholder,
  value,
  onValueChange,
  options,
  loading,
  error,
  onRetry,
  disabled,
  emptyLabel,
  failedLabel,
  retryLabel,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Location[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  disabled?: boolean;
  emptyLabel: string;
  failedLabel: string;
  retryLabel: string;
}) {
  const empty = !options || options.length === 0;
  // A bare "could not load" leaves nothing to act on, so show what the request
  // actually said ("Failed to fetch" for a CORS/offline backend, "Request
  // failed (404)" for a bad API URL) next to a retry.
  const detail = error instanceof Error ? error.message : null;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {empty ? (
            <div className="space-y-1 px-2 py-2 text-xs text-ink-500">
              <p>{error ? failedLabel : emptyLabel}</p>
              {detail ? <p className="font-mono text-[11px] text-ink-700">{detail}</p> : null}
              {error ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="font-semibold text-green-700 hover:underline"
                >
                  {retryLabel}
                </button>
              ) : null}
            </div>
          ) : (
            options.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
