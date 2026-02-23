'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useHelpers } from '@/hooks/useHelpers';
import { useAuthRole } from '@/lib/auth/AuthProvider';
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
import { Badge } from '@/components/ui/badge';
import { CustomerEditDialog } from '@/components/masters/CustomerEditDialog';
import { CustomerDetailSheet } from '@/components/masters/CustomerDetailSheet';
import { DAY_OF_WEEK_ORDER } from '@/types';
import type { Customer } from '@/types';

/** カタカナをひらがなに変換（検索正規化用） */
function toHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export default function CustomersPage() {
  const { customers, loading } = useCustomers();
  const { helpers } = useHelpers();
  const { canEditCustomers } = useAuthRole();
  const [search, setSearch] = useState('');
  const [sortKana, setSortKana] = useState<'asc' | 'desc' | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = Array.from(customers.values());
    if (!search.trim()) return list;
    const q = toHiragana(search.trim().toLowerCase());
    return list.filter(
      (c) =>
        (c.aozora_id?.toLowerCase().includes(q) ?? false) ||
        toHiragana(c.name.family.toLowerCase()).includes(q) ||
        toHiragana(c.name.given.toLowerCase()).includes(q) ||
        toHiragana(c.name.family_kana ?? '').includes(q) ||
        toHiragana(c.name.given_kana ?? '').includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.phone_number?.toLowerCase().includes(q) ?? false) ||
        (c.home_care_office?.toLowerCase().includes(q) ?? false) ||
        (c.care_manager_name?.toLowerCase().includes(q) ?? false) ||
        (c.consultation_support_office?.toLowerCase().includes(q) ?? false) ||
        (c.support_specialist_name?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, search]);

  const sorted = useMemo(() => {
    if (!sortKana) return filtered;
    return [...filtered].sort((a, b) => {
      const kanaA = toHiragana((a.name.family_kana ?? '') + (a.name.given_kana ?? ''));
      const kanaB = toHiragana((b.name.family_kana ?? '') + (b.name.given_kana ?? ''));
      if (!kanaA && !kanaB) return 0;
      if (!kanaA) return 1;
      if (!kanaB) return -1;
      return sortKana === 'asc'
        ? kanaA.localeCompare(kanaB, 'ja')
        : kanaB.localeCompare(kanaA, 'ja');
    });
  }, [filtered, sortKana]);

  const toggleSort = () =>
    setSortKana((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));

  const openNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditTarget(customer);
    setDialogOpen(true);
  };

  const openDetail = (customer: Customer) => {
    setDetailTarget(customer);
    setDetailOpen(true);
  };

  const handleDetailEdit = () => {
    setDetailOpen(false);
    if (detailTarget) openEdit(detailTarget);
  };

  const serviceDayCount = (customer: Customer) =>
    DAY_OF_WEEK_ORDER.filter(
      (d) => customer.weekly_services[d] && customer.weekly_services[d]!.length > 0
    ).length;

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
        <h2 className="text-lg font-bold">利用者マスタ</h2>
        {canEditCustomers && (
          <Button onClick={openNew} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新規追加
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="あおぞらID・名前・ふりがな・住所・ケアマネで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1600px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">あおぞらID</TableHead>
              <TableHead
                className="w-36 cursor-pointer select-none hover:bg-muted/50"
                onClick={toggleSort}
              >
                <span className="flex items-center gap-1">
                  氏名
                  {sortKana === 'asc' ? (
                    <ChevronUp className="h-3.5 w-3.5 text-primary" />
                  ) : sortKana === 'desc' ? (
                    <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                </span>
              </TableHead>
              <TableHead className="w-28">電話番号①</TableHead>
              <TableHead className="w-28">電話番号②</TableHead>
              <TableHead className="w-36">電話備考</TableHead>
              <TableHead>住所</TableHead>
              <TableHead className="w-24">サ責</TableHead>
              <TableHead className="w-28">担当居宅</TableHead>
              <TableHead className="w-28">ケアマネ</TableHead>
              <TableHead className="w-36">相談支援事業所</TableHead>
              <TableHead className="w-28">担当相談員</TableHead>
              <TableHead className="w-20 text-center">サービス日数</TableHead>
              <TableHead className="w-28 text-center">NG/推奨</TableHead>
              {canEditCustomers && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13 + (canEditCustomers ? 1 : 0)}
                  className="text-center text-muted-foreground py-8"
                >
                  {search ? '一致する利用者が見つかりません' : '利用者が登録されていません'}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((customer, index) => (
                <TableRow
                  key={customer.id}
                  className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 1 ? 'bg-muted/30' : ''}`}
                  onClick={() => openDetail(customer)}
                >
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.aozora_id ?? '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{customer.name.family} {customer.name.given}</div>
                    {(customer.name.family_kana || customer.name.given_kana) && (
                      <div className="text-xs text-muted-foreground font-normal">
                        {customer.name.family_kana} {customer.name.given_kana}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.phone_number ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.phone_number2 ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[9rem]">
                    {customer.phone_note ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                    {customer.address}
                  </TableCell>
                  <TableCell className="text-sm">{customer.service_manager}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.home_care_office ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.care_manager_name ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[9rem]">
                    {customer.consultation_support_office ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.support_specialist_name ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {serviceDayCount(customer)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {customer.ng_staff_ids.length > 0 ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 h-5">
                          NG {customer.ng_staff_ids.length}
                        </Badge>
                      ) : null}
                      {customer.preferred_staff_ids.length > 0 ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                          推奨 {customer.preferred_staff_ids.length}
                        </Badge>
                      ) : null}
                      {customer.ng_staff_ids.length === 0 && customer.preferred_staff_ids.length === 0 && '-'}
                    </div>
                  </TableCell>
                  {canEditCustomers && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(customer);
                        }}
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
        全{customers.size}件{search && `（表示: ${filtered.length}件）`}
        {sortKana && <span className="ml-2">ふりがな{sortKana === 'asc' ? '昇順' : '降順'}ソート中</span>}
      </p>

      <CustomerDetailSheet
        customer={detailTarget}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={handleDetailEdit}
        helpers={helpers}
      />

      <CustomerEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={editTarget}
      />
    </div>
  );
}
