# Firestore スキーマ定義

## コレクション一覧

| コレクション | ドキュメント数（Seed） | 説明 |
|-------------|---------------------|------|
| `service_types` | 8 | サービス種別マスタ |
| `customers` | 50 | 利用者マスタ |
| `helpers` | 20 | ヘルパー/スタッフマスタ |
| `orders` | ~160/週 | 個別サービスオーダー |
| `travel_times` | ~2,550 | 拠点間移動時間キャッシュ |
| `staff_unavailability` | 随時 | スタッフ希望休 |

---

## service_types

サービス種別マスタ。ドキュメントID = `code` フィールドと同一。

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| code | string | Yes | 種別コード（英小文字・アンダースコア）。ドキュメントIDと同一 |
| label | string | Yes | 表示名（例: 身体介護） |
| short_label | string | Yes | 短縮名（例: 身体）。ガントチャート・バッジ等で使用 |
| requires_physical_care_cert | boolean | Yes | true の場合、割当ヘルパーは `can_physical_care=true` が必要 |
| sort_order | number (int) | Yes | 表示順（1始まり） |
| created_at | Timestamp | Yes | 作成日時 |
| updated_at | Timestamp | Yes | 更新日時 |

### 初期データ（8種）

| code | label | short_label | requires_cert | sort_order |
|------|-------|-------------|:-------------:|:----------:|
| physical_care | 身体介護 | 身体 | ✓ | 1 |
| daily_living | 生活援助 | 生活 | - | 2 |
| mixed | 混合（身体+生活） | 混合 | ✓ | 3 |
| prevention | 介護予防 | 予防 | - | 4 |
| private | 自費サービス | 自費 | - | 5 |
| disability | 障がい福祉サービス | 障がい | - | 6 |
| transport_support | 移動支援 | 移動 | - | 7 |
| severe_visiting | 重度訪問介護 | 重度 | ✓ | 8 |

### セキュリティルール

- read: 認証済みユーザー全員
- create/update: admin のみ（デモモードは全員可）
- delete: 禁止（常に false）

---

## customers

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | `{ family: string, given: string }` | Yes | 利用者氏名 |
| address | string | Yes | 住所 |
| location | `{ lat: number, lng: number }` | Yes | 座標 |
| ng_staff_ids | string[] | Yes | NGスタッフID一覧 |
| preferred_staff_ids | string[] | Yes | 推奨スタッフID一覧 |
| weekly_services | `Record<DayOfWeek, ServiceSlot[]>` | Yes | 曜日別サービス枠 |
| household_id | string | No | 同一世帯ID（連続訪問用） |
| irregular_patterns | IrregularPattern[] | No | 不定期パターン |
| service_manager | string | Yes | 担当サ責名 |
| gender_requirement | `'any' \| 'female' \| 'male'` | No | スタッフ性別要件（省略時は `any`） |
| kaiso_id | string | No | 介ソルID |
| karakara_id | string | No | カカラID |
| cura_id | string | No | CURA ID |
| aozora_id | string | No | あおぞらID |
| phone_number | string | No | 電話番号 |
| home_care_office | string | No | 担当居宅 |
| consultation_support_office | string | No | 相談支援事業所 |
| care_manager_name | string | No | 担当ケアマネ |
| support_specialist_name | string | No | 相談支援専門員 |
| notes | string | No | 備考 |
| created_at | Timestamp | Yes | 作成日時 |
| updated_at | Timestamp | Yes | 更新日時 |

### ServiceSlot

| フィールド | 型 | 説明 |
|-----------|-----|------|
| start_time | string (HH:MM) | 開始時刻 |
| end_time | string (HH:MM) | 終了時刻 |
| service_type | `'physical_care' \| 'daily_living' \| 'mixed' \| 'prevention' \| 'private' \| 'disability' \| 'transport_support' \| 'severe_visiting'` | サービス種別 |
| staff_count | number | 必要スタッフ数 |

---

