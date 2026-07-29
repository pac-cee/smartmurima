'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Droplets, FlaskConical, Loader2, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { RecommendationCard } from '@/components/RecommendationCard';
import { useSelection } from '@/components/selection-context';
import { ListSkeleton } from '@/components/Skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFields } from '@/hooks/useFields';
import { useRecommendations, useRequestRecommendation } from '@/hooks/useRecommendations';
import type { RecommendationType } from '@/lib/schemas';

const types: { type: RecommendationType; icon: typeof Droplets }[] = [
  { type: 'irrigation', icon: Droplets },
  { type: 'fertilizer', icon: FlaskConical },
  { type: 'yield', icon: Sprout },
];

export default function RecommendationsPage() {
  const t = useTranslations('recommendations');
  const { farmId, fieldId } = useSelection();
  const { data: fields } = useFields(farmId ?? undefined);
  const [selectedField, setSelectedField] = useState<string | undefined>(fieldId ?? undefined);
  const effectiveField = selectedField ?? fieldId ?? fields?.[0]?.id;

  const { data: recs, isLoading } = useRecommendations();
  const request = useRequestRecommendation();

  const run = (type: RecommendationType) => {
    if (!effectiveField) {
      toast.error('Select a field first');
      return;
    }
    request.mutate(
      { field: effectiveField, type },
      { onSuccess: () => toast.success(`${t(`types.${type}`)} advice ready`) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('request')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Select value={effectiveField} onValueChange={setSelectedField}>
              <SelectTrigger>
                <SelectValue placeholder={t('runFor')} />
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
          <div className="grid gap-3 sm:grid-cols-3">
            {types.map(({ type, icon: Icon }) => (
              <button
                key={type}
                onClick={() => run(type)}
                disabled={request.isPending}
                className="flex items-center gap-3 rounded-tile border border-line p-4 text-left transition-colors hover:border-green-300 hover:bg-green-50 disabled:opacity-60"
              >
                <span className="grid size-10 place-items-center rounded-tile bg-green-50 text-green-700">
                  {request.isPending && request.variables?.type === type ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </span>
                <span>
                  <span className="block font-semibold text-ink-900">{t(`types.${type}`)}</span>
                  <span className="text-xs text-ink-500">{t('request')}</span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink-900">{t('history')}</h2>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : recs && recs.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recs.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Sprout} title={t('history')} />
        )}
      </div>
    </div>
  );
}
