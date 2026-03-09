'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Heart, ArrowLeft, Calendar, MousePointerClick, Wand2, Users, UserCog, CalendarCheck, CalendarOff, BarChart2, Bell, GripVertical, ChevronRight, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Section data                                                       */
/* ------------------------------------------------------------------ */

interface HelpSection {
  id: string;
  Icon: LucideIcon;
  title: string;
  description: string;
  screenshot?: string;
  steps?: { label: string; detail: string }[];
  tips?: string[];
  children?: React.ReactNode;
}

const permissionRows: { label: string; admin: boolean; mgr: boolean; helper: boolean }[] = [
  { label: 'スケジュール閲覧', admin: true, mgr: true, helper: true },
  { label: '最適化実行', admin: true, mgr: true, helper: false },
  { label: '手動割当変更', admin: true, mgr: true, helper: false },
  { label: '利用者マスタ編集', admin: true, mgr: true, helper: false },
  { label: 'ヘルパーマスタ編集', admin: true, mgr: false, helper: false },
  { label: '希望休管理（全員）', admin: true, mgr: true, helper: false },
  { label: '希望休管理（自分のみ）', admin: false, mgr: false, helper: true },
  { label: '実行履歴閲覧', admin: true, mgr: true, helper: true },
];

const sections: HelpSection[] = [
  {
    id: 'schedule',
    Icon: Calendar,
    title: 'スケジュール画面',
    description:
      'メイン画面です。ヘルパーごとのガントチャートで週間シフトを一覧できます。曜日タブで切り替え、統計バーで割当状況を即座に把握できます。',
    screenshot: '/help/01-schedule-main.png',
    steps: [
      { label: '曜日タブ', detail: '月〜日のタブをクリックで曜日を切り替え。バッジにオーダー件数が表示されます。' },
      { label: '統計バー', detail: 'オーダー数・割当率・未割当数・ヘルパー数・制約違反数をリアルタイム表示。' },
      { label: 'ガントチャート', detail: '縦軸がヘルパー、横軸が時間帯。バーの色はサービス種別ごとに異なります。' },
      { label: '未割当セクション', detail: '画面下部に未割当オーダーが一覧表示されます。' },
    ],
    tips: [
      '「日/週」切替で日別・週全体ビューを切り替え',
      '「スタッフ軸/利用者軸」でガントチャートの軸を変更',
      '週セレクターの矢印で前後の週に移動、日付クリックでカレンダーから選択',
    ],
  },
  {
    id: 'order-detail',
    Icon: MousePointerClick,
    title: 'オーダー詳細',
    description:
      'ガントチャート上のオーダーバーをクリックすると、右側に詳細パネルが開きます。割当スタッフの変更やステータス確認ができます。',
    screenshot: '/help/02-order-detail.png',
    steps: [
      { label: '基本情報', detail: '利用者名、時間帯、サービス種別、ステータスを表示。' },
      { label: '割当スタッフ', detail: '「選択」ボタンから割当スタッフを追加・変更。変更は即時保存されます。' },
      { label: '制約違反', detail: '該当オーダーに制約違反がある場合、赤色で表示されます。' },
      { label: '住所', detail: '利用者の住所が表示されます。' },
    ],
  },
  {
    id: 'drag-and-drop',
    Icon: GripVertical,
    title: '手動編集（ドラッグ&ドロップ）',
    description:
      'オーダーバーをドラッグして別のヘルパー行にドロップすると、割当を変更できます。制約チェックはリアルタイムで行われます。',
    steps: [
      { label: 'バーを長押し', detail: 'オーダーバーを5px以上動かすとドラッグ開始。' },
      { label: 'ドロップ先を選択', detail: '緑色のハイライト＝ドロップ可能、赤色＝制約違反で不可。' },
      { label: '即時保存', detail: 'ドロップ後、Firestoreに自動保存されます。' },
    ],
    tips: [
      '元に戻す（Undo）/やり直し（Redo）ボタンで操作を取り消し可能',
      '時間方向へのドラッグで開始・終了時刻も変更できます',
    ],
  },
  {
    id: 'optimization',
    Icon: Wand2,
    title: '最適化の実行',
    description:
      'AI最適化エンジンが移動時間・スタッフ適性・勤務バランスを考慮して自動割当を行います。',
    steps: [
      { label: '「最適化実行」をクリック', detail: 'スケジュール画面右上のボタンから実行ダイアログを開きます。' },
      { label: 'テスト実行 or 本実行', detail: 'テスト実行はDB保存なし（確認用）。本実行はFirestoreに書き戻します。' },
      { label: '詳細設定', detail: '移動時間最小化・推奨スタッフ優先・稼働バランス・担当継続性の重みを調整可能。' },
      { label: '結果確認', detail: '完了後トースト通知が表示され、ガントチャートに反映されます。' },
    ],
    tips: [
      'まずテスト実行で結果を確認し、納得してから本実行がおすすめ',
      '詳細設定のスライダーで最適化の優先度をカスタマイズ可能',
    ],
  },
  {
    id: 'customers',
    Icon: Users,
    title: '利用者マスタ',
    description:
      '利用者の基本情報（氏名・住所・サ責・NG/推奨スタッフ等）を一覧・編集できます。あいうえお順フィルターや検索機能付き。',
    screenshot: '/help/04-customers.png',
    steps: [
      { label: '検索', detail: 'あおぞらID・名前・ふりがな・住所・ケアマネで絞り込み。頭文字フィルターも利用可能。' },
      { label: '新規追加', detail: '右上の「+新規追加」ボタンから登録。' },
      { label: '編集', detail: '行右端の鉛筆アイコンで編集ダイアログを開きます。' },
    ],
  },
  {
    id: 'helpers',
    Icon: UserCog,
    title: 'ヘルパーマスタ',
    description:
      'ヘルパーの資格・雇用形態・身体介護可否・勤務日数・希望時間等を管理します。',
    screenshot: '/help/05-helpers.png',
    steps: [
      { label: '一覧', detail: '氏名、資格、身体介護可否、雇用形態、移動手段、勤務日数、希望時間を表示。' },
      { label: '編集', detail: '鉛筆アイコンから週間勤務可能時間帯や資格情報を編集。' },
    ],
  },
  {
    id: 'weekly-schedule',
    Icon: CalendarCheck,
    title: '基本予定一覧',
    description:
      '利用者ごとの週間サービス予定を一覧表示。曜日・サービス種別・時間帯・合計件数が一目でわかります。',
    screenshot: '/help/06-weekly-schedule.png',
  },
  {
    id: 'unavailability',
    Icon: CalendarOff,
    title: '希望休管理',
    description:
      'スタッフの希望休を週単位で管理します。終日または時間指定で登録でき、Chat催促・メール催促機能も利用可能です。',
    screenshot: '/help/07-unavailability.png',
    steps: [
      { label: '週の切替', detail: '矢印ボタンで対象週を切り替え。' },
      { label: '新規追加', detail: '「+新規追加」からスタッフ・日時・備考を登録。' },
      { label: '催促機能', detail: '未提出スタッフにChat/メールで提出を催促できます。' },
    ],
  },
  {
    id: 'report',
    Icon: BarChart2,
    title: '月次レポート',
    description:
      '月単位の実績サマリーを表示。実績確認率、サービス種別内訳、スタッフ別稼働時間、利用者別サービス実績が確認でき、Google Sheetsへのエクスポートも可能です。',
    screenshot: '/help/09-report.png',
  },
  {
    id: 'settings',
    Icon: Bell,
    title: '通知設定',
    description:
      'メール通知に使用する送信元アドレスを設定します。Google Workspaceドメインのメールアドレスを指定してください。',
    screenshot: '/help/10-settings.png',
  },
  {
    id: 'permissions',
    Icon: ShieldCheck,
    title: '権限について',
    description:
      'ロールによって操作できる範囲が異なります。',
  },
];

