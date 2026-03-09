import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeDialog } from '../WelcomeDialog';
import { welcomeSteps } from '../welcomeSteps';

// ── モック ──────────────────────────────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
    if (open === false) return null;
    return <div data-testid="dialog" data-on-open-change={onOpenChange ? 'true' : undefined}>{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; variant?: string; size?: string; className?: string }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// ── テスト ──────────────────────────────────────────────────────

describe('WelcomeDialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open=falseの場合、ダイアログが表示されない', () => {
    render(<WelcomeDialog open={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('open=trueの場合、ダイアログが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('タイトルが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText('VisitCare シフト最適化の使い方')).toBeInTheDocument();
  });

  it('最初のステップでステップ番号が表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText(`ステップ 1 / ${welcomeSteps.length}`)).toBeInTheDocument();
  });

  it('最初のステップでは「スキップ」ボタンが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText('スキップ')).toBeInTheDocument();
  });

  it('最初のステップでは「次へ」ボタンが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    expect(screen.getByText('次へ')).toBeInTheDocument();
  });

  it('「次へ」をクリックすると次のステップに進む', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('次へ'));
    expect(screen.getByText(`ステップ 2 / ${welcomeSteps.length}`)).toBeInTheDocument();
  });

  it('2番目のステップでは「前へ」ボタンが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('次へ'));
    expect(screen.getByText('前へ')).toBeInTheDocument();
  });

  it('「前へ」をクリックすると前のステップに戻る', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('次へ'));
    expect(screen.getByText(`ステップ 2 / ${welcomeSteps.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByText('前へ'));
    expect(screen.getByText(`ステップ 1 / ${welcomeSteps.length}`)).toBeInTheDocument();
  });

  it('最後のステップで「始める」ボタンが表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    // 最後のステップまで進む
    for (let i = 0; i < welcomeSteps.length - 1; i++) {
      fireEvent.click(screen.getByText('次へ'));
    }
    expect(screen.getByText('始める')).toBeInTheDocument();
  });

  it('最後のステップで「始める」をクリックするとonCloseが呼ばれる', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    for (let i = 0; i < welcomeSteps.length - 1; i++) {
      fireEvent.click(screen.getByText('次へ'));
    }
    fireEvent.click(screen.getByText('始める'));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('「スキップ」をクリックするとonCloseが呼ばれる', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('スキップ'));
    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('ドットインジケーターがステップ数分表示される', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    const dots = screen.getAllByRole('button', { name: /ステップ \d+/ });
    expect(dots).toHaveLength(welcomeSteps.length);
  });

  it('ドットインジケーターをクリックすると対応するステップに移動する', () => {
    render(<WelcomeDialog open={true} onClose={mockOnClose} />);
    const dot3 = screen.getByRole('button', { name: 'ステップ 3' });
    fireEvent.click(dot3);
    expect(screen.getByText(`ステップ 3 / ${welcomeSteps.length}`)).toBeInTheDocument();
  });
});
