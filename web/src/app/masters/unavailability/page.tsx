'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Search, ChevronLeft, ChevronRight, Mail, Loader2 } from 'lucide-react';
import { format, addDays, addWeeks, subWeeks, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { useHelpers } from '@/hooks/useHelpers';
import { useAuthRole } from '@/lib/auth/AuthProvider';
import { useStaffUnavailability } from '@/hooks/useStaffUnavailability';
import { toast } from 'sonner';
import { notifyUnavailabilityReminder, OptimizeApiError } from '@/lib/api/optimizer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UnavailabilityEditDialog } from '@/components/masters/UnavailabilityEditDialog';
import type { StaffUnavailability } from '@/types';
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_ORDER } from '@/types';

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export default function UnavailabilityPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const { helpers, loading: helpersLoading } = useHelpers();
  const { unavailability, loading: unavailLoading } = useStaffUnavailability(weekStart);
  const { canEditUnavailability, isHelper, helperId } = useAuthRole();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<StaffUnavailability | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);

  const loading = helpersLoading || unavailLoading;

  const filtered = useMemo(() => {
    if (!search.trim()) return unavailability;
    const q = search.trim().toLowerCase();
    return unavailability.filter((u) => {
      const h = helpers.get(u.staff_id);
      if (!h) return false;
      return (
        h.name.family.toLowerCase().includes(q) ||
        h.name.given.toLowerCase().includes(q)
      );
    });
  }, [unavailability, helpers, search]);

  // 希望休を未提出のヘルパー（unavailability に staff_id が存在しないヘルパー）
  const submittedStaffIds = useMemo(
    () => new Set(unavailability.map((u) => u.staff_id)),
    [unavailability],
  );
  const helpersNotSubmitted = useMemo(
    () =>
      Array.from(helpers.values())
        .filter((h) => !submittedStaffIds.has(h.id))
        .map((h) => ({ id: h.id, name: `${h.name.family} ${h.name.given}` })),
    [helpers, submittedStaffIds],
  );

  const handleSendReminder = async () => {
    setReminderSending(true);
    try {
      const result = await notifyUnavailabilityReminder({
        target_week_start: format(weekStart, 'yyyy-MM-dd'),
        helpers_not_submitted: helpersNotSubmitted,
      });
      toast.success(`催促メール送信完了: ${result.emails_sent}名に送信しました`);
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        toast.error(`送信エラー: ${err.message}`);
      } else {
        toast.error('催促メールの送信に失敗しました');
      }
    } finally {
      setReminderSending(false);
    }
  };

  const openNew = () => {
    setEditTarget(undefined);
    setDialogOpen(true);
  };

  const openEdit = (u: StaffUnavailability) => {
    setEditTarget(u);
    setDialogOpen(true);
  };

  const formatSlots = (u: StaffUnavailability) => {
    return u.unavailable_slots.map((slot) => {
      const dayIndex = differenceInCalendarDays(slot.date, weekStart);
      const dayLabel =
        dayIndex >= 0 && dayIndex < 7
          ? DAY_OF_WEEK_LABELS[DAY_OF_WEEK_ORDER[dayIndex]]
          : format(slot.date, 'MM/dd');
      if (slot.all_day) return `${dayLabel}(終日)`;
      return `${dayLabel}(${slot.start_time}〜${slot.end_time})`;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">希望休管理</h2>
        <div className="flex items-center gap-2">
          {canEditUnavailability && helpersNotSubmitted.length > 0 && (
            <Button
              onClick={handleSendReminder}
              size="sm"
              variant="outline"
              disabled={reminderSending}
              title={`${helpersNotSubmitted.length}名に催促メールを送信`}
            >
              {reminderSending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1 h-4 w-4" />
              )}
              催促メール
              <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
                {helpersNotSubmitted.length}
              </span>
            </Button>
          )}
          {(canEditUnavailability || isHelper) && (
            <Button onClick={openNew} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              新規追加
            </Button>
          )}
        </div>
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[200px] text-center">
          {format(weekStart, 'yyyy/MM/dd')}（月）〜{' '}
          {format(addDays(weekStart, 6), 'MM/dd')}（日）
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="スタッフ名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">スタッフ</TableHead>
              <TableHead>不在内容</TableHead>
              <TableHead className="w-48">備考</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {search
                    ? '一致する希望休が見つかりません'
                    : 'この週の希望休はありません'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u, index) => {
                const h = helpers.get(u.staff_id);
                return (
                  <TableRow key={u.id} className={index % 2 === 1 ? 'bg-muted/30' : ''}>
                    <TableCell className="font-medium">
                      {h ? `${h.name.family} ${h.name.given}` : u.staff_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {formatSlots(u).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.notes || '-'}
                    </TableCell>
                    {(canEditUnavailability || (isHelper && u.staff_id === helperId)) && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        全{unavailability.length}件{search && `（表示: ${filtered.length}件）`}
      </p>

      <UnavailabilityEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        unavailability={editTarget}
        helpers={helpers}
        weekStart={weekStart}
      />
    </div>
  );
}
