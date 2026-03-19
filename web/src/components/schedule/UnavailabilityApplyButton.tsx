'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { UserX, Loader2 } from 'lucide-react';
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
import { applyUnavailability, OptimizeApiError } from '@/lib/api/optimizer';
import { useScheduleContext } from '@/contexts/ScheduleContext';

/**
 * 対象週の休み希望をオーダーに自動反映するボタン。
 * 該当スタッフの割当を解除し、空になったオーダーはpendingに戻す。
 */
export function UnavailabilityApplyButton() {
  const { weekStart } = useScheduleContext();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const handleApply = async () => {
    setLoading(true);
    try {
      const result = await applyUnavailability({
        week_start_date: weekStartStr,
      });
      if (result.orders_modified === 0) {
        toast.info('反映対象のオーダーはありませんでした');
      } else {
        toast.success(
          `${result.orders_modified}件のオーダーから${result.removals_count}件の割当を解除しました` +
            (result.reverted_to_pending > 0
              ? `（${result.reverted_to_pending}件がpendingに変更）`
              : ''),
        );
      }
      setOpen(false);
    } catch (e) {
      if (e instanceof OptimizeApiError) {
        toast.error(`エラー: ${e.message}`);
      } else {
        toast.error('休み希望の反映に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <UserX className="mr-1 h-4 w-4" />
        休み反映
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>休み希望をオーダーに反映</DialogTitle>
            <DialogDescription>
              {format(weekStart, 'M/d')}週の休み希望を確認し、
              該当スタッフの割当を自動解除します。割当がなくなったオーダーはpendingに戻ります。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleApply} disabled={loading}>
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              反映実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
