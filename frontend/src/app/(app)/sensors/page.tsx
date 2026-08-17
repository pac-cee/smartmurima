'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  BatteryMedium,
  CloudRain,
  Cpu,
  Droplets,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Radio,
  Thermometer,
  Trash2,
  Waves,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SensorGauge } from '@/components/SensorGauge';
import { SensorStatus } from '@/components/SensorStatus';
import { SensorTrendChart } from '@/components/SensorTrendChart';
import { StatTile } from '@/components/StatTile';
import { ListSkeleton, StatRowSkeleton } from '@/components/Skeletons';
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
import { useSelection } from '@/components/selection-context';
// NOTE: the Select imports above are used ONLY inside the Add/Edit node dialogs
// (device status). The farm/section selection comes from the global top-bar
// switcher via useSelection() — this page renders no farm/section picker.
import { useFarms } from '@/hooks/useFarms';
import {
  useCreateNode,
  useDeleteNode,
  useFields,
  useNodes,
  useUpdateNode,
} from '@/hooks/useFields';
import { useLatestReading } from '@/hooks/useSensorReadings';
import { nodeStatusSchema, type SensorNode } from '@/lib/schemas';

function AddNodeDialog({ fieldId }: { fieldId: string }) {
  const t = useTranslations('sensors');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<SensorNode['status']>('active');
  const create = useCreateNode();

  const submit = () => {
    if (deviceId.trim().length < 2) {
      toast.error(t('deviceIdRequired'));
      return;
    }
    create.mutate(
      { field: fieldId, device_id: deviceId.trim(), status },
      {
        onSuccess: () => {
          toast.success(t('nodeAdded'));
          setOpen(false);
          setDeviceId('');
          setStatus('active');
        },
        onError: () => toast.error(tc('retry')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> {t('addNode')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addNode')}</DialogTitle>
          <DialogDescription>{t('nodeBelongs')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="device_id">{t('deviceId')}</Label>
            <Input
              id="device_id"
              placeholder="ESP32-…"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SensorNode['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nodeStatusSchema.options.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc('cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditNodeDialog({ node }: { node: SensorNode }) {
  const t = useTranslations('sensors');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SensorNode['status']>(node.status);
  const update = useUpdateNode();

  const submit = () => {
    update.mutate(
      { id: node.id, input: { status } },
      {
        onSuccess: () => {
          toast.success(tc('saved'));
          setOpen(false);
        },
        onError: () => toast.error(tc('retry')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStatus(node.status);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={tc('edit')}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editNode')}</DialogTitle>
          <DialogDescription className="font-mono">{node.device_id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{t('status')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as SensorNode['status'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodeStatusSchema.options.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`statuses.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {tc('cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            {tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteNodeDialog({ node }: { node: SensorNode }) {
  const t = useTranslations('sensors');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const remove = useDeleteNode();

  const onConfirm = () => {
    remove.mutate(node.id, {
      onSuccess: () => {
        toast.success(t('nodeRemoved'));
        setOpen(false);
      },
      onError: () => toast.error(tc('retry')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-ink-700" aria-label={tc('delete')}>
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('removeNode')}</DialogTitle>
          <DialogDescription>{t('removeConfirm', { device: node.device_id })}</DialogDescription>
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

const statusVariant: Record<SensorNode['status'], 'soft' | 'muted' | 'outline'> = {
  active: 'soft',
  inactive: 'outline',
  maintenance: 'muted',
};

export default function SensorsPage() {
  const t = useTranslations('sensors');
  const ts = useTranslations('sections');
  const tnav = useTranslations('nav');
  const { farmId, fieldId } = useSelection();

  const { data: farms, isLoading: farmsLoading } = useFarms();
  const activeFarm = farmId ?? farms?.[0]?.id;
  const farm = farms?.find((f) => f.id === activeFarm);

  const { data: fields, isLoading: fieldsLoading } = useFields(activeFarm ?? undefined);
  // Section comes from the GLOBAL top-bar switcher — never auto-picked here.
  const activeField = fieldId ?? undefined;
  const section = fields?.find((f) => f.id === activeField);

  const { data: latest, isLoading: latestLoading } = useLatestReading(activeField ?? undefined);
  const { data: nodes, isLoading: nodesLoading } = useNodes(activeField ?? undefined);

  if (!farmsLoading && (!farms || farms.length === 0)) {
    return (
      <div className="space-y-6">
        <Header t={t} lastSeen={null} />
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
      <Header t={t} lastSeen={latest?.recorded_at ?? null} />

      {!fieldsLoading && (!fields || fields.length === 0) ? (
        <EmptyState icon={MapPinned} title={ts('noSection')} />
      ) : !activeField ? (
        <EmptyState
          icon={MapPinned}
          title={ts('selectPrompt')}
          description={ts('selectPromptBody')}
        />
      ) : (
        <>
          {/* KPI row */}
          {latestLoading || !latest ? (
            <StatRowSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Droplets} label={t('soil_moisture')} value={latest.soil_moisture} unit="%" decimals={1} />
              <StatTile icon={Thermometer} label={t('temperature')} value={latest.temperature ?? 0} unit="°C" decimals={1} />
              <StatTile icon={Waves} label={t('humidity')} value={latest.humidity ?? 0} unit="%" />
              <StatTile icon={CloudRain} label={t('rainfall')} value={latest.rainfall ?? 0} unit="mm" decimals={1} />
            </div>
          )}

          {/* Live gauges */}
          <Card>
            <CardHeader>
              <CardTitle>{t('liveGauges')}</CardTitle>
            </CardHeader>
            <CardContent>
              {latestLoading || !latest ? (
                <div className="flex flex-wrap justify-around gap-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="size-40 animate-pulse rounded-pill bg-[var(--surface-muted)]" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-around gap-8">
                  <SensorGauge value={latest.soil_moisture} min={0} max={100} unit="%" decimals={1} label={t('soil_moisture')} optimalMin={30} optimalMax={55} />
                  <SensorGauge value={latest.temperature ?? 0} min={0} max={45} unit="°C" decimals={1} label={t('temperature')} optimalMin={18} optimalMax={30} />
                  <SensorGauge value={latest.humidity ?? 0} min={0} max={100} unit="%" label={t('humidity')} optimalMin={40} optimalMax={75} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Trend history */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('history')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ErrorBoundary>
                  <SensorTrendChart fieldId={activeField} />
                </ErrorBoundary>
              </CardContent>
            </Card>

            {/* Sensor node management */}
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{t('nodes')}</CardTitle>
                  {section && (
                    <p className="mt-1 truncate text-xs text-ink-500">
                      {section.name}
                      {farm ? ` · ${farm.name}` : ''}
                    </p>
                  )}
                </div>
                {activeField && <AddNodeDialog fieldId={activeField} />}
              </CardHeader>
              <CardContent className="space-y-3">
                {nodesLoading ? (
                  <ListSkeleton rows={2} />
                ) : nodes && nodes.length > 0 ? (
                  nodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between gap-2 rounded-tile border border-line p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-green-50 text-green-700">
                          <Cpu className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-semibold text-ink-900">
                            {node.device_id}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                            <span className="flex items-center gap-1">
                              <BatteryMedium className="size-3.5" />
                              {Math.round(node.battery)}%
                            </span>
                            <SensorStatus lastSeen={node.last_seen} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={statusVariant[node.status]}>
                          {t(`statuses.${node.status}`)}
                        </Badge>
                        <EditNodeDialog node={node} />
                        <DeleteNodeDialog node={node} />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Radio}
                    title={t('noNodes')}
                    action={activeField ? <AddNodeDialog fieldId={activeField} /> : undefined}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Header({
  t,
  lastSeen,
}: {
  t: ReturnType<typeof useTranslations>;
  lastSeen: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-ink-500">{t('subtitle')}</p>
      </div>
      <SensorStatus lastSeen={lastSeen} />
    </div>
  );
}
