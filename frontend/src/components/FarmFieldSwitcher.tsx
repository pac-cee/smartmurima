'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSelection } from '@/components/selection-context';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';

export function FarmFieldSwitcher() {
  const t = useTranslations();
  const { farmId, fieldId, setFarm, setField } = useSelection();
  const { data: farms } = useFarms();
  const { data: fields } = useFields(farmId ?? undefined);

  // Default to the first farm once loaded, and SELF-HEAL a stale/invalid
  // selection (e.g. a leftover mock id like "f1" in localStorage from an
  // earlier mock-mode session) that would otherwise 500 the field/report APIs.
  useEffect(() => {
    if (!farms || farms.length === 0) return;
    const valid = new Set(farms.map((f) => f.id));
    if (!farmId || !valid.has(farmId)) setFarm(farms[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms, farmId]);

  // Drop a stale field selection that isn't part of the current farm.
  useEffect(() => {
    if (fields && fieldId && !fields.some((f) => f.id === fieldId)) setField(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, fieldId]);

  return (
    <div className="flex items-center gap-2">
      <MapPin className="hidden size-4 text-green-600 sm:block" />
      <Select value={farmId ?? undefined} onValueChange={(v) => setFarm(v)}>
        <SelectTrigger className="h-9 w-[130px] border-0 bg-transparent px-2 shadow-none focus:ring-0 sm:w-[170px]">
          <SelectValue placeholder={t('farms.title')} />
        </SelectTrigger>
        <SelectContent>
          {farms?.map((farm) => (
            <SelectItem key={farm.id} value={farm.id}>
              {farm.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-line">/</span>
      <Select
        value={fieldId ?? 'all'}
        onValueChange={(v) => setField(v === 'all' ? null : v)}
        disabled={!fields || fields.length === 0}
      >
        <SelectTrigger className="h-9 w-[130px] border-0 bg-transparent px-2 shadow-none focus:ring-0 sm:w-[170px]">
          <SelectValue placeholder={t('fields.title')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('common.all')}</SelectItem>
          {fields?.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
