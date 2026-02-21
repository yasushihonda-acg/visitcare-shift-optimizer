'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';
import type { Customer, ServiceSlot } from '@/types';

const SERVICE_LABELS: Record<string, string> = {
  physical_care: '身体',
  daily_living: '生活',
  mixed: '混合',
  prevention: '予防',
  private: '自費',
  disability: '障がい',
  transport_support: '移送',
  severe_visiting: '重訪',
};

const SERVICE_BADGE_STYLES: Record<string, string> = {
  physical_care: 'bg-blue-50 text-blue-700 border-blue-200',
  daily_living: 'bg-green-50 text-green-700 border-green-200',
  mixed: 'bg-amber-50 text-amber-700 border-amber-200',
  prevention: 'bg-purple-50 text-purple-700 border-purple-200',
  private: 'bg-rose-50 text-rose-700 border-rose-200',
  disability: 'bg-lime-50 text-lime-700 border-lime-200',
  transport_support: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  severe_visiting: 'bg-orange-50 text-orange-700 border-orange-200',
};

function ServiceSlotChip({ slot }: { slot: ServiceSlot }) {
  const label = SERVICE_LABELS[slot.service_type] ?? slot.service_type;
  const style = SERVICE_BADGE_STYLES[slot.service_type] ?? '';
  return (
    <div className="flex flex-col gap-0.5 text-[10px] leading-tight">
      <Badge variant="outline" className={`h-4 px-1 text-[9px] ${style}`}>
        {label}
        {slot.staff_count > 1 && <span className="ml-0.5 opacity-70">×{slot.staff_count}</span>}
      </Badge>
      <span className="text-muted-foreground font-mono">
        {slot.start_time}–{slot.end_time}
      </span>
    </div>
  );
}

function totalWeeklySlots(customer: Customer): number {
  return DAY_OF_WEEK_ORDER.reduce(
    (sum, day) => sum + (customer.weekly_services[day]?.length ?? 0),
    0,
  );
}

export default function WeeklySchedulePage() {
  const { customers, loading } = useCustomers();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = Array.from(customers.values()).sort((a, b) => {
      const na = a.name.short ?? `${a.name.family}${a.name.given}`;
      const nb = b.name.short ?? `${b.name.family}${b.name.given}`;
      return na.localeCompare(nb, 'ja');
    });
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.name.family.toLowerCase().includes(q) ||
        c.name.given.toLowerCase().includes(q) ||
        (c.name.short ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">基本予定一覧</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            利用者ごとの週間サービス予定を表示します
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="利用者名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32 sticky left-0 bg-background z-10">利用者</TableHead>
              {DAY_OF_WEEK_ORDER.map((day) => (
                <TableHead key={day} className="text-center min-w-[90px]">
                  {DAY_OF_WEEK_LABELS[day]}
                </TableHead>
              ))}
              <TableHead className="text-center w-16">合計</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  該当する利用者がいません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => {
                const total = totalWeeklySlots(customer);
                const name =
                  customer.name.short ??
                  `${customer.name.family} ${customer.name.given}`;
                return (
                  <TableRow key={customer.id}>
                    <TableCell
                      className="font-medium sticky left-0 bg-background z-10 border-r"
                      title={`${customer.name.family} ${customer.name.given}`}
                    >
                      <span className="truncate block max-w-[120px]">{name}</span>
                    </TableCell>
                    {DAY_OF_WEEK_ORDER.map((day) => {
                      const slots = customer.weekly_services[day] ?? [];
                      return (
                        <TableCell key={day} className="align-top py-2 text-center">
                          {slots.length === 0 ? (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          ) : (
                            <div className="flex flex-col gap-1.5 items-center">
                              {slots.map((slot, i) => (
                                <ServiceSlotChip key={i} slot={slot} />
                              ))}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {total > 0 ? (
                        <span className="font-semibold">{total}</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
