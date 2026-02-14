'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
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
import { CustomerEditDialog } from '@/components/masters/CustomerEditDialog';
import { DAY_OF_WEEK_ORDER } from '@/types';
import type { Customer } from '@/types';

export default function CustomersPage() {
  const { customers, loading } = useCustomers();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Customer | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = Array.from(customers.values());
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.name.family.toLowerCase().includes(q) ||
        c.name.given.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditTarget(customer);
    setDialogOpen(true);
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
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新規追加
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="名前・住所で検索..."
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
              <TableHead>住所</TableHead>
              <TableHead className="w-24">サ責</TableHead>
              <TableHead className="w-24 text-center">サービス日数</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {search ? '一致する利用者が見つかりません' : '利用者が登録されていません'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.name.family} {customer.name.given}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                    {customer.address}
                  </TableCell>
                  <TableCell className="text-sm">{customer.service_manager}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {serviceDayCount(customer)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(customer)}
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
        全{customers.size}件{search && `（表示: ${filtered.length}件）`}
      </p>

      <CustomerEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={editTarget}
      />
    </div>
  );
}
