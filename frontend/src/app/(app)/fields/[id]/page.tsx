'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdviceFeed } from '@/components/AdviceFeed';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SensorGauge } from '@/components/SensorGauge';
import { SensorStatus } from '@/components/SensorStatus';
import { SensorTrendChart } from '@/components/SensorTrendChart';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiseaseReports } from '@/hooks/useDiseaseDetect';
import { useCrops, useDeleteField, useField, useUpdateField } from '@/hooks/useFields';
import { useLatestReading } from '@/hooks/useSensorReadings';
import { fieldInput, growthStageSchema, type Field, type FieldInput } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

function EditFieldDialog({ field }: { field: Field }) {
  const t = useTranslations('fields');
  const tf = useTranslations('farms');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const update = useUpdateField();
  const { data: crops } = useCrops();
  const defaults: FieldInput = {
    farm: field.farm,
    name: field.name,
    crop: field.crop ?? '',
    planting_date: field.planting_date ?? new Date().toISOString().slice(0, 10),
    growth_stage: field.growth_stage,
    area_hectares: field.area_hectares,
  };
  const { register, handleSubmit, setValue, watch, reset } = useForm<FieldInput>({
    resolver: zodResolver(fieldInput),
    defaultValues: defaults,
  });

  const crop = watch('crop');
  const stage = watch('growth_stage');

  const onSubmit = (values: FieldInput) => {
    update.mutate(
      { id: field.id, input: values },
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
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> {tc('edit')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit_field_name">{tf('name')}</Label>
            <Input id="edit_field_name" {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                {t('crop')} <span className="text-green-700">*</span>
              </Label>
              <Select value={crop || undefined} onValueChange={(v) => setValue('crop', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCrop')} />
                </SelectTrigger>
                <SelectContent>
                  {crops?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('growthStage')}</Label>
              <Select
                value={stage}
                onValueChange={(v) => setValue('growth_stage', v as FieldInput['growth_stage'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {growthStageSchema.options.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_planting_date">{t('plantingDate')}</Label>
              <Input id="edit_planting_date" type="date" {...register('planting_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_field_area">{tf('area')}</Label>
              <Input
                id="edit_field_area"
                type="number"
                step="0.1"
                {...register('area_hectares', { valueAsNumber: true })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={update.isPending || !crop}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFieldDialog({ field }: { field: Field }) {
  const t = useTranslations('fields');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useDeleteField();

  const onConfirm = () => {
    remove.mutate(field.id, {
      onSuccess: () => {
        toast.success(t('deleted'));
        setOpen(false);
        router.push(`/farms/${field.farm}`);
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
          <DialogTitle>{t('deleteField')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm', { name: field.name })}</DialogDescription>
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

export default function FieldDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const t = useTranslations('fields');
  const ts = useTranslations('sensors');
  const tr = useTranslations('recommendations');
  const td = useTranslations('diseases');
  const { data: field, isLoading: fieldLoading } = useField(id);
  const { data: latest, isLoading: latestLoading } = useLatestReading(id);
  const { data: scans } = useDiseaseReports(id);

  return (
    <div className="space-y-6">
      <Link
        href={field ? `/farms/${field.farm}` : '/farms'}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="size-4" /> {field?.farm_name ?? 'Farm'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {fieldLoading || !field ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{field.name}</h1>
              <p className="mt-1 text-sm text-ink-500">
                {field.crop_name ?? 'No crop'}
                {field.planting_date ? ` · ${formatDate(field.planting_date)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SensorStatus lastSeen={latest?.recorded_at ?? null} />
              <Badge variant="soft">{field.growth_stage}</Badge>
              <EditFieldDialog field={field} />
              <DeleteFieldDialog field={field} />
            </div>
          </>
        )}
      </div>

      {/* live gauges */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gauges')}</CardTitle>
        </CardHeader>
        <CardContent>
          {latestLoading || !latest ? (
            <div className="flex flex-wrap justify-around gap-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="size-40 rounded-pill" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-around gap-8">
              <SensorGauge
                value={latest.soil_moisture}
                min={0}
                max={100}
                unit="%"
                decimals={1}
                label={ts('soil_moisture')}
                optimalMin={30}
                optimalMax={55}
              />
              <SensorGauge
                value={latest.temperature ?? 0}
                min={0}
                max={45}
                unit="°C"
                decimals={1}
                label={ts('temperature')}
                optimalMin={18}
                optimalMax={30}
              />
              <SensorGauge
                value={latest.humidity ?? 0}
                min={0}
                max={100}
                unit="%"
                label={ts('humidity')}
                optimalMin={40}
                optimalMax={75}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* history */}
      <Card>
        <CardHeader>
          <CardTitle>{ts('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary>
            <SensorTrendChart fieldId={id} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* auto advice */}
        <Card>
          <CardHeader>
            <CardTitle>{tr('title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AdviceFeed fieldId={id} stacked showRefresh />
          </CardContent>
        </Card>

        {/* disease reports */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scans && scans.length > 0 ? (
              scans.map((scan) => (
                <div key={scan.id} className="flex gap-3 rounded-tile border border-line p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scan.image_url ?? undefined}
                    alt={scan.disease}
                    className="size-16 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{scan.disease}</p>
                    <p className="tabular text-xs text-green-700">
                      {Math.round(scan.confidence * 100)}%
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{scan.treatment}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title={td('reports')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
