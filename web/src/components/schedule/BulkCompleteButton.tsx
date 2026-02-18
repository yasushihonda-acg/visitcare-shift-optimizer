'use client';

import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { bulkUpdateOrderStatus } from '@/lib/firestore/updateOrder';
import type { DaySchedule } from '@/hooks/useScheduleData';

interface BulkCompleteButtonProps {
  schedule: DaySchedule;
}

export function BulkCompleteButton({ schedule }: BulkCompleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const assignedOrders = schedule.helperRows
    .flatMap((r) => r.orders)
    .concat(schedule.unassignedOrders)
    .filter((o) => o.status === 'assigned');

  const handleBulkComplete = async () => {
    setSaving(true);
    try {
      const count = await bulkUpdateOrderStatus(
        assignedOrders.map((o) => ({ id: o.id, currentStatus: o.status })),
        'completed',
      );
      toast.success(`${count}件のオーダーを実績確認済みにしました`);
      setOpen(false);
    } catch {
      toast.error('一括完了に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={assignedOrders.length === 0}
          data-testid="bulk-complete-button"
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          一括確認
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>一括実績確認</DialogTitle>
          <DialogDescription>
            {schedule.day}の割当済みオーダー{assignedOrders.length}件を
            すべて「完了（実績確認済み）」に変更します。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleBulkComplete} disabled={saving}>
            {saving ? '処理中...' : `${assignedOrders.length}件を完了にする`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
