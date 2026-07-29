'use client';

import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { TableSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminNodes, useAdminUsers, useKnowledgeDocs } from '@/hooks/useAdmin';
import type { KnowledgeDoc, SensorNode, User } from '@/lib/schemas';
import { formatDate, relativeTime } from '@/lib/utils';

const userColumns: ColumnDef<User>[] = [
  { accessorKey: 'full_name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <Badge variant="soft">{row.original.role}</Badge>,
  },
  { accessorKey: 'phone_number', header: 'Phone' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'soft' : 'muted'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

const nodeColumns: ColumnDef<SensorNode>[] = [
  { accessorKey: 'device_id', header: 'Device' },
  { accessorKey: 'field_name', header: 'Field' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'soft' : 'muted'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'battery',
    header: 'Battery',
    cell: ({ row }) => <span className="tabular">{row.original.battery}%</span>,
  },
  {
    accessorKey: 'last_seen',
    header: 'Last seen',
    cell: ({ row }) =>
      row.original.last_seen ? relativeTime(row.original.last_seen) : '—',
  },
];

export default function AdminPage() {
  const t = useTranslations('admin');
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: nodes, isLoading: nodesLoading } = useAdminNodes();
  const { data: docs, isLoading: docsLoading } = useKnowledgeDocs();

  const docColumns: ColumnDef<KnowledgeDoc>[] = [
    { accessorKey: 'title', header: 'Title' },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
    },
    {
      accessorKey: 'language',
      header: 'Language',
      cell: ({ row }) => row.original.language.toUpperCase(),
    },
    {
      accessorKey: 'chunks',
      header: 'Chunks',
      cell: ({ row }) => <span className="tabular">{row.original.chunks}</span>,
    },
    {
      accessorKey: 'embedded',
      header: 'Status',
      cell: ({ row }) =>
        row.original.embedded ? (
          <Badge variant="soft">Embedded</Badge>
        ) : (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => toast.success(`Re-embedding ${row.original.title}`)}
          >
            <RefreshCw className="size-3.5" /> {t('reembed')}
          </Button>
        ),
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ row }) => formatDate(row.original.updated_at),
    },
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
          <TabsTrigger value="nodes">{t('tabs.nodes')}</TabsTrigger>
          <TabsTrigger value="documents">{t('tabs.documents')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {usersLoading ? <TableSkeleton /> : <DataTable columns={userColumns} data={users ?? []} />}
        </TabsContent>
        <TabsContent value="nodes">
          {nodesLoading ? <TableSkeleton /> : <DataTable columns={nodeColumns} data={nodes ?? []} />}
        </TabsContent>
        <TabsContent value="documents">
          {docsLoading ? <TableSkeleton /> : <DataTable columns={docColumns} data={docs ?? []} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
