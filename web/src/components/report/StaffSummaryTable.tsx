'use client';

import { UserCog } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StaffSummaryRow } from '@/lib/report/aggregation';

interface StaffSummaryTableProps {
  rows: StaffSummaryRow[];
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

export function StaffSummaryTable({ rows }: StaffSummaryTableProps) {
  return (
    <section className="rounded-xl border bg-card shadow-brand-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <UserCog className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold">スタッフ別稼働時間</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}名</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">データなし</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead className="text-right">訪問件数</TableHead>
              <TableHead className="text-right">稼働時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.helperId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right">{row.visitCount}件</TableCell>
                <TableCell className="text-right">{formatHours(row.totalMinutes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
