import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportButton } from '../ExportButton';

// ── モック ─────────────────────────────────────────────────────

const mockExportReport = vi.fn();
vi.mock('@/lib/api/optimizer', () => ({
  exportReport: (...args: unknown[]) => mockExportReport(...args),
  OptimizeApiError: class OptimizeApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'OptimizeApiError';
    }
  },
}));

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({
    currentUser: { email: 'test@example.com' },
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockExportReport.mockReset();
});

describe('ExportButton', () => {
  const month = new Date('2026-03-01');

  it('初期状態で「Sheetsに出力」と表示される', () => {
    render(<ExportButton month={month} />);
    expect(screen.getByText('Sheetsに出力')).toBeInTheDocument();
  });

  it('aria-labelが設定されている', () => {
    render(<ExportButton month={month} />);
    expect(screen.getByLabelText('Google Sheetsにエクスポート')).toBeInTheDocument();
  });

  it('クリック時にexportReportが呼ばれる', async () => {
    mockExportReport.mockResolvedValue({ spreadsheet_url: 'https://docs.google.com/spreadsheets/test' });
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ExportButton month={month} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockExportReport).toHaveBeenCalledWith({
        year_month: '2026-03',
        user_email: 'test@example.com',
      });
    });

    await waitFor(() => {
      expect(windowOpen).toHaveBeenCalledWith(
        'https://docs.google.com/spreadsheets/test',
        '_blank',
        'noopener,noreferrer',
      );
    });

    windowOpen.mockRestore();
  });

  it('エクスポート失敗時にエラーメッセージが表示される', async () => {
    mockExportReport.mockRejectedValue(new Error('network error'));

    render(<ExportButton month={month} />);
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toHaveTextContent('エクスポートに失敗しました');
  });

  it('ローディング中は「エクスポート中...」と表示されボタンが無効化される', async () => {
    let resolveExport!: (value: unknown) => void;
    mockExportReport.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );

    render(<ExportButton month={month} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('エクスポート中...')).toBeInTheDocument();
    });
    expect(screen.getByRole('button')).toBeDisabled();

    // cleanup
    resolveExport({ spreadsheet_url: 'https://example.com' });
  });
});
