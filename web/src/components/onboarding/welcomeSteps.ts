import {
  Calendar,
  Columns3,
  BarChart3,
  Sparkles,
  GripVertical,
  AlertCircle,
  Users,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WelcomeStep {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  details: string[];
}

export const welcomeSteps: WelcomeStep[] = [
  {
    icon: Calendar,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'スケジュール画面',
    description: '週間シフトをガントチャートで一覧表示します。',
    details: [
      'ヘルパーごとの1日の予定を横軸で確認',
      'バーをクリックでオーダー詳細を表示',
      '週セレクターで表示週を切替',
    ],
  },
  {
    icon: Columns3,
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-500',
    title: '曜日タブ',
    description: '月〜日の各曜日をタブで切り替えます。',
    details: [
      '各タブにオーダー件数バッジを表示',
      'タブ切替でガントチャートが即座に更新',
    ],
  },
  {
    icon: BarChart3,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    title: '統計バー',
    description: '割当率や制約違反数をリアルタイムで確認できます。',
    details: [
      '割当率・違反数・総オーダー数を表示',
      'データ変更時に自動で再計算',
    ],
  },
  {
    icon: Sparkles,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    title: 'AI最適化',
    description: 'ボタン一つでAIがシフトを自動最適化します。',
    details: [
      '「AI最適化」ボタンで実行',
      '移動時間・スキル・希望休を考慮',
      '結果はガントチャートに即反映',
    ],
  },
  {
    icon: GripVertical,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    title: 'ドラッグ＆ドロップ',
    description: 'オーダーをドラッグして担当ヘルパーを手動変更できます。',
    details: [
      'バーを掴んで別のヘルパー行へ移動',
      '制約違反があればリアルタイムで警告',
    ],
  },
  {
    icon: AlertCircle,
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
    title: '未割当オーダー',
    description: '担当者が未定のオーダーを画面下部に表示します。',
    details: [
      '未割当エリアからヘルパー行へD&Dで割当',
      'AI最適化で一括割当も可能',
    ],
  },
  {
    icon: Users,
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    title: 'マスタ管理',
    description: '利用者・ヘルパー・希望休の各マスタを管理します。',
    details: [
      'ヘッダーの⚙メニューからアクセス',
      '利用者・ヘルパー情報の編集',
      '希望休（公休・有休）の登録',
    ],
  },
  {
    icon: History,
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-500',
    title: '実行履歴',
    description: 'AI最適化の実行履歴を確認できます。',
    details: [
      '過去の最適化結果を一覧表示',
      '成功/失敗ステータスと処理時間を確認',
    ],
  },
];
