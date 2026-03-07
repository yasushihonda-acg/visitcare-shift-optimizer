'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { sendChatReminder, OptimizeApiError } from '@/lib/api/optimizer';
import { toast } from 'sonner';
import type { Helper } from '@/types';

interface ChatReminderDialogProps {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  helpers: Map<string, Helper>;
  unsubmittedStaffIds: Set<string>;
}

export function ChatReminderDialog({
  open,
  onClose,
  weekStart,
  helpers,
  unsubmittedStaffIds,
}: ChatReminderDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // email を持つスタッフのみ対象
  const eligibleStaff = useMemo(() => {
    return Array.from(helpers.values())
      .filter((h) => h.email)
      .sort((a, b) => {
        // 未提出者を先に表示
        const aUnsub = unsubmittedStaffIds.has(a.id) ? 0 : 1;
        const bUnsub = unsubmittedStaffIds.has(b.id) ? 0 : 1;
        if (aUnsub !== bUnsub) return aUnsub - bUnsub;
        return a.name.family.localeCompare(b.name.family, 'ja') ||
          a.name.given.localeCompare(b.name.given, 'ja');
      });
  }, [helpers, unsubmittedStaffIds]);

  // ダイアログを開くたびに未提出者を自動選択
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const autoSelected = new Set(
        eligibleStaff
          .filter((h) => unsubmittedStaffIds.has(h.id))
          .map((h) => h.id)
      );
      setSelected(autoSelected);
    }
    if (!isOpen) onClose();
  };

  const toggleStaff = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === eligibleStaff.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleStaff.map((h) => h.id)));
    }
  };

  const handleSend = async () => {
    const targets = eligibleStaff
      .filter((h) => selected.has(h.id))
      .map((h) => ({
        staff_id: h.id,
        name: `${h.name.family} ${h.name.given}`,
        email: h.email!,
      }));

    if (targets.length === 0) return;

    setSending(true);
    try {
      const result = await sendChatReminder({
        target_week_start: weekStart,
        targets,
      });
      const failed = result.results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success(`Chat催促送信完了: ${result.messages_sent}名に送信しました`);
      } else {
        toast.warning(
          `${result.messages_sent}名に送信、${failed.length}名は失敗しました`
        );
      }
      onClose();
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        toast.error(`送信エラー: ${err.message}`);
      } else {
        toast.error('Chat催促の送信に失敗しました');
      }
    } finally {
      setSending(false);
    }
  };

  const noEmailStaff = Array.from(helpers.values()).filter(
    (h) => !h.email && unsubmittedStaffIds.has(h.id)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md">
        <DialogHeader>
          <DialogTitle>
            <MessageSquare className="inline mr-2 h-5 w-5" />
            Chat催促を送信
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {weekStart}週 の希望休が未提出のスタッフにGoogle Chat DMを送信します。
        </p>

        <div className="flex items-center justify-between border-b pb-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={selected.size === eligibleStaff.length && eligibleStaff.length > 0}
              onCheckedChange={toggleAll}
            />
            全選択（{selected.size}/{eligibleStaff.length}）
          </label>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {eligibleStaff.map((h) => {
            const isUnsub = unsubmittedStaffIds.has(h.id);
            return (
              <label
                key={h.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(h.id)}
                  onCheckedChange={() => toggleStaff(h.id)}
                />
                <span className="text-sm flex-1">
                  {h.name.family} {h.name.given}
                </span>
                {isUnsub && (
                  <span className="text-xs text-destructive font-medium">未提出</span>
                )}
                {!isUnsub && (
                  <span className="text-xs text-muted-foreground">提出済</span>
                )}
              </label>
            );
          })}
          {eligibleStaff.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              メールアドレスが登録されたスタッフがいません
            </p>
          )}
        </div>

        {noEmailStaff.length > 0 && (
          <p className="text-xs text-amber-600">
            {noEmailStaff.map((h) => `${h.name.family} ${h.name.given}`).join('、')}
            はメールアドレス未登録のため送信できません
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={sending}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || selected.size === 0}
          >
            {sending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="mr-1 h-4 w-4" />
            )}
            送信（{selected.size}名）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
