'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportReport, OptimizeApiError } from '@/lib/api/optimizer';
import { getFirebaseAuth } from '@/lib/firebase';

interface ExportButtonProps {
  month: Date;
}

export function ExportButton({ month }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearMonth = format(month, 'yyyy-MM');

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const userEmail = getFirebaseAuth().currentUser?.email ?? undefined;
      const result = await exportReport({
        year_month: yearMonth,
        user_email: userEmail,
      });

      // 成功時: 新タブでスプレッドシートを開く
      window.open(result.spreadsheet_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (err instanceof OptimizeApiError) {
        setError(err.message);
      } else {
        setError('エクスポートに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2"
        aria-label="Google Sheetsにエクスポート"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {loading ? 'エクスポート中...' : 'Sheetsに出力'}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
