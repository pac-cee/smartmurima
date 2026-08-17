'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import { AdviceFeed } from '@/components/AdviceFeed';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';

export default function RecommendationsPage() {
  const t = useTranslations('recommendations');
  const tnav = useTranslations('nav');
  const ts = useTranslations('sections');
  // Farm + Section both come from the global top-bar switcher.
  const { farmId, fieldId } = useSelection();

  const { data: farms, isLoading: farmsLoading } = useFarms();
  const activeFarm = farmId ?? farms?.[0]?.id;

  const { data: fields, isLoading: fieldsLoading } = useFields(activeFarm ?? undefined);

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

      {!fieldsLoading && (!fields || fields.length === 0) ? (
        <EmptyState icon={MapPinned} title={ts('noSection')} />
      ) : !fieldId ? (
        <EmptyState
          icon={MapPinned}
          title={ts('selectPrompt')}
          description={ts('selectPromptBody')}
        />
      ) : (
        <AdviceFeed fieldId={fieldId} showRefresh showTimestamp />
      )}
    </div>
  );
}
