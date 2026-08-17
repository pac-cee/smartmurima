'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import { AdviceFeed } from '@/components/AdviceFeed';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';

export default function RecommendationsPage() {
  const t = useTranslations('recommendations');
  const tnav = useTranslations('nav');
  const ts = useTranslations('sections');
  const { farmId, fieldId, setField } = useSelection();

  const { data: farms, isLoading: farmsLoading } = useFarms();
  const activeFarm = farmId ?? farms?.[0]?.id;

  const { data: fields, isLoading: fieldsLoading } = useFields(activeFarm ?? undefined);
  const [selectedField, setSelectedField] = useState<string | undefined>(fieldId ?? undefined);
  const effectiveField = selectedField ?? fieldId ?? fields?.[0]?.id;

  if (!farmsLoading && (!farms || farms.length === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={MapPinned}
          title={t('noFarm')}
          action={
            <Link href="/farms" className="text-sm font-medium text-green-700 hover:underline">
              {tnav('farms')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Section selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-500">{ts('section')}</span>
        <Select
          value={effectiveField}
          onValueChange={(v) => {
            setSelectedField(v);
            setField(v);
          }}
          disabled={fieldsLoading || !fields?.length}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {fields?.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!fieldsLoading && (!fields || fields.length === 0) ? (
        <EmptyState icon={MapPinned} title={ts('noSection')} />
      ) : (
        <AdviceFeed fieldId={effectiveField} showRefresh showTimestamp />
      )}
    </div>
  );
}
