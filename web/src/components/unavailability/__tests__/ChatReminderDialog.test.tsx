import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatReminderDialog } from '../ChatReminderDialog';
import type { Helper } from '@/types';

// Dialog モック
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) => {
    // open 時に onOpenChange(true) を呼ぶ
    if (open) {
      // useEffect 的にコール
      setTimeout(() => onOpenChange(true), 0);
      return <div data-testid="dialog">{children}</div>;
    }
    return null;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/api/optimizer', () => ({
  sendChatReminder: vi.fn(),
  OptimizeApiError: class extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function makeHelper(id: string, family: string, given: string, email?: string): Helper {
  return {
    id,
    name: { family, given },
    qualifications: [],
    can_physical_care: false,
    transportation: 'car' as const,
    weekly_availability: {},
    preferred_hours: { min: 0, max: 40 },
    available_hours: { min: 0, max: 40 },
    customer_training_status: {},
    employment_type: 'part_time' as const,
    gender: 'female' as const,
    email,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeHelperMap(...entries: Helper[]): Map<string, Helper> {
  return new Map(entries.map((h) => [h.id, h]));
}

describe('ChatReminderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display eligible staff with email', async () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', 'tanaka@example.com'),
      makeHelper('h2', '佐藤', '花子', 'sato@example.com'),
      makeHelper('h3', '鈴木', '一郎'), // email なし
    );

    render(
      <ChatReminderDialog
        open={true}
        onClose={() => {}}
        weekStart="2026-03-09"
        helpers={helpers}
        unsubmittedStaffIds={new Set(['h1', 'h3'])}
      />
    );

    // email ありの2名は表示される
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    // email なしの h3 はチェックボックスリストに表示されない
  });

  it('should show warning for staff without email', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', 'tanaka@example.com'),
      makeHelper('h2', '鈴木', '一郎'), // email なし, 未提出
    );

    render(
      <ChatReminderDialog
        open={true}
        onClose={() => {}}
        weekStart="2026-03-09"
        helpers={helpers}
        unsubmittedStaffIds={new Set(['h1', 'h2'])}
      />
    );

    expect(screen.getByText(/鈴木 一郎.*メールアドレス未登録/)).toBeInTheDocument();
  });

  it('should show unsubmitted badge for unsubmitted staff', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', 'tanaka@example.com'),
      makeHelper('h2', '佐藤', '花子', 'sato@example.com'),
    );

    render(
      <ChatReminderDialog
        open={true}
        onClose={() => {}}
        weekStart="2026-03-09"
        helpers={helpers}
        unsubmittedStaffIds={new Set(['h1'])}
      />
    );

    expect(screen.getByText('未提出')).toBeInTheDocument();
    expect(screen.getByText('提出済')).toBeInTheDocument();
  });

  it('should call sendChatReminder on send button click', async () => {
    const { sendChatReminder } = await import('@/lib/api/optimizer');
    const mockSend = vi.mocked(sendChatReminder);
    mockSend.mockResolvedValue({
      messages_sent: 1,
      total_targets: 1,
      results: [{ staff_id: 'h1', email: 'tanaka@example.com', success: true }],
    });

    const onClose = vi.fn();
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎', 'tanaka@example.com'),
    );

    render(
      <ChatReminderDialog
        open={true}
        onClose={onClose}
        weekStart="2026-03-09"
        helpers={helpers}
        unsubmittedStaffIds={new Set(['h1'])}
      />
    );

    // 未提出者は自動選択される → 送信ボタンをクリック
    await waitFor(() => {
      const sendBtn = screen.getByText('送信（1名）');
      expect(sendBtn).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('送信（1名）'));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({
        target_week_start: '2026-03-09',
        targets: [{ staff_id: 'h1', name: '田中 太郎', email: 'tanaka@example.com' }],
      });
    });
  });

  it('should show empty message when no staff have email', () => {
    const helpers = makeHelperMap(
      makeHelper('h1', '田中', '太郎'), // email なし
    );

    render(
      <ChatReminderDialog
        open={true}
        onClose={() => {}}
        weekStart="2026-03-09"
        helpers={helpers}
        unsubmittedStaffIds={new Set(['h1'])}
      />
    );

    expect(screen.getByText('メールアドレスが登録されたスタッフがいません')).toBeInTheDocument();
  });
});
