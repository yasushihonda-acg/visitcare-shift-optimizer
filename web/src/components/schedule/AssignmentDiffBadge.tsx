'use client';

import { Badge } from '@/components/ui/badge';
import type { Helper } from '@/types';
import type { AssignmentDiff } from '@/hooks/useAssignmentDiff';

interface AssignmentDiffBadgeProps {
  diff: AssignmentDiff;
  helpers: Map<string, Helper>;
}

function staffName(id: string, helpers: Map<string, Helper>): string {
  const h = helpers.get(id);
  return h ? `${h.name.family} ${h.name.given}` : id;
}

export function AssignmentDiffBadge({ diff, helpers }: AssignmentDiffBadgeProps) {
  if (!diff.isChanged) return null;

  const lines: string[] = [];
  if (diff.added.length > 0) {
    lines.push(`追加: ${diff.added.map((id) => staffName(id, helpers)).join(', ')}`);
  }
  if (diff.removed.length > 0) {
    lines.push(`削除: ${diff.removed.map((id) => staffName(id, helpers)).join(', ')}`);
  }

  return (
    <Badge
      variant="outline"
      className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
      title={lines.join(' / ')}
    >
      手動変更
    </Badge>
  );
}
