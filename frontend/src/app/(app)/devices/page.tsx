'use client';

import { useState } from 'react';
import {
  BatteryMedium,
  Cpu,
  Droplets,
  Gauge,
  Loader2,
  Power,
  RadioTower,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { SensorStatus } from '@/components/SensorStatus';
import { ListSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSelection } from '@/components/selection-context';
import {
  useClaimDevice,
  useDevices,
  usePumpControl,
  useReleaseDevice,
  useThresholds,
} from '@/hooks/useDevices';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';
import type { SensorNode } from '@/lib/schemas';

export default function DevicesPage() {
  const { farmId } = useSelection();
  const { data: farms } = useFarms();
  const activeFarm = farmId ?? farms?.[0]?.id;
  const { data: fields } = useFields(activeFarm ?? undefined);

  const { data: paired, isLoading: pairedLoading } = useDevices({ claimed: true });
  const { data: discovered, isLoading: discoveredLoading } = useDevices({ claimed: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        subtitle="Pair field nodes, watch them report, and drive the pump."
      />

      <Tabs defaultValue="paired">
        <TabsList>
          <TabsTrigger value="paired">
            Paired {paired ? `(${paired.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="discovered">
            Discovered {discovered ? `(${discovered.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paired" className="space-y-4">
          {pairedLoading ? (
            <ListSkeleton rows={2} />
          ) : paired && paired.length > 0 ? (
            paired.map((device) => <PairedDeviceCard key={device.id} device={device} />)
          ) : (
            <EmptyState
              icon={Cpu}
              title="No paired devices"
              description="Power on a node and it will show up under Discovered, ready to claim."
            />
          )}
        </TabsContent>

        <TabsContent value="discovered" className="space-y-4">
          {discoveredLoading ? (
            <ListSkeleton rows={2} />
          ) : discovered && discovered.length > 0 ? (
            discovered.map((device) => (
              <DiscoveredDeviceCard
                key={device.id}
                device={device}
                fields={fields ?? []}
              />
            ))
          ) : (
            <EmptyState
              icon={RadioTower}
              title="Nothing waiting to be paired"
              description="A powered-on node announces itself every few seconds. Check its Wi-Fi setup if it never appears here."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DeviceIdentity({ device }: { device: SensorNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-green-50 text-green-700">
        <Cpu className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold text-ink-900">
          {device.device_id}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          {device.name && <span className="truncate">{device.name}</span>}
          <span className="flex items-center gap-1">
            <BatteryMedium className="size-3.5" />
            {Math.round(device.battery)}%
          </span>
          <SensorStatus lastSeen={device.last_seen} />
        </div>
      </div>
    </div>
  );
}

function DiscoveredDeviceCard({
  device,
  fields,
}: {
  device: SensorNode;
  fields: { id: string; name: string }[];
}) {
  const [fieldId, setFieldId] = useState<string>('');
  const claim = useClaimDevice();

  const onClaim = () => {
    if (!fieldId) {
      toast.error('Choose the section this device sits in.');
      return;
    }
    claim.mutate(
      { id: device.id, field: fieldId },
      {
        // The backend mints the token on claim; the device picks it up on its
        // next announce, so there is nothing to copy onto the board.
        onSuccess: () => toast.success(`${device.device_id} paired. It will start reporting shortly.`),
        onError: (error) => toast.error(error.message || 'Could not pair this device.'),
      },
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <DeviceIdentity device={device} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Section</Label>
            <Select value={fieldId} onValueChange={setFieldId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onClaim} disabled={claim.isPending || fields.length === 0}>
            {claim.isPending && <Loader2 className="size-4 animate-spin" />}
            Pair device
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PairedDeviceCard({ device }: { device: SensorNode }) {
  const pump = usePumpControl();
  const release = useReleaseDevice();
  const thresholds = useThresholds();
  const [dry, setDry] = useState(String(device.dry_level));
  const [wet, setWet] = useState(String(device.wet_level));

  const setMode = (pump_mode: 'auto' | 'manual', pump_on?: boolean) =>
    pump.mutate(
      { id: device.id, pump_mode, pump_on },
      {
        onSuccess: () =>
          toast.success(
            pump_mode === 'auto'
              ? 'Pump back on automatic control.'
              : `Pump override: ${pump_on ? 'ON' : 'OFF'}.`,
          ),
        onError: (error) => toast.error(error.message || 'Could not reach the device.'),
      },
    );

  const saveThresholds = () => {
    const dry_level = Number(dry);
    const wet_level = Number(wet);
    if (!Number.isFinite(dry_level) || !Number.isFinite(wet_level) || dry_level >= wet_level) {
      toast.error('Dry level must be below wet level.');
      return;
    }
    thresholds.mutate(
      { id: device.id, dry_level, wet_level },
      {
        onSuccess: () => toast.success('Irrigation band updated.'),
        onError: (error) => toast.error(error.message || 'Could not update the band.'),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <DeviceIdentity device={device} />
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={device.pump_state ? 'soft' : 'outline'}>
            Pump {device.pump_state ? 'ON' : 'OFF'}
          </Badge>
          <Badge variant="muted">{device.pump_mode}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-ink-500">
          {device.farm_name ? `${device.farm_name} · ` : ''}
          {device.field_name}
        </p>

        {/* Irrigation control. The device applies this on its next report, so
            the badge above may lag a few seconds behind the buttons. */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Power className="size-4" /> Pump control
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={device.pump_mode === 'auto' ? 'default' : 'ghost'}
              onClick={() => setMode('auto')}
              disabled={pump.isPending}
            >
              <Gauge className="size-4" /> Automatic
            </Button>
            <Button
              size="sm"
              variant={device.pump_mode === 'manual' && device.pump_on ? 'default' : 'ghost'}
              onClick={() => setMode('manual', true)}
              disabled={pump.isPending}
            >
              <Droplets className="size-4" /> Force on
            </Button>
            <Button
              size="sm"
              variant={
                device.pump_mode === 'manual' && device.pump_on === false ? 'default' : 'ghost'
              }
              onClick={() => setMode('manual', false)}
              disabled={pump.isPending}
            >
              <Power className="size-4" /> Force off
            </Button>
          </div>
        </div>

        {/* Auto-mode band: pump switches on below dry, off above wet. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`dry-${device.id}`}>Dry level (%)</Label>
            <Input
              id={`dry-${device.id}`}
              className="w-28"
              inputMode="numeric"
              value={dry}
              onChange={(e) => setDry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`wet-${device.id}`}>Wet level (%)</Label>
            <Input
              id={`wet-${device.id}`}
              className="w-28"
              inputMode="numeric"
              value={wet}
              onChange={(e) => setWet(e.target.value)}
            />
          </div>
          <Button size="sm" variant="ghost" onClick={saveThresholds} disabled={thresholds.isPending}>
            {thresholds.isPending && <Loader2 className="size-4 animate-spin" />}
            Save band
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-ink-700"
            onClick={() =>
              release.mutate(device.id, {
                onSuccess: () => toast.success(`${device.device_id} unpaired.`),
                onError: (error) => toast.error(error.message || 'Could not unpair.'),
              })
            }
            disabled={release.isPending}
          >
            <Unplug className="size-4" /> Unpair
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
