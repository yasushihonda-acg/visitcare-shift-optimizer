'use client';

import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useAuthRole } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ServiceTypeEditDialog } from '@/components/masters/ServiceTypeEditDialog';
import type { ServiceTypeDoc } from '@/types';

export default function ServiceTypesPage() {
  const { sortedList, loading } = useServiceTypes();
  const { canEditHelpers } = useAuthRole();
  const [editTarget, setEditTarget] = useState<ServiceTypeDoc | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (serviceType: ServiceTypeDoc) => {
    setEditTarget(serviceType);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">サービス種別マスタ</h2>
        {canEditHelpers && (
          <Button onClick={openNew} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新規追加
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">順</TableHead>
              <TableHead className="w-40 font-mono">コード</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead className="w-24">短縮名</TableHead>
              <TableHead className="w-28 text-center">身体介護資格</TableHead>
              {canEditHelpers && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEditHelpers ? 6 : 5} className="text-center text-muted-foreground py-8">
                  サービス種別が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              sortedList.map((st, index) => (
                <TableRow key={st.id} className={index % 2 === 1 ? 'bg-muted/30' : ''}>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {st.sort_order}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {st.code}
                  </TableCell>
                  <TableCell className="font-medium">
                    {st.label}
                  </TableCell>
                  <TableCell className="text-sm">
                    {st.short_label}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        st.requires_physical_care_cert
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {st.requires_physical_care_cert ? '必' : '-'}
                    </span>
                  </TableCell>
                  {canEditHelpers && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(st)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        全{sortedList.length}件
      </p>

      <ServiceTypeEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        serviceType={editTarget}
      />
    </div>
  );
}
