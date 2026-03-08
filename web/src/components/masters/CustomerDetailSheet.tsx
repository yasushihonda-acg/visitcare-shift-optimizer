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
import type { CustomerDetailViewModel } from './customerDetailViewModel';

interface CustomerDetailSheetProps {
  vm: CustomerDetailViewModel | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
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
  vm,
  open,
  onClose,
  onEdit,
  canEdit,
}: CustomerDetailSheetProps) {
  if (!vm) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto" data-testid="customer-detail-sheet">
        <SheetHeader className="sticky top-0 bg-background z-10 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-lg">{vm.fullName}</SheetTitle>
              {vm.fullKana && (
                <p className="text-sm text-muted-foreground">{vm.fullKana}</p>
              )}
            </div>
            {canEdit && (
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
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* 1. 基本情報 */}
          <section>
            <SectionHeader>基本情報</SectionHeader>
            <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
              {vm.shortName && (
                <InfoRow label="短縮名" value={vm.shortName} />
              )}
              <InfoRow label="住所" value={vm.address} />
              <InfoRow label="サ責" value={vm.serviceManager} />
              {vm.phoneNumber && (
                <InfoRow label="電話番号①" value={vm.phoneNumber} />
              )}
              {vm.phoneNumber2 && (
                <InfoRow label="電話番号②" value={vm.phoneNumber2} />
              )}
              {vm.phoneNote && (
                <InfoRow label="電話備考" value={vm.phoneNote} />
              )}
              <InfoRow label="性別要件" value={vm.genderRequirementLabel} />
              {vm.householdMembers.length > 0 && (
                <InfoRow
                  label="同一世帯"
                  value={
                    <div className="flex flex-wrap gap-1.5">
                      {vm.householdMembers.map((m) => (
                        <Badge key={m.id} variant="outline">
                          {m.name}
                        </Badge>
                      ))}
                    </div>
                  }
                />
              )}
              {vm.facilityMembers.length > 0 && (
                <InfoRow
                  label="同一施設"
                  value={
                    <div className="flex flex-wrap gap-1.5">
                      {vm.facilityMembers.map((m) => (
                        <Badge key={m.id} variant="outline">
                          {m.name}
                        </Badge>
                      ))}
                    </div>
                  }
                />
              )}
            </div>
          </section>

          {/* 2. 連絡先・関連機関（値ありのみ） */}
          {vm.hasContact && (
            <section>
              <SectionHeader>連絡先・関連機関</SectionHeader>
              <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
                {vm.homeCareOffice && (
                  <InfoRow label="担当居宅" value={vm.homeCareOffice} />
                )}
                {vm.careManagerName && (
                  <InfoRow label="ケアマネ" value={vm.careManagerName} />
                )}
                {vm.consultationSupportOffice && (
                  <InfoRow label="相談支援事業所" value={vm.consultationSupportOffice} />
                )}
                {vm.supportSpecialistName && (
                  <InfoRow label="相談支援専門員" value={vm.supportSpecialistName} />
                )}
              </div>
            </section>
          )}

          {/* 3. NG/入れるスタッフ */}
          {(vm.ngStaff.length > 0 || vm.allowedStaff.length > 0) && (
            <section>
              <SectionHeader>NG / 入れるスタッフ</SectionHeader>
              <div className="space-y-2">
                {vm.ngStaff.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">NG</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="ng-staff-badges">
                      {vm.ngStaff.map((s) => (
                        <Badge key={s.id} variant="destructive">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {vm.allowedStaff.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">入れるスタッフ</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="allowed-staff-badges">
                      {vm.allowedStaff.map((s) => (
                        <Badge key={s.id} variant="secondary">
                          {s.name}
                          {s.isPreferred && (
                            <span
                              className="ml-1 text-amber-600"
                              data-testid={`allowed-staff-preferred-${s.id}`}
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
          {vm.weeklyServices.length > 0 && (
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
                    {vm.weeklyServices.flatMap((row) =>
                      row.slots.map((slot, idx) => (
                        <tr key={`${row.day}-${idx}`} className="border-b last:border-0">
                          {idx === 0 && (
                            <td
                              className="p-2 font-medium"
                              rowSpan={row.slots.length}
                            >
                              {row.dayLabel}
                            </td>
                          )}
                          <td className="p-2">{slot.time}</td>
                          <td className="p-2">{slot.serviceLabel}</td>
                          <td className="p-2 text-right">{slot.staffCount}名</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. 不定期パターン（非空時のみ） */}
          {vm.irregularPatterns.length > 0 && (
            <section>
              <SectionHeader>不定期パターン</SectionHeader>
              <div className="space-y-1.5">
                {vm.irregularPatterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="shrink-0">
                      {p.typeLabel}
                    </Badge>
                    <div>
                      <span className="text-muted-foreground">{p.description}</span>
                      {p.activeWeeks && p.activeWeeks.length > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          （第{p.activeWeeks.join('・')}週）
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6. 備考（値ありのみ） */}
          {vm.notes && (
            <section>
              <SectionHeader>備考</SectionHeader>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vm.notes}</p>
            </section>
          )}

          {/* 7. 外部連携ID */}
          {vm.hasExternalIds && (
            <section>
              <SectionHeader>外部連携ID</SectionHeader>
              <div className="space-y-2 rounded-lg border bg-accent/30 p-3">
                {vm.aozoraId && <InfoRow label="あおぞらID" value={vm.aozoraId} />}
              </div>
            </section>
          )}

          {/* 8. メタ情報 */}
          <section>
            <SectionHeader>メタ情報</SectionHeader>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="w-24 shrink-0">作成日時</span>
                <span>{vm.createdAt.toLocaleString('ja-JP')}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-24 shrink-0">更新日時</span>
                <span>{vm.updatedAt.toLocaleString('ja-JP')}</span>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
