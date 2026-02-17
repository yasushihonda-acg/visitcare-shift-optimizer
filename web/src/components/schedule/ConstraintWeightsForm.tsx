'use client';

import { HelpCircle, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface ConstraintWeights {
  w_travel: number;
  w_preferred_staff: number;
  w_workload_balance: number;
  w_continuity: number;
}

export const DEFAULT_WEIGHTS: ConstraintWeights = {
  w_travel: 1.0,
  w_preferred_staff: 5.0,
  w_workload_balance: 10.0,
  w_continuity: 3.0,
};

const WEIGHT_CONFIG = [
  {
    key: 'w_travel' as const,
    label: '移動時間最小化',
    description: 'ヘルパーの移動時間を短くします',
  },
  {
    key: 'w_preferred_staff' as const,
    label: '推奨スタッフ優先',
    description: '推奨スタッフへの割当を優先します',
  },
  {
    key: 'w_workload_balance' as const,
    label: '稼働バランス',
    description: 'ヘルパー間の稼働時間を均等にします',
  },
  {
    key: 'w_continuity' as const,
    label: '担当継続性',
    description: '同じ利用者に同じヘルパーを割り当てます',
  },
];

const HARD_CONSTRAINTS = [
  { name: '資格要件', description: '必要な資格を持つヘルパーのみ割当可能' },
  { name: '勤務時間枠', description: 'ヘルパーの勤務可能時間内のみ割当' },
  { name: '希望休', description: '希望休の日には割当しない' },
  { name: '同時刻重複禁止', description: '同一ヘルパーを同時刻に複数割当しない' },
  { name: '移動時間確保', description: '連続訪問間に必要な移動時間を確保' },
  { name: '性別制限', description: '利用者の性別制限を遵守' },
  { name: '必要人数', description: 'オーダーの必要人数分のヘルパーを割当' },
  { name: 'NGスタッフ', description: 'NGスタッフは割当対象外' },
];

interface ConstraintWeightsFormProps {
  weights: ConstraintWeights;
  onChange: (weights: ConstraintWeights) => void;
}

export function ConstraintWeightsForm({ weights, onChange }: ConstraintWeightsFormProps) {
  const isDefault = WEIGHT_CONFIG.every(
    (c) => weights[c.key] === DEFAULT_WEIGHTS[c.key]
  );

  return (
    <div className="space-y-3">
      {/* 制約の解説 */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="h-3.5 w-3.5" />
          制約の解説
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-1.5">
              ハード制約（必ず守る）
            </h4>
            <ul className="space-y-1">
              {HARD_CONSTRAINTS.map((c) => (
                <li key={c.name} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.name}</span>
                  {' — '}
                  {c.description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-1.5">
              ソフト制約（重みで調整可）
            </h4>
            <ul className="space-y-1">
              {WEIGHT_CONFIG.map((c) => (
                <li key={c.key} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.label}</span>
                  {' — '}
                  {c.description}
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 詳細設定 */}
      <Collapsible>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
            詳細設定
          </CollapsibleTrigger>
          {!isDefault && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              リセット
            </Button>
          )}
        </div>
        <CollapsibleContent className="mt-3 space-y-4">
          {WEIGHT_CONFIG.map((config) => (
            <div key={config.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{config.label}</label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {weights[config.key].toFixed(1)}
                </span>
              </div>
              <Slider
                value={[weights[config.key]]}
                min={0}
                max={20}
                step={0.5}
                onValueChange={([value]) =>
                  onChange({ ...weights, [config.key]: value })
                }
              />
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