/* ------------------------------------------------------------------ */
/*  Table of contents (sidebar nav)                                    */
/* ------------------------------------------------------------------ */

function TableOfContents({ activeId }: { activeId: string }) {
  return (
    <nav className="hidden lg:block sticky top-24 w-56 shrink-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        目次
      </p>
      <ul className="space-y-0.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all duration-200',
                activeId === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <span className="shrink-0 opacity-70"><s.Icon className="h-4 w-4" /></span>
              <span className="truncate">{s.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Permissions table                                                  */
/* ------------------------------------------------------------------ */

function PermissionsTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2.5 pr-4 font-semibold text-foreground">操作</th>
            <th className="py-2.5 px-4 font-semibold text-center text-foreground">管理者</th>
            <th className="py-2.5 px-4 font-semibold text-center text-foreground">サ責</th>
            <th className="py-2.5 px-4 font-semibold text-center text-foreground">ヘルパー</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {permissionRows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-2.5 pr-4 font-medium text-foreground">{row.label}</td>
              <td className="py-2.5 px-4 text-center">{row.admin ? <span className="text-primary font-bold">&#x25CB;</span> : '—'}</td>
              <td className="py-2.5 px-4 text-center">{row.mgr ? <span className="text-primary font-bold">&#x25CB;</span> : '—'}</td>
              <td className="py-2.5 px-4 text-center">{row.helper ? <span className="text-primary font-bold">&#x25CB;</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card component                                             */
/* ------------------------------------------------------------------ */

function SectionCard({ section, index, children }: { section: HelpSection; index: number; children?: React.ReactNode }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-24 animate-[fadeInUp_0.5s_ease-out_both]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="rounded-xl border bg-card shadow-brand-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-primary/[0.04] to-transparent">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <section.Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {section.description}
          </p>

          {/* Screenshot */}
          {section.screenshot && (
            <div className="rounded-lg border overflow-hidden shadow-sm bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={section.screenshot}
                alt={`${section.title}のスクリーンショット`}
                className="w-full h-auto"
                loading={index < 2 ? 'eager' : 'lazy'}
              />
            </div>
          )}

          {/* Steps */}
          {section.steps && section.steps.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-primary" />
                操作手順
              </h3>
              <ol className="space-y-2">
                {section.steps.map((step, i) => (
                  <li key={step.label} className="flex gap-3 items-start">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{step.label}</span>
                      <span className="text-muted-foreground"> — {step.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tips */}
          {section.tips && section.tips.length > 0 && (
            <div className="rounded-lg bg-accent/40 border border-accent px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-accent-foreground">Tips</p>
              <ul className="list-disc list-inside space-y-1">
                {section.tips.map((tip) => (
                  <li key={tip} className="text-sm text-accent-foreground/80">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Custom children (e.g. permissions table) */}
          {children}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HelpPage() {
  const [activeId, setActiveId] = useState(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="bg-gradient-brand text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            スケジュールに戻る
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">VisitCare 使い方ガイド</h1>
              <p className="text-sm text-white/70 mt-0.5">
                訪問介護シフト最適化システムの操作方法をスクリーンショット付きで解説します
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8 flex gap-8">
        <TableOfContents activeId={activeId} />
        <main className="flex-1 min-w-0 space-y-6">
          {sections.map((section, index) => (
            <SectionCard key={section.id} section={section} index={index}>
              {section.id === 'permissions' && <PermissionsTable />}
            </SectionCard>
          ))}

          {/* Footer nav */}
          <div className="text-center py-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              スケジュールに戻る
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
