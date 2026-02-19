'use client';

import { useState, useMemo } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Customer, TrainingStatus } from '@/types';

interface CustomerTrainingStatusEditorProps {
  value: Record<string, TrainingStatus>;
  onChange: (val: Record<string, TrainingStatus>) => void;
  customers: Map<string, Customer>;
}

const STATUS_LABELS: Record<TrainingStatus, string> = {
  training: '同行研修中',
  independent: '独り立ち',
};

export function CustomerTrainingStatusEditor({
  value,
  onChange,
  customers,
}: CustomerTrainingStatusEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TrainingStatus>('training');

  const entries = useMemo(
    () => Object.entries(value).filter(([, status]) => status),
    [value],
  );

  const availableCustomers = useMemo(() => {
    const list = Array.from(customers.values()).filter(
      (c) => !(c.id in value),
    );
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.name.family.toLowerCase().includes(q) ||
        c.name.given.toLowerCase().includes(q),
    );
  }, [customers, value, search]);

  const openDialog = () => {
    setSearch('');
    setSelectedCustomerId('');
    setSelectedStatus('training');
    setDialogOpen(true);
  };

  const addEntry = () => {
    if (!selectedCustomerId) return;
    onChange({ ...value, [selectedCustomerId]: selectedStatus });
    setSelectedCustomerId('');
    setSelectedStatus('training');
    setDialogOpen(false);
  };

  const removeEntry = (customerId: string) => {
    const next = { ...value };
    delete next[customerId];
    onChange(next);
  };

  const updateStatus = (customerId: string, status: TrainingStatus) => {
    onChange({ ...value, [customerId]: status });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">利用者別研修状態</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={openDialog}
        >
          <UserPlus className="mr-1 h-3 w-3" />
          追加
        </Button>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map(([customerId, status]) => {
            const c = customers.get(customerId);
            return (
              <div
                key={customerId}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                <span className="text-sm flex-1">
                  {c ? `${c.name.family} ${c.name.given}` : customerId}
                </span>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    updateStatus(customerId, v as TrainingStatus)
                  }
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">同行研修中</SelectItem>
                    <SelectItem value="independent">独り立ち</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeEntry(customerId)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">未設定</p>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => !v && setDialogOpen(false)}
      >
        <DialogContent className="max-h-[70vh] max-w-sm">
          <DialogHeader>
            <DialogTitle>研修状態を追加</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="利用者名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableCustomers.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer ${
                  selectedCustomerId === c.id
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedCustomerId(c.id)}
              >
                <span className="text-sm">
                  {c.name.family} {c.name.given}
                </span>
              </label>
            ))}
            {availableCustomers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {search ? '該当なし' : '全利用者が設定済みです'}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">研修状態</Label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as TrainingStatus)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">同行研修中</SelectItem>
                <SelectItem value="independent">独り立ち</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={addEntry}
              disabled={!selectedCustomerId}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
