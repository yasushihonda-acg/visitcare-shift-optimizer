'use client';

import { useState, useMemo } from 'react';
import { X, Search, UserPlus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Helper, Customer, TrainingStatus, GenderRequirement } from '@/types';
import { TRAINING_STATUS_LABELS, TRAINING_STATUS_VARIANT } from '@/lib/labels/training-status';

const GENDER_LABELS: Record<Exclude<GenderRequirement, 'any'>, string> = {
  female: '女性専用',
  male: '男性専用',
};

type StaffGroup = 'preferred' | 'allowed' | 'other';

const GROUP_LABELS: Record<StaffGroup, string> = {
  preferred: '推奨',
  allowed: '対応可能',
  other: 'その他',
};

interface StaffMultiSelectProps {
  label: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  helpers: Map<string, Helper>;
  excludeIds?: string[];
  /** true のとき、選択ボタンとダイアログのみ描画（Badge一覧を非表示にする） */
  triggerOnly?: boolean;
  /** グループ分け・性別フィルタ・訪問実績表示用 */
  customer?: Customer;
}

export function StaffMultiSelect({
  label,
  selected,
  onChange,
  helpers,
  excludeIds = [],
  triggerOnly = false,
  customer,
}: StaffMultiSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>([]);

  const openDialog = () => {
    setDraft([...selected]);
    setSearch('');
    setDialogOpen(true);
  };

  const toggleStaff = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const confirm = () => {
    onChange(draft);
    setDialogOpen(false);
  };

  const removeStaff = (id: string) => {
    onChange(selected.filter((x) => x !== id));
  };

  const filteredHelpers = useMemo(() => {
    let list = Array.from(helpers.values()).filter(
      (h) => !excludeIds.includes(h.id)
    );

    // customer指定時: NGスタッフ除外 + 性別フィルタ
    if (customer) {
      const ngIds = customer.ng_staff_ids ?? [];
      list = list.filter((h) => !ngIds.includes(h.id));
      const gr = customer.gender_requirement;
      if (gr && gr !== 'any') {
        list = list.filter((h) => h.gender === gr);
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) =>
          h.name.family.toLowerCase().includes(q) ||
          h.name.given.toLowerCase().includes(q)
      );
    }

    return list;
  }, [helpers, excludeIds, search, customer]);

  // customer指定時のグループ分けリスト
  const groupedHelpers = useMemo(() => {
    if (!customer) return null;

    const groups: { group: StaffGroup; label: string; items: Helper[] }[] = [];
    const preferredIds = customer.preferred_staff_ids ?? [];
    const allowedIds = customer.allowed_staff_ids ?? [];
    const preferred = filteredHelpers.filter((h) => preferredIds.includes(h.id));
    const hasAllowed = allowedIds.length > 0;

    const sortByName = (a: Helper, b: Helper) =>
      `${a.name.family}${a.name.given}`.localeCompare(`${b.name.family}${b.name.given}`, 'ja');

    if (preferred.length > 0) {
      groups.push({ group: 'preferred', label: GROUP_LABELS.preferred, items: preferred.sort(sortByName) });
    }

    if (hasAllowed) {
      const allowed = filteredHelpers.filter(
        (h) => allowedIds.includes(h.id) && !preferredIds.includes(h.id)
      );
      if (allowed.length > 0) {
        groups.push({ group: 'allowed', label: GROUP_LABELS.allowed, items: allowed.sort(sortByName) });
      }
      const other = filteredHelpers.filter(
        (h) => !allowedIds.includes(h.id) && !preferredIds.includes(h.id)
      );
      if (other.length > 0) {
        groups.push({ group: 'other', label: GROUP_LABELS.other, items: other.sort(sortByName) });
      }
    } else {
      const other = filteredHelpers.filter(
        (h) => !preferredIds.includes(h.id)
      );
      if (other.length > 0) {
        groups.push({ group: 'other', label: GROUP_LABELS.other, items: other.sort(sortByName) });
      }
    }

    return groups;
  }, [customer, filteredHelpers]);

  const genderNote = customer?.gender_requirement && customer.gender_requirement !== 'any'
    ? GENDER_LABELS[customer.gender_requirement]
    : null;

  const renderStaffRow = (h: Helper) => {
    const training = customer
      ? (h.customer_training_status?.[customer.id] as TrainingStatus | undefined) ?? null
      : null;
    return (
      <label
        key={h.id}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
      >
        <Checkbox
          checked={draft.includes(h.id)}
          onCheckedChange={() => toggleStaff(h.id)}
        />
        <span className="text-sm">
          {h.name.family} {h.name.given}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {h.qualifications.join(', ') || '-'}
        </span>
        {training && (
          <Badge variant={TRAINING_STATUS_VARIANT[training]} className="text-[10px] px-1.5 py-0">
            {TRAINING_STATUS_LABELS[training]}
          </Badge>
        )}
      </label>
    );
  };

  const renderStaffList = () => {
    const items = groupedHelpers
      ? groupedHelpers.map(({ group, label: groupLabel, items: groupItems }) => (
          <div key={group}>
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {groupLabel}
            </div>
            {groupItems.map(renderStaffRow)}
          </div>
        ))
      : filteredHelpers.map(renderStaffRow);

    return (
      <>
        {items}
        {filteredHelpers.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            該当なし
          </p>
        )}
      </>
    );
  };

  const dialogBody = (
    <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
      <DialogContent className="max-h-[70vh] max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}を選択</DialogTitle>
          <DialogDescription className="sr-only">チェックボックスで{label}を選択してください</DialogDescription>
        </DialogHeader>

        {genderNote && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 rounded-md px-2.5 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{genderNote}</span>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {renderStaffList()}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(false)}
          >
            キャンセル
          </Button>
          <Button type="button" onClick={confirm}>
            確定（{draft.length}名）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // triggerOnly モードでは選択ボタン + ダイアログのみ描画
  if (triggerOnly) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={openDialog}
        >
          <UserPlus className="mr-1 h-3 w-3" />
          スタッフを選択
        </Button>
        {dialogBody}
      </>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={openDialog}
        >
          <UserPlus className="mr-1 h-3 w-3" />
          選択
        </Button>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => {
            const h = helpers.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {h ? `${h.name.family} ${h.name.given}` : id}
                <button
                  type="button"
                  onClick={() => removeStaff(id)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">未設定</p>
      )}

      {dialogBody}
    </div>
  );
}
