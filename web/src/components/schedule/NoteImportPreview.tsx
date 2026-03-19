'use client';

import { useState, useMemo } from 'react';
import { Check, AlertTriangle, HelpCircle, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type {
  NoteActionType,
  ImportActionStatus,
  NoteImportAction,
  NoteImportPreviewResponse,
} from '@/lib/api/optimizer';

interface NoteImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: NoteImportPreviewResponse | null;
  loading: boolean;
  onApply: (postIds: string[]) => void;
}

const ACTION_TYPE_LABELS: Record<NoteActionType, string> = {
  cancel: 'キャンセル',
  update_time: '時間変更',
  add_visit: '受診同行追加',
  add_meeting: '担当者会議追加',
  add: '新規追加',
  staff_unavailability: 'ヘルパー休み',
  unknown: '要確認',
};

const STATUS_CONFIG: Record<ImportActionStatus, { icon: typeof Check; color: string; label: string }> = {
  ready: { icon: Check, color: 'text-green-600', label: '適用可能' },
  needs_review: { icon: AlertTriangle, color: 'text-amber-500', label: '要確認' },
  unmatched: { icon: HelpCircle, color: 'text-red-500', label: '未マッチ' },
  skipped: { icon: SkipForward, color: 'text-gray-400', label: 'スキップ' },
};

const ACTION_BADGE_VARIANT: Record<NoteActionType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  cancel: 'destructive',
  update_time: 'default',
  add_visit: 'secondary',
  add_meeting: 'secondary',
  add: 'secondary',
  staff_unavailability: 'outline',
  unknown: 'outline',
};

function ActionRow({
  action,
  selected,
  onToggle,
}: {
  action: NoteImportAction;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConf = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.needs_review;
  const StatusIcon = statusConf.icon;
  const isSelectable = action.status === 'ready';

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
        <div className="pt-0.5">
          {isSelectable ? (
            <Checkbox checked={selected} onCheckedChange={onToggle} />
          ) : (
            <StatusIcon className={`h-4 w-4 ${statusConf.color}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={ACTION_BADGE_VARIANT[action.action_type] ?? 'outline'}>
              {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
            </Badge>
            <span className="text-sm font-medium truncate">
              {action.customer_name ?? '（不明）'}
            </span>
            <span className="text-xs text-muted-foreground">
              {action.date_from}
              {action.date_to && action.date_to !== action.date_from
                ? `〜${action.date_to}`
                : ''}
            </span>
            {action.confidence < 0.7 && (
              <Badge variant="outline" className="text-xs">
                確信度: {Math.round(action.confidence * 100)}%
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
          <CollapsibleTrigger asChild>
            <button className="text-xs text-blue-500 hover:underline mt-1">
              {expanded ? '詳細を閉じる' : '詳細を見る'}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {action.raw_content}
            </pre>
            {action.matched_order && (
              <div className="text-xs text-muted-foreground mt-1">
                マッチしたオーダー: {action.matched_order.start_time}〜{action.matched_order.end_time}{' '}
                ({action.matched_order.service_type}) [{action.matched_order.status}]
              </div>
            )}
            {action.time_range && (
              <div className="text-xs mt-1">
                時間帯: {action.time_range.start}
                {action.time_range.end ? `〜${action.time_range.end}` : '〜'}
                {action.new_time_range && (
                  <>
                    {' → '}
                    {action.new_time_range.start}
                    {action.new_time_range.end ? `〜${action.new_time_range.end}` : '〜'}
                  </>
                )}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}

export function NoteImportPreview({
  open,
  onOpenChange,
  preview,
  loading,
  onApply,
}: NoteImportPreviewProps) {
  const readyActions = useMemo(
    () => preview?.actions.filter((a) => a.status === 'ready') ?? [],
    [preview],
  );

  // readyアクションを初期選択。key propによるコンポーネント再マウントでリセットされる。
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(readyActions.map((a) => a.post_id)),
  );

  const toggleAction = (postId: string) => {
    const next = new Set(selectedIds);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
    }
    setSelectedIds(next);
  };

  const selectAllReady = () => {
    setSelectedIds(new Set(readyActions.map((a) => a.post_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>ノートインポート プレビュー</DialogTitle>
          <DialogDescription>
            CURAノートから読み取った変更内容を確認してください。
            チェックを入れた項目がFirestoreに反映されます。
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <>
            {/* サマリー */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Check className="h-4 w-4 text-green-600" />
                <span>適用可能: {preview.ready_count}件</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>要確認: {preview.review_count}件</span>
              </div>
              <div className="flex items-center gap-1">
                <HelpCircle className="h-4 w-4 text-red-500" />
                <span>未マッチ: {preview.unmatched_count}件</span>
              </div>
              {preview.skipped_count > 0 && (
                <div className="flex items-center gap-1">
                  <SkipForward className="h-4 w-4 text-gray-400" />
                  <span>スキップ: {preview.skipped_count}件</span>
                </div>
              )}
            </div>

            {/* 一括選択 */}
            {readyActions.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllReady}>
                  全て選択 ({readyActions.length})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  全て解除
                </Button>
              </div>
            )}

            {/* アクションリスト */}
            <div className="flex-1 overflow-y-auto divide-y">
              {preview.actions.map((action) => (
                <ActionRow
                  key={action.post_id}
                  action={action}
                  selected={selectedIds.has(action.post_id)}
                  onToggle={() => toggleAction(action.post_id)}
                />
              ))}
            </div>
          </>
        )}

        {!preview && !loading && (
          <div className="py-8 text-center text-muted-foreground">
            プレビューデータがありません
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => onApply(Array.from(selectedIds))}
            disabled={loading || selectedIds.size === 0}
          >
            {loading ? '適用中...' : `${selectedIds.size}件を適用`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
