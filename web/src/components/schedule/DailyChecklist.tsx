'use client';

import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  fetchDailyChecklist,
  OptimizeApiError,
  type DailyChecklistResponse,
} from '@/lib/api/optimizer';
/**
 * 翌日のオーダーをヘルパー別にグルーピングして表示するチェックリスト。
 */
export function DailyChecklist() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyChecklistResponse | null>(null);

  const tomorrow = addDays(new Date(), 1);
  const [targetDate, setTargetDate] = useState<string>(
    format(tomorrow, 'yyyy-MM-dd'),
  );

  const handleFetch = async () => {
    setLoading(true);
    try {
      const result = await fetchDailyChecklist(targetDate);
      setData(result);
      if (result.total_orders === 0) {
        toast.info('対象日のオーダーはありません');
      }
    } catch (e) {
      if (e instanceof OptimizeApiError) {
        toast.error(`エラー: ${e.message}`);
      } else {
        toast.error('チェックリストの取得に失敗しました');
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
          setTargetDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
          setData(null);
          setOpen(true);
        }}
      >
        <ClipboardList className="mr-1 h-4 w-4" />
        翌日チェック
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>翌日チェックリスト</DialogTitle>
            <DialogDescription>
              ヘルパー別の翌日予定一覧
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            />
            <Button onClick={handleFetch} disabled={loading} size="sm">
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              取得
            </Button>
          </div>

          {data && data.staff_checklists.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {format(new Date(targetDate + 'T00:00:00'), 'M月d日(E)', { locale: ja })} /
                合計 {data.total_orders}件
              </p>
              {data.staff_checklists.map((staff) => (
                <div key={staff.staff_id || 'unassigned'} className="border rounded-md p-3">
                  <h4 className="font-medium text-sm mb-2">
                    {staff.staff_name}
                    <span className="ml-2 text-muted-foreground">
                      ({staff.orders.length}件)
                    </span>
                  </h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-1 pr-2">時間</th>
                        <th className="pb-1 pr-2">利用者</th>
                        <th className="pb-1 pr-2">サービス</th>
                        <th className="pb-1">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.orders.map((order) => (
                        <tr key={order.order_id} className="border-b last:border-0">
                          <td className="py-1 pr-2 whitespace-nowrap">
                            {order.start_time}–{order.end_time}
                          </td>
                          <td className="py-1 pr-2">{order.customer_name}</td>
                          <td className="py-1 pr-2">{order.service_type}</td>
                          <td className="py-1">{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {data && data.staff_checklists.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              対象日のオーダーはありません
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
