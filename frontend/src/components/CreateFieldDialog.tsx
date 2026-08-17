'use client';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSelection } from '@/components/selection-context';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateField, useCrops } from '@/hooks/useFields';
import { fieldInput, growthStageSchema, type Field, type FieldInput } from '@/lib/schemas';

/**
 * Shared create-section flow. A "section" is the field/plot record (one crop).
 * Used from farm detail AND every onboarding panel. On success the new section
 * is auto-selected in the GLOBAL selection so the dashboard/sensors/advice pages
 * become useful right away.
 */
export function CreateFieldDialog({
  farmId,
  trigger,
  onCreated,
}: {
  farmId: string;
  trigger?: ReactNode;
  onCreated?: (field: Field) => void;
}) {
  const t = useTranslations('fields');
  const tf = useTranslations('farms');
  const tc = useTranslations('common');
  const { setFarm, setField } = useSelection();
  const [open, setOpen] = useState(false);
  const create = useCreateField();
  const { data: crops } = useCrops();
  const { register, handleSubmit, setValue, watch, reset } = useForm<FieldInput>({
    resolver: zodResolver(fieldInput),
    defaultValues: {
      farm: farmId,
      growth_stage: 'germination',
      planting_date: new Date().toISOString().slice(0, 10),
    },
  });

  const crop = watch('crop');
  const stage = watch('growth_stage');

  const onSubmit = (values: FieldInput) => {
    create.mutate(values, {
      onSuccess: (field) => {
        toast.success(t('added'));
        // Point the whole app at the freshly created section.
        setFarm(field.farm);
        setField(field.id);
        setOpen(false);
        reset({
          farm: farmId,
          growth_stage: 'germination',
          planting_date: new Date().toISOString().slice(0, 10),
        });
        onCreated?.(field);
      },
      onError: () => toast.error(tc('retry')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newField')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{tf('name')}</Label>
            <Input id="name" {...register('name')} />
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
                      {t(`stages.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="planting_date">{t('plantingDate')}</Label>
              <Input id="planting_date" type="date" {...register('planting_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field_area">{tf('area')}</Label>
              <Input
                id="field_area"
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
            <Button type="submit" disabled={create.isPending || !crop}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              {tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
