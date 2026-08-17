'use client';

import { useTranslations } from 'next-intl';
import { Layers, MapPinned } from 'lucide-react';
import { AdviceFeed } from '@/components/AdviceFeed';
import { CreateFarmDialog } from '@/components/CreateFarmDialog';
import { CreateFieldDialog } from '@/components/CreateFieldDialog';
import { EmptyState } from '@/components/EmptyState';
import { OnboardingPanel } from '@/components/OnboardingPanel';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import { Button } from '@/components/ui/button';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';

export default function RecommendationsPage() {
  const t = useTranslations('recommendations');
  const to = useTranslations('onboarding');
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
        <OnboardingPanel
          icon={MapPinned}
          title={to('farmTitle')}
          body={to('farmBody')}
          action={
            <CreateFarmDialog
              trigger={
                <Button size="lg">
                  <MapPinned className="size-4" /> {to('farmCta')}
                </Button>
              }
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {!fieldsLoading && activeFarm && (!fields || fields.length === 0) ? (
        <OnboardingPanel
          icon={Layers}
          title={to('sectionTitle')}
          body={to('sectionBody')}
          action={
            <CreateFieldDialog
              farmId={activeFarm}
              trigger={
                <Button size="lg">
                  <Layers className="size-4" /> {to('sectionCta')}
                </Button>
              }
            />
          }
        />
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
