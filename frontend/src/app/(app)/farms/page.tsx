'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Layers, MapPin, MapPinned, Radio } from 'lucide-react';
import { CreateFarmDialog } from '@/components/CreateFarmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ListSkeleton } from '@/components/Skeletons';
import { Card, CardContent } from '@/components/ui/card';
import { useFarms } from '@/hooks/useFarms';

export default function FarmsPage() {
  const t = useTranslations('farms');
  const te = useTranslations('empty');
  const { data: farms, isLoading } = useFarms();

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} action={<CreateFarmDialog />} />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : !farms || farms.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title={te('farms')}
          description={te('farmsBody')}
          action={<CreateFarmDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => (
            <Link key={farm.id} href={`/farms/${farm.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-tile bg-green-50 text-green-700">
                      <MapPinned className="size-5" />
                    </span>
                    <span className="tabular text-sm font-semibold text-green-700">
                      {farm.area_hectares} ha
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-ink-900">{farm.name}</p>
                  <p className="flex items-center gap-1 text-sm text-ink-500">
                    <MapPin className="size-3.5" /> {farm.location_name ?? farm.sector}
                  </p>
                  <div className="mt-4 flex gap-4 text-xs text-ink-500">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5 text-green-600" /> {farm.field_count ?? 0}{' '}
                      {t('fields').toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Radio className="size-3.5 text-green-600" /> {farm.node_count ?? 0}{' '}
                      {t('nodes').toLowerCase()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
