'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IrregularPatternValue {
  type: 'biweekly' | 'monthly' | 'temporary_stop';
  description: string;
  active_weeks?: number[];
}

interface IrregularPatternEditorProps {
  value: IrregularPatternValue[];
  onChange: (val: IrregularPatternValue[]) => void;
}

const TYPE_LABELS: Record<IrregularPatternValue['type'], string> = {
  biweekly: '隔週',
  monthly: '月N回',
  temporary_stop: '一時中止',
};

const WEEK_LABELS = ['第1週', '第2週', '第3週', '第4週'];

export function IrregularPatternEditor({
  value,
  onChange,
}: IrregularPatternEditorProps) {
  const addPattern = () => {
    onChange([
      ...value,
      { type: 'biweekly', description: '', active_weeks: [0, 2] },
    ]);
  };

  const removePattern = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updatePattern = (index: number, patch: Partial<IrregularPatternValue>) => {
    const next = value.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  };

  const toggleWeek = (index: number, week: number) => {
    const pattern = value[index];
    const current = pattern.active_weeks ?? [];
    const next = current.includes(week)
      ? current.filter((w) => w !== week)
      : [...current, week].sort();
    updatePattern(index, { active_weeks: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">不定期パターン</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={addPattern}
        >
          <Plus className="mr-1 h-3 w-3" />
          追加
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          毎週定期（不定期パターンなし）
        </p>
      )}

      {value.map((pattern, index) => (
        <div
          key={index}
          className="rounded-md border p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Select
              value={pattern.type}
              onValueChange={(v) => {
                const type = v as IrregularPatternValue['type'];
                const patch: Partial<IrregularPatternValue> = { type };
                if (type === 'temporary_stop') {
                  patch.active_weeks = undefined;
                } else if (!pattern.active_weeks) {
                  patch.active_weeks = type === 'biweekly' ? [0, 2] : [0];
                }
                updatePattern(index, patch);
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={pattern.description}
              onChange={(e) =>
                updatePattern(index, { description: e.target.value })
              }
              placeholder="説明（例: 隔週 第1・3週）"
              className="h-8 flex-1 text-sm"
            />

            <button
              type="button"
              onClick={() => removePattern(index)}
              className="rounded-full p-1 hover:bg-muted-foreground/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {pattern.type !== 'temporary_stop' && (
            <div className="flex items-center gap-3 pl-1">
              <span className="text-xs text-muted-foreground">対象週:</span>
              {WEEK_LABELS.map((label, weekIdx) => (
                <label
                  key={weekIdx}
                  className="flex items-center gap-1 text-xs"
                >
                  <Checkbox
                    checked={pattern.active_weeks?.includes(weekIdx) ?? false}
                    onCheckedChange={() => toggleWeek(index, weekIdx)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
