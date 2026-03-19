'use client';

import { useState, useCallback } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  importNotesPreview,
  importNotesApply,
  OptimizeApiError,
  type NoteImportPreviewResponse,
} from '@/lib/api/optimizer';
import { NoteImportPreview } from './NoteImportPreview';

/** CURAノートのデフォルトスプレッドシートID（環境変数から取得） */
const DEFAULT_SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_CURA_NOTE_SPREADSHEET_ID ?? '';

interface NoteImportButtonProps {
  onComplete?: () => void;
}

/**
 * スプレッドシートIDを URL またはIDから抽出する
 */
function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  // Google Sheets URL パターン
  const urlMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  // IDそのまま
  return trimmed;
}

export function NoteImportButton({ onComplete }: NoteImportButtonProps) {
  const [inputOpen, setInputOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [preview, setPreview] = useState<NoteImportPreviewResponse | null>(null);

  const handleFetchPreview = useCallback(async () => {
    const spreadsheetId = spreadsheetInput
      ? extractSpreadsheetId(spreadsheetInput)
      : DEFAULT_SPREADSHEET_ID;

    if (!spreadsheetId) {
      toast.error('スプレッドシートIDを入力してください');
      return;
    }

    setLoading(true);
    try {
      const result = await importNotesPreview(spreadsheetId);
      setPreview(result);
      setInputOpen(false);
      setPreviewOpen(true);

      if (result.total_notes === 0) {
        toast.info('未処理のノートはありません');
        return;
      }

      toast.success(`${result.total_notes}件のノートを読み取りました`);
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        toast.error(`読み取りエラー: ${err.message}`);
      } else {
        toast.error('ノートの読み取りに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [spreadsheetInput]);

  const handleApply = useCallback(
    async (postIds: string[]) => {
      if (!preview || postIds.length === 0) return;

      setApplyLoading(true);
      try {
        const result = await importNotesApply({
          spreadsheet_id: preview.spreadsheet_id,
          post_ids: postIds,
          mark_as_handled: true,
        });

        toast.success(
          `${result.applied_count}件をFirestoreに反映しました` +
            (result.marked_count > 0 ? `（シート: ${result.marked_count}件を対応済みに更新）` : ''),
        );

        setPreviewOpen(false);
        setPreview(null);
        onComplete?.();
      } catch (err) {
        if (err instanceof OptimizeApiError) {
          toast.error(`適用エラー: ${err.message}`);
        } else {
          toast.error('ノートの適用に失敗しました');
        }
      } finally {
        setApplyLoading(false);
      }
    },
    [preview, onComplete],
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setInputOpen(true)}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        ノート取込
      </Button>

      {/* スプレッドシート入力ダイアログ */}
      <Dialog open={inputOpen} onOpenChange={setInputOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CURAノート取込</DialogTitle>
            <DialogDescription>
              CURAノートのスプレッドシートIDまたはURLを入力してください。
              空欄の場合はデフォルトのノートシートを使用します。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="spreadsheet-input">スプレッドシート ID / URL</Label>
            <Input
              id="spreadsheet-input"
              placeholder={DEFAULT_SPREADSHEET_ID || 'スプレッドシートIDを入力'}
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInputOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleFetchPreview} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  読み取り中...
                </>
              ) : (
                '読み取り'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* プレビューダイアログ */}
      <NoteImportPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        loading={applyLoading}
        onApply={handleApply}
      />
    </>
  );
}
