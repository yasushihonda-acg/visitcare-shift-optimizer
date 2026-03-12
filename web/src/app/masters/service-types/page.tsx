'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Search, X } from 'lucide-react';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useAuthRole } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

/** カテゴリ色定義: [dot色, 選択時bg, 選択時border, 選択時text, Badge用] */
const CATEGORY_COLORS: Record<string, { dot: string; active: string; badge: string }> = {
  '訪問介護':     { dot: 'bg-blue-500',   active: 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm shadow-blue-100',   badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  '通所介護Ⅰ':   { dot: 'bg-green-500',  active: 'bg-green-50 border-green-400 text-green-800 shadow-sm shadow-green-100',  badge: 'bg-green-100 text-green-800 border-green-300' },
  '地域密着型':   { dot: 'bg-amber-500',  active: 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm shadow-amber-100',  badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  '訪問看護':     { dot: 'bg-purple-500', active: 'bg-purple-50 border-purple-400 text-purple-800 shadow-sm shadow-purple-100', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  '大規模型（Ⅰ）': { dot: 'bg-rose-500',   active: 'bg-rose-50 border-rose-400 text-rose-800 shadow-sm shadow-rose-100',   badge: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const GHOST_STYLE = 'bg-transparent border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500';

export default function ServiceTypesPage() {
  const { sortedList, loading } = useServiceTypes();
  const { canEditHelpers } = useAuthRole();
  const [editTarget, setEditTarget] = useState<ServiceTypeDoc | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const st of sortedList) {
      if (st.category) cats.add(st.category);
    }
    return Array.from(cats);
  }, [sortedList]);

  // カテゴリフィルタ + テキスト検索
  const filteredList = useMemo(() => {
    let list = sortedList;
    if (selectedCategories.size > 0) {
      list = list.filter((st) => st.category && selectedCategories.has(st.category));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((st) =>
        st.code.toLowerCase().includes(q) ||
        st.label.toLowerCase().includes(q) ||
        st.short_label?.toLowerCase().includes(q) ||
        st.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sortedList, selectedCategories, searchQuery]);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="カテゴリフィルタ">
            {categories.map((cat) => {
              const isActive = selectedCategories.has(cat);
              const colors = CATEGORY_COLORS[cat];
              const count = sortedList.filter((st) => st.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? (colors?.active ?? 'bg-primary/10 border-primary text-primary shadow-sm')
                      : GHOST_STYLE
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full transition-all duration-200 ${
                    isActive
                      ? (colors?.dot ?? 'bg-primary')
                      : 'bg-gray-300'
                  }`} />
                  {cat}
                  <span className={`tabular-nums text-[10px] leading-none transition-colors duration-200 ${
                    isActive ? 'opacity-80' : 'opacity-40'
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
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
                クリア
              </button>
            )}
          </div>
        )}

        <div className="relative sm:ml-auto sm:w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="コード・名前で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

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
                    : searchQuery.trim()
                      ? `「${searchQuery.trim()}」に一致するサービス種別がありません`
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
                      className={`text-[10px] ${CATEGORY_COLORS[st.category]?.badge ?? ''}`}
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
        {filteredList.length !== sortedList.length
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
