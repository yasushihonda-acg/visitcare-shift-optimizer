'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, RotateCcw } from 'lucide-react';
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
import { toast } from 'sonner';
import { resetAssignments, OptimizeApiError } from '@/lib/api/optimizer';
import { useScheduleContext } from '@/contexts/ScheduleContext';

export function ResetButton() {
  const { weekStart } = useScheduleContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const result = await resetAssignments(format(weekStart, 'yyyy-MM-dd'));
      toast.success(`割当リセット完了: ${result.orders_reset}件`);
      setOpen(false);
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        toast.error(`リセットエラー: ${err.message}`);
      } else {
        toast.error('通信エラー: サーバーに接続できません');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-4 w-4" />
          )}
          リセット
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>割当をリセット</DialogTitle>
          <DialogDescription>
            {format(weekStart, 'yyyy/M/d')}週のすべてのオーダー割当を解除します。
            この操作は元に戻せません。
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          すべてのヘルパー割当と手動編集が初期化されます。
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            リセット実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
