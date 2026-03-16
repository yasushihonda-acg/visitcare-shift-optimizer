'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getCompanionCandidates } from '@/lib/companion/filter';
import type { Order, Customer, Helper, TrainingStatus } from '@/types';

const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  not_visited: '未訪問',
  training: '同行研修中',
  independent: '自立',
};

const TRAINING_STATUS_VARIANT: Record<TrainingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_visited: 'outline',
  training: 'destructive',
  independent: 'secondary',
};

interface CompanionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  customer: Customer;
  helpers: Map<string, Helper>;
  onSetCompanion: (helperId: string) => void;
  onRemoveCompanion: () => void;
}

export function CompanionDialog({
  open,
  onOpenChange,
  order,
  customer,
  helpers,
  onSetCompanion,
  onRemoveCompanion,
}: CompanionDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentCompanion = order.companion_staff_id
    ? helpers.get(order.companion_staff_id)
    : null;

  // 「教える方」= 割当済みスタッフから同行者を除いたスタッフ
  const teachingStaff = useMemo(() => {
    return order.assigned_staff_ids
      .filter((id) => id !== order.companion_staff_id)
      .map((id) => helpers.get(id))
      .filter((h): h is Helper => h != null);
  }, [order.assigned_staff_ids, order.companion_staff_id, helpers]);

  const candidates = useMemo(
    () => getCompanionCandidates({ order, customer, helpers }),
    [order, customer, helpers],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.trim().toLowerCase();
    return candidates.filter(
      (h) =>
        h.name.family.toLowerCase().includes(q) ||
        h.name.given.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearch('');
      setSelectedId(null);
    }
    onOpenChange(v);
  };

  const handleConfirm = () => {
    if (selectedId) {
      onSetCompanion(selectedId);
      handleOpenChange(false);
    }
  };

  const handleRemove = () => {
    onRemoveCompanion();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[70vh] max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <Users className="inline-block mr-1.5 h-4 w-4" />
            同行スタッフを選択
          </DialogTitle>
          <DialogDescription>
            研修目的で一時的に同行するスタッフを選択してください
          </DialogDescription>
        </DialogHeader>

        {/* 教える方（担当スタッフ）表示 */}
        {teachingStaff.length > 0 && (
          <div className="rounded-md border p-2 bg-blue-50/50" data-testid="teaching-staff">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">教える方（担当スタッフ）</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {teachingStaff.map((h) => (
                <Badge key={h.id} variant="secondary" className="text-xs">
                  {h.name.family} {h.name.given}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 現在の同行者表示 */}
        {currentCompanion && (
          <div className="flex items-center justify-between rounded-md border p-2 bg-muted/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                現在の同行者: {currentCompanion.name.family} {currentCompanion.name.given}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleRemove}
              data-testid="remove-companion"
            >
              <X className="mr-1 h-3 w-3" />
              解除
            </Button>
          </div>
        )}

        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 候補一覧（単一選択：ラジオ） */}
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.map((h) => {
            const training = h.customer_training_status?.[order.customer_id] as TrainingStatus | undefined ?? null;
            return (
              <label
                key={h.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer ${
                  selectedId === h.id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'
                }`}
              >
                <input
                  type="radio"
                  name="companion"
                  value={h.id}
                  checked={selectedId === h.id}
                  onChange={() => setSelectedId(h.id)}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm">
                  {h.name.family} {h.name.given}
                </span>
                <span className="text-xs text-muted-foreground">
                  {h.qualifications.join(', ') || '-'}
                </span>
                {training && (
                  <Badge variant={TRAINING_STATUS_VARIANT[training]} className="ml-auto text-[10px] px-1.5 py-0">
                    {TRAINING_STATUS_LABELS[training]}
                  </Badge>
                )}
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              候補なし
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
          >
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
