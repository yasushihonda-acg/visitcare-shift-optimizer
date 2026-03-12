'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useAuthRole } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const CATEGORY_STYLES: Record<string, string> = {
  '訪問介護': 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
  '通所介護Ⅰ': 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
  '地域密着型': 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  '訪問看護': 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
  '大規模型（Ⅰ）': 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200',
};

const CATEGORY_ACTIVE_STYLES: Record<string, string> = {
  '訪問介護': 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
  '通所介護Ⅰ': 'bg-green-600 text-white border-green-600 hover:bg-green-700',
  '地域密着型': 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700',
  '訪問看護': 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700',
  '大規模型（Ⅰ）': 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700',
};

export default function ServiceTypesPage() {
  const { sortedList, loading } = useServiceTypes();
  const { canEditHelpers } = useAuthRole();
  const [editTarget, setEditTarget] = useState<ServiceTypeDoc | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const st of sortedList) {
      if (st.category) cats.add(st.category);
    }
    return Array.from(cats);
  }, [sortedList]);

  // 未選択 = 全表示
  const filteredList = useMemo(() => {
    if (selectedCategories.size === 0) return sortedList;
    return sortedList.filter((st) => st.category && selectedCategories.has(st.category));
  }, [sortedList, selectedCategories]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

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

  const colSpan = canEditHelpers ? 7 : 6;

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

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="カテゴリフィルタ">
          {categories.map((cat) => {
            const isActive = selectedCategories.has(cat);
            const count = sortedList.filter((st) => st.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? (CATEGORY_ACTIVE_STYLES[cat] ?? 'bg-primary text-primary-foreground border-primary')
                    : (CATEGORY_STYLES[cat] ?? 'bg-muted text-muted-foreground border-border hover:bg-accent')
                }`}
              >
                {cat}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isActive ? 'bg-white/20' : 'bg-black/5'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
          {selectedCategories.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategories(new Set())}
              className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              クリア
            </button>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">順</TableHead>
              <TableHead className="w-28">カテゴリ</TableHead>
              <TableHead className="w-40 font-mono">コード</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead className="w-24">短縮名</TableHead>
              <TableHead className="w-28 text-center">身体介護資格</TableHead>
              {canEditHelpers && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                  {sortedList.length === 0
                    ? 'サービス種別が登録されていません'
                    : '該当するサービス種別がありません'}
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((st, index) => (
                <TableRow key={st.id} className={index % 2 === 1 ? 'bg-muted/30' : ''}>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {st.sort_order}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CATEGORY_STYLES[st.category] ?? ''}`}
                    >
                      {st.category}
                    </Badge>
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
        {selectedCategories.size > 0
          ? `全${sortedList.length}件（表示: ${filteredList.length}件）`
          : `全${sortedList.length}件`}
      </p>

      <ServiceTypeEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        serviceType={editTarget}
      />
    </div>
  );
}
