'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import { useHelpers } from '@/hooks/useHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HelperEditDialog } from '@/components/masters/HelperEditDialog';
import type { Helper } from '@/types';

const TRANSPORTATION_LABELS: Record<string, string> = {
  car: '車',
  bicycle: '自転車',
  walk: '徒歩',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: '常勤',
  part_time: '非常勤',
};

export default function HelpersPage() {
  const { helpers, loading } = useHelpers();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Helper | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = Array.from(helpers.values());
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (h) =>
        h.name.family.toLowerCase().includes(q) ||
        h.name.given.toLowerCase().includes(q) ||
        h.qualifications.some((qual) => qual.toLowerCase().includes(q))
    );
  }, [helpers, search]);

  const openNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (helper: Helper) => {
    setEditTarget(helper);
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
        <h2 className="text-lg font-bold">ヘルパーマスタ</h2>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新規追加
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="名前・資格で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">氏名</TableHead>
              <TableHead>資格</TableHead>
              <TableHead className="w-24 text-center">身体介護</TableHead>
              <TableHead className="w-20">雇用形態</TableHead>
              <TableHead className="w-20">移動手段</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {search ? '一致するヘルパーが見つかりません' : 'ヘルパーが登録されていません'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((helper) => (
                <TableRow key={helper.id}>
                  <TableCell className="font-medium">
                    {helper.name.family} {helper.name.given}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {helper.qualifications.join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        helper.can_physical_care
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {helper.can_physical_care ? '可' : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {EMPLOYMENT_LABELS[helper.employment_type] ?? helper.employment_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {TRANSPORTATION_LABELS[helper.transportation] ?? helper.transportation}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(helper)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        全{helpers.size}件{search && `（表示: ${filtered.length}件）`}
      </p>

      <HelperEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        helper={editTarget}
      />
    </div>
  );
}
