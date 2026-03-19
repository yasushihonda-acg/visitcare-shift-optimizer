'use client';

import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';
import { formatFullName } from '@/utils/name';
import type { Helper, Customer, TrainingStatus } from '@/types';

const TRANSPORTATION_LABELS: Record<string, string> = {
  car: '車',
  bicycle: '自転車',
  walk: '徒歩',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: '常勤',
  part_time: '非常勤',
};

const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
};

const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  not_visited: '未訪問',
  training: '同行研修中',
  independent: '自立',
};

const TRAINING_STATUS_VARIANTS: Record<TrainingStatus, 'outline' | 'secondary' | 'default'> = {
  not_visited: 'outline',
  training: 'secondary',
  independent: 'default',
};

interface HelperDetailSheetProps {
  helper: Helper | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
  customers: Map<string, Customer>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function HelperDetailSheet({
  helper,
  open,
  onClose,
  onEdit,
  canEdit,
  customers,
}: HelperDetailSheetProps) {
  if (!helper) return null;

  const fullName = formatFullName(helper.name);

  const hasWeeklyAvailability = DAY_OF_WEEK_ORDER.some(
    (d) => helper.weekly_availability[d] && helper.weekly_availability[d]!.length > 0
  );

  const trainingEntries = Object.entries(helper.customer_training_status);
  const pendingTraining = trainingEntries.filter(([, s]) => s !== 'independent');
  const independentEntries = trainingEntries.filter(([, s]) => s === 'independent');

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto" data-testid="helper-detail-sheet">
        <SheetHeader className="sticky top-0 bg-background z-10 border-b">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-lg">{fullName}</SheetTitle>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                data-testid="helper-detail-edit-button"
                className="shrink-0"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                編集
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* 1. 基本情報 */}
          <section>
            <SectionHeader>基本情報</SectionHeader>
            <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
              {helper.name.short && <InfoRow label="短縮名" value={helper.name.short} />}
              <InfoRow label="性別" value={GENDER_LABELS[helper.gender] ?? helper.gender} />
              {helper.employee_number && (
                <InfoRow label="社員番号" value={helper.employee_number} />
              )}
              {helper.phone_number && (
                <InfoRow label="電話番号" value={helper.phone_number} />
              )}
              {helper.email && (
                <InfoRow label="メールアドレス" value={helper.email} />
              )}
              {helper.address && <InfoRow label="住所" value={helper.address} />}
              <InfoRow
                label="資格"
                value={
                  helper.qualifications.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {helper.qualifications.map((q) => (
                        <Badge key={q} variant="secondary" className="text-xs">
                          {q}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    'なし'
                  )
                }
              />
              <InfoRow
                label="身体介護"
                value={helper.can_physical_care ? '対応可' : '不可'}
              />
              <InfoRow
                label="分断勤務"
                value={helper.split_shift_allowed ? '可' : '不可'}
              />
            </div>
          </section>

          {/* 2. 雇用条件 */}
          <section>
            <SectionHeader>雇用条件</SectionHeader>
            <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
              <InfoRow
                label="雇用形態"
                value={EMPLOYMENT_LABELS[helper.employment_type] ?? helper.employment_type}
              />
              <InfoRow
                label="移動手段"
                value={TRANSPORTATION_LABELS[helper.transportation] ?? helper.transportation}
              />
              <InfoRow
                label="希望時間"
                value={`${helper.preferred_hours.min} 〜 ${helper.preferred_hours.max} 時間/週`}
              />
              <InfoRow
                label="対応可能時間"
                value={`${helper.available_hours.min} 〜 ${helper.available_hours.max} 時間/週`}
              />
            </div>
          </section>

          {/* 3. 週間勤務可能時間 */}
          {hasWeeklyAvailability && (
            <section>
              <SectionHeader>週間勤務可能時間</SectionHeader>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium text-muted-foreground">曜日</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">時間帯</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_OF_WEEK_ORDER.flatMap((day) => {
                      const slots = helper.weekly_availability[day];
                      if (!slots || slots.length === 0) return [];
                      return slots.map((slot, idx) => (
                        <tr key={`${day}-${idx}`} className="border-b last:border-0">
                          {idx === 0 && (
                            <td className="p-2 font-medium" rowSpan={slots.length}>
                              {DAY_OF_WEEK_LABELS[day]}
                            </td>
                          )}
                          <td className="p-2">
                            {slot.start_time} - {slot.end_time}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. 利用者別研修状態 */}
          {trainingEntries.length > 0 && (
            <section>
              <SectionHeader>利用者別研修状態</SectionHeader>
              <div className="space-y-3" data-testid="training-status-list">
                {/* 要対応（研修中・未訪問） */}
                {pendingTraining.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">要対応</p>
                    <div className="space-y-1.5">
                      {pendingTraining.map(([customerId, status]) => {
                        const customer = customers.get(customerId);
                        const displayName = customer
                          ? formatFullName(customer.name)
                          : customerId;
                        return (
                          <div key={customerId} className="flex items-center justify-between text-sm">
                            <span>{displayName}</span>
                            <Badge variant={TRAINING_STATUS_VARIANTS[status as TrainingStatus]}>
                              {TRAINING_STATUS_LABELS[status as TrainingStatus] ?? status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* 自立済み */}
                {independentEntries.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      自立済み（{independentEntries.length}名）
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {independentEntries.map(([customerId]) => {
                        const customer = customers.get(customerId);
                        const displayName = customer
                          ? formatFullName(customer.name)
                          : customerId;
                        return (
                          <Badge key={customerId} variant="default" className="text-xs">
                            {displayName}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5. メタ情報 */}
          <section>
            <SectionHeader>メタ情報</SectionHeader>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="w-24 shrink-0">作成日時</span>
                <span>{helper.created_at.toLocaleString('ja-JP')}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-24 shrink-0">更新日時</span>
                <span>{helper.updated_at.toLocaleString('ja-JP')}</span>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
