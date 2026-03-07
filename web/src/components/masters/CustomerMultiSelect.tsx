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
import { Checkbox } from '@/components/ui/checkbox';
import type { Customer } from '@/types';

interface CustomerMultiSelectProps {
  label: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  customers: Map<string, Customer>;
  excludeIds?: string[];
}

export function CustomerMultiSelect({
  label,
  selected,
  onChange,
  customers,
  excludeIds = [],
}: CustomerMultiSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>([]);

  const openDialog = () => {
    setDraft([...selected]);
    setSearch('');
    setDialogOpen(true);
  };

  const toggleCustomer = (id: string) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const confirm = () => {
    onChange(draft);
    setDialogOpen(false);
  };

  const removeCustomer = (id: string) => {
    onChange(selected.filter((x) => x !== id));
  };

  const filteredCustomers = useMemo(() => {
    const list = Array.from(customers.values()).filter(
      (c) => !excludeIds.includes(c.id)
    );
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.name.family.toLowerCase().includes(q) ||
        c.name.given.toLowerCase().includes(q) ||
        (c.name.family_kana?.toLowerCase().includes(q)) ||
        (c.name.given_kana?.toLowerCase().includes(q)) ||
        c.address.toLowerCase().includes(q)
    );
  }, [customers, excludeIds, search]);

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
            const c = customers.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {c ? `${c.name.family} ${c.name.given}` : id}
                <button
                  type="button"
                  onClick={() => removeCustomer(id)}
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

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-h-[70vh] max-w-sm">
          <DialogHeader>
            <DialogTitle>{label}を選択</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="名前・住所で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredCustomers.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={draft.includes(c.id)}
                  onCheckedChange={() => toggleCustomer(c.id)}
                />
                <span className="text-sm">
                  {c.name.family} {c.name.given}
                </span>
                <span className="text-xs text-muted-foreground ml-auto truncate max-w-[150px]">
                  {c.address}
                </span>
              </label>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                該当なし
              </p>
            )}
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
    </div>
  );
}
