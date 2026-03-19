'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileSpreadsheet, Loader2, Settings } from 'lucide-react';
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
import {
  getCuraImportSettings,
  saveCuraImportSettings,
} from '@/lib/firestore/settings';
import { NoteImportPreview } from './NoteImportPreview';

interface NoteImportButtonProps {
  onComplete?: () => void;
}

/**
 * スプレッドシートIDを URL またはIDから抽出する
 */
function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

export function NoteImportButton({ onComplete }: NoteImportButtonProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [savedSpreadsheetId, setSavedSpreadsheetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NoteImportPreviewResponse | null>(null);

  // 初回マウント時にFirestoreから設定を読み込み
  useEffect(() => {
    getCuraImportSettings()
      .then((s) => {
        if (s?.spreadsheet_id) {
          setSavedSpreadsheetId(s.spreadsheet_id);
        }
      })
      .catch(() => {
        // テスト環境やFirebase未初期化時は無視
      });
  }, []);

  const fetchPreview = useCallback(
    async (spreadsheetId: string) => {
      setLoading(true);
      try {
        const result = await importNotesPreview(spreadsheetId);
        setPreview(result);
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
    },
    [],
  );

  /** メインボタンクリック: 設定済みなら即取込、未設定なら設定ダイアログ */
  const handleClick = useCallback(() => {
    if (savedSpreadsheetId) {
      fetchPreview(savedSpreadsheetId);
    } else {
      setSettingsOpen(true);
    }
  }, [savedSpreadsheetId, fetchPreview]);

  /** 設定ダイアログから保存して取込開始 */
  const handleSaveAndFetch = useCallback(async () => {
    const id = extractSpreadsheetId(spreadsheetInput);
    if (!id) {
      toast.error('スプレッドシートIDまたはURLを入力してください');
      return;
    }

    try {
      await saveCuraImportSettings(id);
      setSavedSpreadsheetId(id);
      setSettingsOpen(false);
      toast.success('スプレッドシート設定を保存しました');
      fetchPreview(id);
    } catch {
      toast.error('設定の保存に失敗しました');
    }
  }, [spreadsheetInput, fetchPreview]);

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
            (result.marked_count > 0
              ? `（シート: ${result.marked_count}件を対応済みに更新）`
              : ''),
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
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4" />
          )}
          {loading ? '読み取り中...' : 'ノート取込'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            setSpreadsheetInput(savedSpreadsheetId ?? '');
            setSettingsOpen(true);
          }}
          title="ノート取込設定"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* スプレッドシート設定ダイアログ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ノート取込設定</DialogTitle>
            <DialogDescription>
              CURAノートのスプレッドシートIDまたはURLを設定してください。
              一度設定すれば次回からボタン1クリックで取込できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="spreadsheet-input">スプレッドシート ID / URL</Label>
            <Input
              id="spreadsheet-input"
              placeholder="https://docs.google.com/spreadsheets/d/... または ID"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
            />
            {savedSpreadsheetId && (
              <p className="text-xs text-muted-foreground">
                現在の設定: {savedSpreadsheetId}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveAndFetch}>
              保存して取込
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
