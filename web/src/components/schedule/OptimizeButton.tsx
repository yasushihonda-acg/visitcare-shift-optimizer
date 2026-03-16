'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
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
import { useScheduleData } from '@/hooks/useScheduleData';
import {
  ConstraintWeightsForm,
  DEFAULT_WEIGHTS,
  type ConstraintWeights,
} from './ConstraintWeightsForm';
import { checkAllowedStaff, type AllowedStaffWarning } from '@/lib/validation/allowed-staff-check';
import { DAY_OF_WEEK_LABELS } from '@/types';
import { clearCompanionField } from '@/lib/firestore/updateOrder';

interface OptimizeButtonProps {
  onHistoryClear?: () => void;
  onComplete?: () => void;
}

export function OptimizeButton({ onHistoryClear, onComplete }: OptimizeButtonProps = {}) {
  const { weekStart } = useScheduleContext();
  const { customers, helpers, orders, unavailability } = useScheduleData(weekStart);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weights, setWeights] = useState<ConstraintWeights>({ ...DEFAULT_WEIGHTS });

  const [warnOpen, setWarnOpen] = useState(false);
  const [warnings, setWarnings] = useState<AllowedStaffWarning[]>([]);

  const [companionWarnOpen, setCompanionWarnOpen] = useState(false);
  const companionOrders = useMemo(() => orders.filter((o) => o.companion_staff_id), [orders]);

  /** 同行チェック → 警告表示 or 最適化ダイアログ直接表示 */
  const proceedWithCompanionCheck = () => {
    if (companionOrders.length > 0) {
      setCompanionWarnOpen(true);
    } else {
      setOpen(true);
    }
  };

  /** 最適化ボタン押下: 事前チェック → 警告 or 直接ダイアログ */
  const handleClickOptimize = () => {
    const found = checkAllowedStaff({ customers, helpers, orders, unavailability });
    if (found.length > 0) {
      setWarnings(found);
      setWarnOpen(true);
    } else {
      proceedWithCompanionCheck();
    }
  };

  /** 警告ダイアログから最適化ダイアログへ遷移する際も同行チェックを挟む */
  const handleProceedAfterStaffWarn = () => {
    setWarnOpen(false);
    proceedWithCompanionCheck();
  };

  /**
   * 最適化後、同行設定をクリアする。
   * 最適化エンジンは update() で assigned_staff_ids/status/updated_at のみ書き換えるため、
   * companion_staff_id はFirestoreに残留する。ここで明示的に削除する。
   * assigned_staff_ids と staff_count は最適化エンジンが上書き済み。
   */
  const clearCompanionSettings = async () => {
    await Promise.all(
      companionOrders.map((o) => clearCompanionField(o.id))
    );
  };

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const result = await runOptimize({
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        dry_run: false,
        ...weights,
      });
      await clearCompanionSettings();
      toast.success(
        `最適化完了: ${result.assigned_count}/${result.total_orders}件割当 (${result.solve_time_seconds.toFixed(1)}秒)`
      );
      setOpen(false);
      onHistoryClear?.();
      onComplete?.();
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
    <>
    {/* ── 事前警告ダイアログ（入れるスタッフ） ── */}
    <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            最適化前の注意
          </DialogTitle>
          <DialogDescription>
            以下の利用者のオーダーで「入れるスタッフ」が対象週に全員対応不可のため、
            最適化が失敗する可能性があります。
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-60 overflow-y-auto space-y-2 text-sm">
          {warnings.map((w) => (
            <li key={w.order_id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="font-medium">{w.customer_name}</span>
              {' — '}
              {DAY_OF_WEEK_LABELS[w.day_of_week]}曜 {w.start_time}〜{w.end_time}
              {w.allowed_helper_names.length > 0 && (
                <span className="block text-xs text-muted-foreground mt-0.5">
                  設定中: {w.allowed_helper_names.join('、')} → 全員対応不可
                </span>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setWarnOpen(false)}>
            戻って修正する
          </Button>
          <Button
            variant="destructive"
            onClick={handleProceedAfterStaffWarn}
          >
            警告を無視して実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── 同行設定リセット確認ダイアログ ── */}
    <Dialog open={companionWarnOpen} onOpenChange={setCompanionWarnOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            同行設定のリセット確認
          </DialogTitle>
          <DialogDescription>
            同行設定が{companionOrders.length}件あります。最適化を実行すると同行設定はリセットされますがよろしいですか？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setCompanionWarnOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={() => { setCompanionWarnOpen(false); setOpen(true); }}
          >
            リセットして実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── ウェイト設定 → 実行ダイアログ ── */}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={loading}
          onClick={(e) => { e.preventDefault(); handleClickOptimize(); }}
          className="rounded-full bg-gradient-to-r from-[oklch(0.50_0.13_200)] to-[oklch(0.56_0.14_188)] text-white shadow-brand-sm hover:shadow-brand hover:brightness-110 transition-all duration-200"
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
            {format(weekStart, 'yyyy/M/d')}週のシフトを最適化します（月〜日の全曜日が対象）。
          </DialogDescription>
        </DialogHeader>
        <ConstraintWeightsForm weights={weights} onChange={setWeights} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={loading}
            className="bg-gradient-to-r from-[oklch(0.50_0.13_200)] to-[oklch(0.56_0.14_188)] text-white"
          >
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
