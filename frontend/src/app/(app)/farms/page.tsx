'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Layers, Loader2, MapPin, MapPinned, Plus, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ListSkeleton } from '@/components/Skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateFarm, useFarms } from '@/hooks/useFarms';
import { farmInput, type FarmInput } from '@/lib/schemas';

function CreateFarmDialog() {
  const t = useTranslations('farms');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const create = useCreateFarm();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FarmInput>({
    resolver: zodResolver(farmInput),
    defaultValues: { latitude: -2.3, longitude: 30.2 },
  });

  const onSubmit = (values: FarmInput) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success(t('created'));
        setOpen(false);
        reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t('add')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newFarm')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-ink-700">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sector">{t('sector')}</Label>
            <Input id="sector" placeholder="Rweru" {...register('sector')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area">{t('area')}</Label>
              <Input
                id="area"
                type="number"
                step="0.1"
                {...register('area_hectares', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lat">{t('latitude')}</Label>
              <Input
                id="lat"
                type="number"
                step="0.0001"
                {...register('latitude', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">{t('longitude')}</Label>
              <Input
                id="lng"
                type="number"
                step="0.0001"
                {...register('longitude', { valueAsNumber: true })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              {tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
                    <MapPin className="size-3.5" /> {farm.sector}
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
