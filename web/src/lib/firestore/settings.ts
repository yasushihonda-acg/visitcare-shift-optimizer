import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

type NotificationSettingsInput = {
  sender_email: string;
};

/**
 * 通知設定を更新する。
 * merge: true により、未指定フィールドは保持される。
 * onSnapshot リスナーが自動でUI反映するため、ローカルstate更新は不要。
 */
export async function updateNotificationSettings(data: NotificationSettingsInput): Promise<void> {
  await setDoc(
    doc(getDb(), 'settings', 'notification'),
    { ...data, updated_at: serverTimestamp() },
    { merge: true }
  );
}
