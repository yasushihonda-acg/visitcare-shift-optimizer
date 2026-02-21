'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { notifyShiftChanged, OptimizeApiError, type ShiftChangeDetail } from '@/lib/api/optimizer';
import { useScheduleContext } from '@/contexts/ScheduleContext';
import type { AssignmentDiff } from '@/hooks/useAssignmentDiff';
import type { Order } from '@/types';

interface Props {
  diffMap: Map<string, AssignmentDiff>;
  helpers: Map<string, { id: string; name: { family: string; given: string } }>;
  customers: Map<string, { id: string; name: { family: string; given: string } }>;
  orders: Order[];
}

function staffNames(
  ids: string[],
  helpers: Map<string, { id: string; name: { family: string; given: string } }>,
): string {
  if (ids.length === 0) return '（未割当）';
  return ids
    .map((id) => {
      const h = helpers.get(id);
      return h ? `${h.name.family} ${h.name.given}` : id;
    })
    .join(', ');
}

export function NotifyChangesButton({ diffMap, helpers, customers, orders }: Props) {
  const { weekStart } = useScheduleContext();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // changed orders のみ対象
  const changedOrders = orders.filter((o) => diffMap.get(o.id)?.isChanged);

  const changes: ShiftChangeDetail[] = changedOrders.map((order) => {
    const diff = diffMap.get(order.id)!;
    const customer = customers.get(order.customer_id);
    const customerName = customer
      ? `${customer.name.family} ${customer.name.given}`
      : order.customer_id;

    // after = 現在の割当
    const afterIds = order.assigned_staff_ids;
    // before = 現在の割当から手動追加分を除き、最適化で除去された分を加えたもの
    const beforeIds = [
      ...order.assigned_staff_ids.filter((id) => !diff.added.includes(id)),
      ...diff.removed,
    ];

    return {
      order_id: order.id,
      customer_name: customerName,
      date: format(order.date, 'yyyy-MM-dd'),
      time_range: `${order.start_time}〜${order.end_time}`,
      old_staff: staffNames(beforeIds, helpers),
      new_staff: staffNames(afterIds, helpers),
    };
  });

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await notifyShiftChanged({
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        changes,
      });
      toast.success(`変更通知送信完了: ${result.emails_sent}名に送信しました`);
      setOpen(false);
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        toast.error(`通知エラー: ${err.message}`);
      } else {
        toast.error('通知の送信に失敗しました');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={changes.length === 0}
        onClick={() => setOpen(true)}
        title={changes.length > 0 ? `${changes.length}件の変更を通知` : '変更なし'}
      >
        <Bell className="mr-1.5 h-4 w-4" />
        変更通知
        {changes.length > 0 && (
          <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
            {changes.length}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>シフト変更通知</DialogTitle>
            <DialogDescription>
              {changes.length}件の変更をサ責にメールで通知します。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>利用者</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead>時間帯</TableHead>
                  <TableHead>変更前</TableHead>
                  <TableHead>変更後</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((c) => (
                  <TableRow key={c.order_id}>
                    <TableCell>{c.customer_name}</TableCell>
                    <TableCell>{c.date}</TableCell>
                    <TableCell>{c.time_range}</TableCell>
                    <TableCell className="text-muted-foreground">{c.old_staff}</TableCell>
                    <TableCell className="font-medium">{c.new_staff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              キャンセル
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-1 h-4 w-4" />
              )}
              送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
