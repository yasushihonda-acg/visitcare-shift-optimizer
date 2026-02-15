'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useOptimizationRuns, useOptimizationRunDetail } from '@/hooks/useOptimizationRuns';
import { useHelpers } from '@/hooks/useHelpers';

function StatusBadge({ status, dryRun }: { status: string; dryRun: boolean }) {
  if (dryRun) {
    return (
      <Badge variant="secondary" className="gap-1">
        <FlaskConical className="h-3 w-3" />
        テスト
      </Badge>
    );
  }
  switch (status) {
    case 'Optimal':
      return (
        <Badge className="gap-1 bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          最適解
        </Badge>
      );
    case 'Feasible':
      return (
        <Badge className="gap-1 bg-amber-500">
          <AlertTriangle className="h-3 w-3" />
          実行可能解
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
  }
}

function RunDetailPanel({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { detail, loading } = useOptimizationRunDetail(runId);
  const { helpers } = useHelpers();

  const helperNameMap = new Map<string, string>();
  helpers.forEach((h, id) => helperNameMap.set(id, `${h.name.family} ${h.name.given}`));

  if (loading || !detail) {
    return (
      <Sheet open onOpenChange={() => onClose()}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>実行詳細</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const executedAt = new Date(detail.executed_at);
  const assignmentRate = detail.total_orders > 0
    ? ((detail.assigned_count / detail.total_orders) * 100).toFixed(1)
    : '0';

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>実行詳細</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">実行日時</p>
              <p className="font-medium">{format(executedAt, 'yyyy/M/d HH:mm:ss', { locale: ja })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">対象週</p>
              <p className="font-medium">{detail.week_start_date}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">ステータス</p>
              <StatusBadge status={detail.status} dryRun={detail.dry_run} />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">実行時間</p>
              <p className="font-medium">{detail.solve_time_seconds.toFixed(1)}秒</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">割当率</p>
              <p className="font-medium">{detail.assigned_count}/{detail.total_orders} ({assignmentRate}%)</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">目的関数値</p>
              <p className="font-medium">{detail.objective_value.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">制限時間</p>
              <p className="font-medium">{detail.parameters.time_limit_seconds ?? '-'}秒</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">割当結果 ({detail.assignments.length}件)</h3>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">オーダーID</TableHead>
                    <TableHead className="text-xs">担当スタッフ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.assignments.map((a) => (
                    <TableRow key={a.order_id}>
                      <TableCell className="text-xs font-mono">{a.order_id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-xs">
                        {a.staff_ids.map((sid) => helperNameMap.get(sid) ?? sid.slice(0, 8)).join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function HistoryPage() {
  const { runs, loading, error } = useOptimizationRuns();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              戻る
            </Link>
          </Button>
          <h2 className="text-lg font-semibold">最適化実行履歴</h2>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            履歴の取得に失敗しました: {error.message}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8" />
            <p>最適化の実行履歴はまだありません</p>
            <p className="mt-1">最適化を実行すると、ここに履歴が表示されます</p>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>実行日時</TableHead>
                  <TableHead>対象週</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">割当</TableHead>
                  <TableHead className="text-right">実行時間</TableHead>
                  <TableHead className="text-right">目的関数値</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run, index) => {
                  const executedAt = new Date(run.executed_at);
                  return (
                    <TableRow
                      key={run.id}
                      className={`cursor-pointer hover:bg-muted/50 ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <TableCell className="text-sm">
                        {format(executedAt, 'M/d HH:mm', { locale: ja })}
                      </TableCell>
                      <TableCell className="text-sm">{run.week_start_date}</TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} dryRun={run.dry_run} />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {run.assigned_count}/{run.total_orders}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {run.solve_time_seconds.toFixed(1)}s
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {run.objective_value.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {selectedRunId && (
          <RunDetailPanel
            runId={selectedRunId}
            onClose={() => setSelectedRunId(null)}
          />
        )}
      </main>
    </div>
  );
}
