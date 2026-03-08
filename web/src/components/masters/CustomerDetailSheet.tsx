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
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { DAY_OF_WEEK_ORDER, DAY_OF_WEEK_LABELS } from '@/types';
import type { Customer, Helper } from '@/types';

const GENDER_REQUIREMENT_LABELS: Record<string, string> = {
  any: '指定なし',
  female: '女性のみ',
  male: '男性のみ',
};

const IRREGULAR_PATTERN_LABELS: Record<string, string> = {
  biweekly: '隔週',
  monthly: '月次',
  temporary_stop: '一時停止',
};

interface CustomerDetailSheetProps {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  helpers: Map<string, Helper>;
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

export function CustomerDetailSheet({
  customer,
  open,
  onClose,
  onEdit,
  helpers,
  customers,
}: CustomerDetailSheetProps) {
  const { serviceTypes } = useServiceTypes();

  if (!customer) return null;

  const fullName = `${customer.name.family} ${customer.name.given}`;
  const fullKana =
    customer.name.family_kana || customer.name.given_kana
      ? `${customer.name.family_kana ?? ''} ${customer.name.given_kana ?? ''}`.trim()
      : null;
  const ngHelpers = customer.ng_staff_ids.map((id) => helpers.get(id)).filter(Boolean) as Helper[];
  const allowedHelpers = (customer.allowed_staff_ids ?? [])
    .map((id) => helpers.get(id))
    .filter(Boolean) as Helper[];
  const preferredSet = new Set(customer.preferred_staff_ids);

  const hasContact =
    customer.home_care_office ||
    customer.care_manager_name ||
    customer.consultation_support_office ||
    customer.support_specialist_name;

  const hasExternalIds = !!customer.aozora_id;

  const hasWeeklyServices = DAY_OF_WEEK_ORDER.some(
    (d) => customer.weekly_services[d] && customer.weekly_services[d]!.length > 0
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto" data-testid="customer-detail-sheet">
        <SheetHeader className="sticky top-0 bg-background z-10 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-lg">{fullName}</SheetTitle>
              {fullKana && (
                <p className="text-sm text-muted-foreground">{fullKana}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              data-testid="customer-detail-edit-button"
              className="shrink-0"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              編集
            </Button>
          </div>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* 1. 基本情報 */}
          <section>
            <SectionHeader>基本情報</SectionHeader>
            <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
              {customer.name.short && (
                <InfoRow label="短縮名" value={customer.name.short} />
              )}
              <InfoRow label="住所" value={customer.address} />
              <InfoRow label="サ責" value={customer.service_manager} />
              {customer.phone_number && (
                <InfoRow label="電話番号①" value={customer.phone_number} />
              )}
              {customer.phone_number2 && (
                <InfoRow label="電話番号②" value={customer.phone_number2} />
              )}
              {customer.phone_note && (
                <InfoRow label="電話備考" value={customer.phone_note} />
              )}
              <InfoRow
                label="性別要件"
                value={GENDER_REQUIREMENT_LABELS[customer.gender_requirement ?? 'any'] ?? '指定なし'}
              />
              {customer.same_household_customer_ids?.length > 0 && (
                <InfoRow
                  label="同一世帯"
                  value={
                    <div className="flex flex-wrap gap-1.5">
                      {customer.same_household_customer_ids.map((id) => {
                        const c = customers.get(id);
                        return (
                          <Badge key={id} variant="outline">
                            {c ? `${c.name.family} ${c.name.given}` : id}
                          </Badge>
                        );
                      })}
                    </div>
                  }
                />
              )}
              {customer.same_facility_customer_ids?.length > 0 && (
                <InfoRow
                  label="同一施設"
                  value={
                    <div className="flex flex-wrap gap-1.5">
                      {customer.same_facility_customer_ids.map((id) => {
                        const c = customers.get(id);
                        return (
                          <Badge key={id} variant="outline">
                            {c ? `${c.name.family} ${c.name.given}` : id}
                          </Badge>
                        );
                      })}
                    </div>
                  }
                />
              )}
            </div>
          </section>

          {/* 2. 連絡先・関連機関（値ありのみ） */}
          {hasContact && (
            <section>
              <SectionHeader>連絡先・関連機関</SectionHeader>
              <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
                {customer.home_care_office && (
                  <InfoRow label="担当居宅" value={customer.home_care_office} />
                )}
                {customer.care_manager_name && (
                  <InfoRow label="ケアマネ" value={customer.care_manager_name} />
                )}
                {customer.consultation_support_office && (
                  <InfoRow label="相談支援事業所" value={customer.consultation_support_office} />
                )}
                {customer.support_specialist_name && (
                  <InfoRow label="相談支援専門員" value={customer.support_specialist_name} />
                )}
              </div>
            </section>
          )}

          {/* 3. NG/入れるスタッフ */}
          {(ngHelpers.length > 0 || allowedHelpers.length > 0) && (
            <section>
              <SectionHeader>NG / 入れるスタッフ</SectionHeader>
              <div className="space-y-2">
                {ngHelpers.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">NG</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="ng-staff-badges">
                      {ngHelpers.map((h) => (
                        <Badge key={h.id} variant="destructive">
                          {h.name.family} {h.name.given}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {allowedHelpers.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">入れるスタッフ</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="allowed-staff-badges">
                      {allowedHelpers.map((h) => (
                        <Badge key={h.id} variant="secondary">
                          {h.name.family} {h.name.given}
                          {preferredSet.has(h.id) && (
                            <span
                              className="ml-1 text-amber-600"
                              data-testid={`allowed-staff-preferred-${h.id}`}
                            >
                              ★
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 4. 週間サービス */}
          {hasWeeklyServices && (
            <section>
              <SectionHeader>週間サービス</SectionHeader>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium text-muted-foreground">曜日</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">時間帯</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">種別</th>
                      <th className="p-2 text-right font-medium text-muted-foreground">人数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_OF_WEEK_ORDER.flatMap((day) => {
                      const slots = customer.weekly_services[day];
                      if (!slots || slots.length === 0) return [];
                      return slots.map((slot, idx) => (
                        <tr key={`${day}-${idx}`} className="border-b last:border-0">
                          {idx === 0 && (
                            <td
                              className="p-2 font-medium"
                              rowSpan={slots.length}
                            >
                              {DAY_OF_WEEK_LABELS[day]}
                            </td>
                          )}
                          <td className="p-2">
                            {slot.start_time} - {slot.end_time}
                          </td>
                          <td className="p-2">
                            {serviceTypes.get(slot.service_type)?.label ?? slot.service_type}
                          </td>
                          <td className="p-2 text-right">{slot.staff_count}名</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. 不定期パターン（非空時のみ） */}
          {customer.irregular_patterns && customer.irregular_patterns.length > 0 && (
            <section>
              <SectionHeader>不定期パターン</SectionHeader>
              <div className="space-y-1.5">
                {customer.irregular_patterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="shrink-0">
                      {IRREGULAR_PATTERN_LABELS[p.type] ?? p.type}
                    </Badge>
                    <div>
                      <span className="text-muted-foreground">{p.description}</span>
                      {p.active_weeks && p.active_weeks.length > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          （第{p.active_weeks.join('・')}週）
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6. 備考（値ありのみ） */}
          {customer.notes && (
            <section>
              <SectionHeader>備考</SectionHeader>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
            </section>
          )}

          {/* 7. 外部連携ID */}
          {hasExternalIds && (
            <section>
              <SectionHeader>外部連携ID</SectionHeader>
              <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
                <InfoRow label="あおぞらID" value={customer.aozora_id!} />
              </div>
            </section>
          )}

          {/* 8. メタ情報 */}
          <section>
            <SectionHeader>メタ情報</SectionHeader>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="w-24 shrink-0">作成日時</span>
                <span>{customer.created_at.toLocaleString('ja-JP')}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-24 shrink-0">更新日時</span>
                <span>{customer.updated_at.toLocaleString('ja-JP')}</span>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
