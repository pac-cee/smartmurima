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

  // default to first farm once loaded
  useEffect(() => {
    if (!farmId && farms && farms.length > 0) setFarm(farms[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms]);

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
