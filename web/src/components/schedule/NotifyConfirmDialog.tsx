'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { notifyShiftConfirmed, OptimizeApiError } from '@/lib/api/optimizer';

interface Props {
  open: boolean;
  onClose: () => void;
  weekStartDate: string;
  assignedCount: number;
  totalOrders: number;
}

export function NotifyConfirmDialog({
  open,
  onClose,
  weekStartDate,
  assignedCount,
  totalOrders,
}: Props) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await notifyShiftConfirmed({
        week_start_date: weekStartDate,
        assigned_count: assignedCount,
        total_orders: totalOrders,
      });
      toast.success(`通知送信完了: ${result.emails_sent}名に送信しました`);
      onClose();
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフト確定通知</DialogTitle>
          <DialogDescription>
            サ責にシフト確定メールを送信しますか？
            <br />
            {weekStartDate} 週: {assignedCount} / {totalOrders} 件割当
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            スキップ
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-1 h-4 w-4" />
            )}
            送信
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
