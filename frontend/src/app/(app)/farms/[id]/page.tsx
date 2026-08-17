'use client';

import { use, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BatteryCharging, Layers, Loader2, MapPin, Pencil, Radio, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreateFieldDialog } from '@/components/CreateFieldDialog';
import { EmptyState } from '@/components/EmptyState';
import { LocationPicker } from '@/components/LocationPicker';
import { ListSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteFarm, useFarm, useUpdateFarm } from '@/hooks/useFarms';
import { useFields, useNodes } from '@/hooks/useFields';
import { farmInput, type Farm, type FarmInput } from '@/lib/schemas';
import { relativeTime } from '@/lib/utils';

function EditFarmDialog({ farm }: { farm: Farm }) {
  const t = useTranslations('farms');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<string | undefined>(farm.location ?? undefined);
  const update = useUpdateFarm();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FarmInput>({
    resolver: zodResolver(farmInput),
    defaultValues: {
      name: farm.name,
      sector: farm.sector,
      area_hectares: farm.area_hectares,
      latitude: farm.latitude,
      longitude: farm.longitude,
    },
  });

  const onSubmit = (values: FarmInput) => {
    update.mutate(
      { id: farm.id, input: { ...values, location } },
      {
        onSuccess: () => {
          toast.success(tc('saved'));
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset({
            name: farm.name,
            sector: farm.sector,
            area_hectares: farm.area_hectares,
            latitude: farm.latitude,
            longitude: farm.longitude,
          });
          setLocation(farm.location ?? undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> {tc('edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editFarm')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit_name">{t('name')}</Label>
            <Input id="edit_name" {...register('name')} />
            {errors.name && <p className="text-xs text-ink-700">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit_sector">{t('sector')}</Label>
            <Input id="edit_sector" {...register('sector')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('location')}</Label>
            <LocationPicker
              value={location}
              onChange={setLocation}
              currentLabel={farm.location_name}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_area">{t('area')}</Label>
              <Input
                id="edit_area"
                type="number"
                step="0.1"
                {...register('area_hectares', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_lat">{t('latitude')}</Label>
              <Input
                id="edit_lat"
                type="number"
                step="0.0001"
                {...register('latitude', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_lng">{t('longitude')}</Label>
              <Input
                id="edit_lng"
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
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFarmDialog({ farm }: { farm: Farm }) {
  const t = useTranslations('farms');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useDeleteFarm();

  const onConfirm = () => {
    remove.mutate(farm.id, {
      onSuccess: () => {
        toast.success(t('deleted'));
        setOpen(false);
        router.push('/farms');
      },
      onError: () => toast.error(tc('retry')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-ink-700">
          <Trash2 className="size-4" /> {tc('delete')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteFarm')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm', { name: farm.name })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={remove.isPending}>
            {remove.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('farms');
  const tf = useTranslations('fields');
  const ts = useTranslations('sensors');
  const { data: farm, isLoading: farmLoading } = useFarm(id);
  const { data: fields, isLoading: fieldsLoading } = useFields(id);
  const { data: nodes } = useNodes();

  const farmNodes = nodes?.filter((n) => fields?.some((f) => f.id === n.field)) ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/farms"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="size-4" /> {t('title')}
      </Link>

      <div className="flex flex-col gap-4 rounded-card border border-line bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {farmLoading || !farm ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{farm.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
                <MapPin className="size-4" /> {farm.location_name ?? farm.sector} ·{' '}
                {farm.latitude.toFixed(3)}, {farm.longitude.toFixed(3)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="tabular text-2xl font-bold text-green-700">{farm.area_hectares}</p>
                  <p className="text-xs text-ink-500">{t('area')}</p>
                </div>
                <div>
                  <p className="tabular text-2xl font-bold text-green-700">{fields?.length ?? 0}</p>
                  <p className="text-xs text-ink-500">{t('fields')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <EditFarmDialog farm={farm} />
                <DeleteFarmDialog farm={farm} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* location strip (map placeholder, no external tiles) */}
      <div className="relative h-40 overflow-hidden rounded-card border border-line bg-green-800">
        <div className="field-rows absolute inset-0 opacity-60" />
        <div className="grid-noise absolute inset-0 opacity-10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-pill bg-white/95 px-4 py-2 text-sm font-medium text-green-900 shadow-md">
            <MapPin className="size-4 text-green-600" />
            {farm?.latitude?.toFixed(4)}, {farm?.longitude?.toFixed(4)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* fields */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-5 text-green-600" /> {t('fields')}
            </CardTitle>
            <CreateFieldDialog farmId={id} />
          </CardHeader>
          <CardContent className="space-y-3">
            {fieldsLoading ? (
              <ListSkeleton rows={3} />
            ) : fields && fields.length > 0 ? (
              fields.map((field) => (
                <Link
                  key={field.id}
                  href={`/fields/${field.id}`}
                  className="flex items-center justify-between rounded-tile border border-line p-4 transition-colors hover:border-green-300 hover:bg-green-50/50"
                >
                  <div>
                    <p className="font-semibold text-ink-900">{field.name}</p>
                    <p className="text-sm text-ink-500">
                      {field.crop_name} · {field.area_hectares} ha
                    </p>
                  </div>
                  <Badge variant="soft">{field.growth_stage}</Badge>
                </Link>
              ))
            ) : (
              <EmptyState
                icon={Layers}
                title={tf('firstSectionTitle')}
                description={tf('firstSectionBody')}
                action={<CreateFieldDialog farmId={id} />}
              />
            )}
          </CardContent>
        </Card>

        {/* nodes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-5 text-green-600" /> {ts('nodes')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {farmNodes.length > 0 ? (
              farmNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between rounded-tile border border-line p-3"
                >
                  <div>
                    <p className="font-mono text-sm font-medium text-ink-900">{node.device_id}</p>
                    <p className="text-xs text-ink-500">
                      {ts('lastSeen')}: {node.last_seen ? relativeTime(node.last_seen) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={node.status === 'active' ? 'soft' : 'muted'}>
                      {node.status === 'active' ? ts('online') : node.status}
                    </Badge>
                    <span className="flex items-center gap-1 tabular text-xs text-ink-500">
                      <BatteryCharging className="size-3.5 text-green-600" /> {node.battery}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-ink-500">{ts('nodes')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
