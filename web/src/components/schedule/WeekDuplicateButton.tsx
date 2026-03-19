'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Copy, Loader2 } from 'lucide-react';
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
import { duplicateWeek, OptimizeApiError } from '@/lib/api/optimizer';
import { useScheduleContext } from '@/contexts/ScheduleContext';

/**
 * 基本シフト（ソース週）のオーダーを現在表示中の週に一括複製するボタン。
 * ソース週はダイアログ内で指定する（デフォルト: 前週）。
 */
export function WeekDuplicateButton() {
  const { weekStart } = useScheduleContext();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ソース週: デフォルトは前週
  const defaultSourceWeek = new Date(weekStart);
  defaultSourceWeek.setDate(defaultSourceWeek.getDate() - 7);

  const [sourceDate, setSourceDate] = useState<string>(
    format(defaultSourceWeek, 'yyyy-MM-dd'),
  );

  const targetDateStr = format(weekStart, 'yyyy-MM-dd');

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const result = await duplicateWeek({
        source_week_start: sourceDate,
        target_week_start: targetDateStr,
      });
      toast.success(
        `${result.created_count}件のオーダーを複製しました`,
      );
      setOpen(false);
    } catch (e) {
      if (e instanceof OptimizeApiError) {
        if (e.statusCode === 409) {
          toast.error(e.message);
        } else if (e.statusCode === 422) {
          toast.error(`入力エラー: ${e.message}`);
        } else {
          toast.error(`エラー: ${e.message}`);
        }
      } else {
        toast.error('オーダーの複製に失敗しました');
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
        onClick={() => {
          // ダイアログを開くたびにソース週をリセット
          const src = new Date(weekStart);
          src.setDate(src.getDate() - 7);
          setSourceDate(format(src, 'yyyy-MM-dd'));
          setOpen(true);
        }}
      >
        <Copy className="mr-1 h-4 w-4" />
        週複製
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>基本シフト → 当週に複製</DialogTitle>
            <DialogDescription>
              コピー元週のオーダーを{' '}
              <strong>
                {format(weekStart, 'M/d', { locale: ja })}週
              </strong>{' '}
              に一括複製します。ターゲット週に既存オーダーがある場合はスキップされます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="block text-sm font-medium">
              コピー元の週（月曜日）
            </label>
            <input
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleDuplicate} disabled={loading}>
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              複製実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
