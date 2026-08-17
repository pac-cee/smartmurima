'use client';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { LocationPicker } from '@/components/LocationPicker';
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
import { useCreateFarm } from '@/hooks/useFarms';
import { farmInput, type Farm, type FarmInput } from '@/lib/schemas';

/**
 * Shared create-farm flow. Used from the Farms list AND every onboarding panel
 * (dashboard + section-scoped pages) so the golden path is identical everywhere.
 * On success the new farm becomes the globally-selected farm, so the app
 * immediately points at it.
 */
export function CreateFarmDialog({
  trigger,
  onCreated,
}: {
  trigger?: ReactNode;
  onCreated?: (farm: Farm) => void;
}) {
  const t = useTranslations('farms');
  const tc = useTranslations('common');
  const { setFarm } = useSelection();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const create = useCreateFarm();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FarmInput>({
    resolver: zodResolver(farmInput),
  });

  const onSubmit = (values: FarmInput) => {
    create.mutate(
      { ...values, location },
      {
        onSuccess: (farm) => {
          toast.success(t('created'));
          setFarm(farm.id);
          setOpen(false);
          reset();
          setLocation(undefined);
          onCreated?.(farm);
        },
        onError: () => toast.error(tc('retry')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
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
            <Label>
              {t('location')} <span className="text-ink-500">({tc('optional')})</span>
            </Label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">{t('area')}</Label>
            <Input
              id="area"
              type="number"
              step="0.1"
              {...register('area_hectares', { valueAsNumber: true })}
            />
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
