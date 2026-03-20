'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileSpreadsheet, Loader2, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  getImportSources,
  saveImportSource,
  IMPORT_SOURCE_LABELS,
  type ImportSourceKey,
  type ImportSource,
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

const SOURCE_KEYS: ImportSourceKey[] = ['cura_note', 'fusen', 'checklist'];

export function NoteImportButton({ onComplete }: NoteImportButtonProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [editingSourceKey, setEditingSourceKey] = useState<ImportSourceKey>('cura_note');
  const [preview, setPreview] = useState<NoteImportPreviewResponse | null>(null);
  const [previewSourceLabel, setPreviewSourceLabel] = useState('');

  // 初回マウント時にFirestoreから設定を読み込み
  useEffect(() => {
    getImportSources()
      .then(setSources)
      .catch((err: unknown) => {
        console.warn('インポート設定の読み込みに失敗:', err);
      });
  }, []);

  const fetchPreview = useCallback(
    async (spreadsheetId: string, sourceLabel: string) => {
      setLoading(true);
      try {
        const result = await importNotesPreview(spreadsheetId);

        if (result.total_notes === 0) {
          toast.info(`${sourceLabel}: 未処理のノートはありません`);
          return;
        }

        setPreview(result);
        setPreviewSourceLabel(sourceLabel);
        setPreviewOpen(true);

        toast.success(`${sourceLabel}: ${result.total_notes}件のノートを読み取りました`);
      } catch (err) {
        if (err instanceof OptimizeApiError) {
          toast.error(`${sourceLabel}: 読み取りエラー: ${err.message}`);
        } else {
          toast.error(`${sourceLabel}: ノートの読み取りに失敗しました`);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** ソース選択して取込 */
  const handleSourceClick = useCallback(
    (source: ImportSource) => {
      fetchPreview(source.spreadsheet_id, source.label);
    },
    [fetchPreview],
  );

  /** 設定ダイアログを開く */
  const openSettings = useCallback(
    (key: ImportSourceKey) => {
      setEditingSourceKey(key);
      const existing = sources.find((s) => s.key === key);
      setSpreadsheetInput(existing?.spreadsheet_id ?? '');
      setSettingsOpen(true);
    },
    [sources],
  );

  /** 設定ダイアログから保存 */
  const handleSave = useCallback(async () => {
    const id = extractSpreadsheetId(spreadsheetInput);
    if (!id) {
      toast.error('スプレッドシートIDまたはURLを入力してください');
      return;
    }

    try {
      await saveImportSource(editingSourceKey, id);
      const label = IMPORT_SOURCE_LABELS[editingSourceKey];
      // ローカルステートを更新
      setSources((prev) => {
        const filtered = prev.filter((s) => s.key !== editingSourceKey);
        return [...filtered, { key: editingSourceKey, label, spreadsheet_id: id }];
      });
      setSettingsOpen(false);
      toast.success(`${label}の設定を保存しました`);
      fetchPreview(id, label);
    } catch {
      toast.error('設定の保存に失敗しました');
    }
  }, [spreadsheetInput, editingSourceKey, fetchPreview]);

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

        if (result.applied_count > 0 && result.marked_count === 0) {
          toast.warning(
            'スプレッドシートの対応可否更新に失敗しました。次回取込で重複する場合があります。',
          );
        }

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

  const configuredSources = sources.filter((s) => s.spreadsheet_id);
  const hasAnySources = configuredSources.length > 0;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* メインボタン: 設定済みソースが1つなら即取込、複数ならドロップダウン */}
        {hasAnySources && configuredSources.length === 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSourceClick(configuredSources[0])}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            {loading ? '読み取り中...' : `${configuredSources[0].label}取込`}
          </Button>
        ) : hasAnySources ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                {loading ? '読み取り中...' : 'ノート取込'}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {configuredSources.map((source) => (
                <DropdownMenuItem
                  key={source.key}
                  onClick={() => handleSourceClick(source)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {source.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openSettings('cura_note')}
            disabled={loading}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            ノート取込
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => openSettings('cura_note')}
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
              各ソースのスプレッドシートIDまたはURLを設定してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* ソース選択タブ */}
            <div className="flex gap-1">
              {SOURCE_KEYS.map((key) => (
                <Button
                  key={key}
                  variant={editingSourceKey === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setEditingSourceKey(key);
                    const existing = sources.find((s) => s.key === key);
                    setSpreadsheetInput(existing?.spreadsheet_id ?? '');
                  }}
                >
                  {IMPORT_SOURCE_LABELS[key]}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="spreadsheet-input">
                {IMPORT_SOURCE_LABELS[editingSourceKey]}のスプレッドシート ID / URL
              </Label>
              <Input
                id="spreadsheet-input"
                placeholder="https://docs.google.com/spreadsheets/d/... または ID"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
              />
              {sources.find((s) => s.key === editingSourceKey)?.spreadsheet_id && (
                <p className="text-xs text-muted-foreground">
                  現在の設定: {sources.find((s) => s.key === editingSourceKey)!.spreadsheet_id}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>
              保存して取込
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* プレビューダイアログ */}
      <NoteImportPreview
        key={preview?.spreadsheet_id ?? ''}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        loading={applyLoading}
        onApply={handleApply}
        sourceLabel={previewSourceLabel}
      />
    </>
  );
}