## helpers

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | `{ family, given, short? }` | Yes | スタッフ氏名 |
| qualifications | string[] | Yes | 資格一覧 |
| can_physical_care | boolean | Yes | 身体介護可否 |
| transportation | `'car' \| 'bicycle' \| 'walk'` | Yes | 移動手段 |
| weekly_availability | `Record<DayOfWeek, AvailabilitySlot[]>` | Yes | 曜日別勤務可能時間 |
| preferred_hours | `{ min, max }` | Yes | 希望勤務時間（時/週） |
| available_hours | `{ min, max }` | Yes | 対応可能時間（時/週） |
| customer_training_status | `Record<string, TrainingStatus>` | Yes | 利用者別研修状態 |
| employment_type | `'full_time' \| 'part_time'` | Yes | 雇用形態 |
| gender | `'male' \| 'female'` | Yes | 性別 |
| split_shift_allowed | boolean | No | 分断勤務可（午前・午後の非連続勤務） |
| employee_number | string | No | 社員番号 |
| address | string | No | 住所（テキスト） |
| location | `{ lat: number, lng: number }` | No | 座標（ジオコーディング） |
| phone_number | string | No | 電話番号 |
| created_at | Timestamp | Yes | 作成日時 |
| updated_at | Timestamp | Yes | 更新日時 |

---

## orders

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| customer_id | string | Yes | 利用者ID |
| week_start_date | Timestamp | Yes | 週の開始日（月曜） |
| date | Timestamp | Yes | サービス実施日 |
| start_time | string (HH:MM) | Yes | 開始時刻 |
| end_time | string (HH:MM) | Yes | 終了時刻 |
| service_type | `'physical_care' \| 'daily_living' \| 'mixed' \| 'prevention' \| 'private' \| 'disability' \| 'transport_support' \| 'severe_visiting'` | Yes | サービス種別 |
| assigned_staff_ids | string[] | Yes | 割当スタッフID |
| staff_count | number | No | 必要スタッフ数（省略時は1。ServiceSlot.staff_count からも導出可能） |
| status | `'pending' \| 'assigned' \| 'completed' \| 'cancelled'` | Yes | ステータス |
| linked_order_id | string | No | 連続訪問リンク先オーダーID |
| manually_edited | boolean | Yes | 手動編集フラグ |
| created_at | Timestamp | Yes | 作成日時 |
| updated_at | Timestamp | Yes | 更新日時 |

### 状態遷移

```
pending → assigned（最適化エンジンによる割当）
assigned → completed（サービス完了）
assigned → cancelled（キャンセル）
pending → cancelled（キャンセル）
```

---

## travel_times

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from_location | `{ lat, lng }` | Yes | 出発地座標 |
| to_location | `{ lat, lng }` | Yes | 到着地座標 |
| travel_time_minutes | number | Yes | 移動時間（分） |
| distance_meters | number | Yes | 距離（m） |
| source | `'dummy' \| 'google_maps'` | Yes | データソース |
| cached_at | Timestamp | Yes | キャッシュ日時 |

**ドキュメントID形式**: `from_{fromId}_to_{toId}`

---

## staff_unavailability

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| staff_id | string | Yes | スタッフID |
| week_start_date | Timestamp | Yes | 対象週の開始日 |
| unavailable_slots | UnavailableSlot[] | Yes | 不在枠一覧 |
| notes | string | No | 備考 |
| submitted_at | Timestamp | Yes | 申請日時 |

### UnavailableSlot

| フィールド | 型 | 説明 |
|-----------|-----|------|
| date | Timestamp | 対象日 |
| all_day | boolean | 終日休みか |
| start_time | string (HH:MM) | 不在開始（all_day=false時） |
| end_time | string (HH:MM) | 不在終了（all_day=false時） |

---

## クエリパターン

### 最適化エンジン（週次バッチ）

```typescript
// 対象週のオーダー一覧
db.collection('orders')
  .where('week_start_date', '==', targetWeekStart)
  .where('status', 'in', ['pending', 'assigned'])

// 利用者のオーダー一覧
db.collection('orders')
  .where('customer_id', '==', customerId)
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)

// スタッフの希望休
db.collection('staff_unavailability')
  .where('staff_id', '==', staffId)
  .where('week_start_date', '==', targetWeekStart)

// 移動時間の取得
db.collection('travel_times')
  .doc(`from_${fromId}_to_${toId}`)
```

### 複合インデックス（firestore.indexes.json）

| コレクション | フィールド |
|-------------|-----------|
| orders | (week_start_date ASC, status ASC) |
| orders | (customer_id ASC, date ASC) |
| staff_unavailability | (staff_id ASC, week_start_date ASC) |
