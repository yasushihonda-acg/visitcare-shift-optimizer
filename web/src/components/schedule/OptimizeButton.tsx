'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Sparkles } from 'lucide-react';
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
import { runOptimize, OptimizeApiError } from '@/lib/api/optimizer';
import { useScheduleContext } from '@/contexts/ScheduleContext';

export function OptimizeButton() {
  const { weekStart } = useScheduleContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const result = await runOptimize({
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        dry_run: dryRun,
      });
      toast.success(
        `最適化${dryRun ? '（テスト）' : ''}完了: ${result.assigned_count}/${result.total_orders}件割当 (${result.solve_time_seconds.toFixed(1)}秒)`
      );
      setOpen(false);
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        const messages: Record<number, string> = {
          409: `最適化不可: ${err.message}`,
          422: `入力エラー: ${err.message}`,
        };
        toast.error(messages[err.statusCode] ?? `エラー: ${err.message}`);
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
          size="sm"
          disabled={loading}
          className="bg-gradient-to-r from-primary to-[oklch(0.45_0.10_210)] text-white shadow-sm hover:shadow-md hover:brightness-110 transition-all duration-200"
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-4 w-4" />
          )}
          最適化実行
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフト最適化の実行</DialogTitle>
          <DialogDescription>
            {format(weekStart, 'yyyy/M/d')}週のシフトを最適化します。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button variant="secondary" onClick={() => handleOptimize(true)} disabled={loading}>
            テスト実行
          </Button>
          <Button
            onClick={() => handleOptimize(false)}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-[oklch(0.45_0.10_210)] text-white"
          >
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
