'use client';

import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthRole } from '@/lib/auth/AuthProvider';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { updateNotificationSettings } from '@/lib/firestore/settings';
import { Header } from '@/components/layout/Header';
import { AppBreadcrumb } from '@/components/layout/AppBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  const { isAdmin } = useAuthRole();
  const { senderEmail, loading } = useNotificationSettings();
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setInputValue(senderEmail ?? '');
    }
  }, [loading, senderEmail]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings({ sender_email: inputValue });
      toast.success('通知設定を保存しました');
    } catch {
      toast.error('保存に失敗しました。もう一度お試しください');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AppBreadcrumb />
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">設定</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              通知設定
            </CardTitle>
            <CardDescription>
              メール通知に使用する送信元アドレスを設定します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sender-email">送信元メールアドレス</Label>
              {isAdmin ? (
                <Input
                  id="sender-email"
                  type="email"
                  placeholder="noreply@example.com"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={loading || saving}
                />
              ) : (
                <Input
                  id="sender-email"
                  type="email"
                  value={loading ? '読み込み中...' : (senderEmail ?? '未設定')}
                  readOnly
                  disabled
                />
              )}
              <p className="text-sm text-muted-foreground">
                Google Workspace ドメインのメールアドレスを指定してください。
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={handleSave}
                disabled={loading || saving || !inputValue}
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
