# CURAノート → Firestore マッピング定義

## ソース: CURAノート スプレッドシート

スプレッドシートID: `1fj2Hj-ZSkLR0GsNylXu3HFZ55Y_a-pqfiV1Sq-U84G0`

### シート構成

| シート名 | 説明 |
|---------|------|
| `NOTE` | 未処理ノート（`対応可否=0`の行が対象） |
| `NOTE_COMPLETE` | 処理済みノート（`対応可否=1`） |

### 列マッピング

| 列名 | 型 | 必須 | マッピング先 | 説明 |
|------|-----|------|------------|------|
| `対応可否` | number | ○ | （フィルタ条件） | 0=未処理, 1=処理済み |
| `コメント` | text | - | （処理メモ） | サ責の対応コメント |
| `週間スケジュール反映` | text | - | （処理状態） | 反映済みかどうかのメモ |
| `連絡要否` | text | - | `NoteRow.contact_required` | "要連絡" / "連絡不要" / "ー" |
| `スケジュール変更内容` | text | ○ | `NoteRow.content` → パーサーで解析 | 自由テキスト（後述） |
| `入退院・その他` | text | ○ | `NoteRow.sub_category` | アクション種別のヒント |
| `日付：From` | date | ○ | `NoteRow.date_from` | YYYY-MM-DD |
| `日付：To` | date | - | `NoteRow.date_to` | YYYY-MM-DD（空=単日） |
| `カテゴリー` | text | - | `NoteRow.category` | "未来のシフトに関連すること" 等 |
| `入力者（ヘルパー）` | text | - | `NoteRow.author` | 入力者名 |
| `TimeStamp` | datetime | - | `NoteRow.timestamp` | YYYY/MM/DD HH:MM:SS |
| `投稿ID` | text | ○ | `NoteRow.post_id` | CURAの一意ID |

---

## テキスト解析ルール

### 利用者名の抽出

`スケジュール変更内容` の先頭行から利用者名を抽出する。

**パターン**: `^(.+?)様`

**例**:
- `田實朝子様(武、ヘルパー様へ要連絡)` → `田實朝子`
- `末永智美様(連絡不要)` → `末永智美`
- `★★ヘルパー欠勤情報★★\n永田 由香里ヘルパー` → ヘルパー名として `永田 由香里`

### 施設名の抽出

利用者名の直後の括弧内から施設名を抽出する。

**パターン**: `様\((.+?)(?:、|へ|様)`

**例**:
- `田實朝子様(武、ヘルパー様へ要連絡)` → 施設: `武`
- `濵田博子様(七福、ヘルパー様へ要連絡)` → 施設: `七福`
- `日髙定造様(田上、ヘルパー様へ要連絡)` → 施設: `田上`
- `末永智美様(連絡不要)` → 施設: なし（自宅）
- `末永智美様(ご本人様へ要連絡)` → 施設: なし（自宅）

### アクション種別の判定

`入退院・その他` 列と `スケジュール変更内容` のキーワードで判定する。

| 優先度 | 条件 | アクション | Firestore操作 |
|--------|------|----------|--------------|
| 1 | sub_category = `ヘルパーの休み` | `staff_unavailability` | staff_unavailabilityコレクションに登録 |
| 2 | sub_category = `入院及び中止` | `cancel` | order.status = "cancelled" |
| 3 | content に `キャンセル` | `cancel` | order.status = "cancelled" |
| 4 | content に `→` + 時刻パターン | `update_time` | order.start_time/end_time 更新 |
| 5 | content に `時間変更` | `update_time` | order.start_time/end_time 更新 |
| 6 | sub_category = `担当者会議` | `add_meeting` | 新規orderドキュメント（service_type=meeting） |
| 7 | content に `受診同行` or `受診` | `add_visit` | 新規orderドキュメント（service_type=hospital_visit） |
| 8 | content に `追加` or `新規` | `add` | 新規orderドキュメント |
| 9 | 上記いずれにも該当しない | `unknown` | 手動対応（UIで表示のみ） |

### 時刻の抽出

`スケジュール変更内容` から時刻を抽出する。

**パターン**:
- `(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})` — 開始〜終了
- `(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})` — 開始-終了
- `(\d{1,2}):(\d{2})[-〜～]` — 開始のみ
- `(\d{1,2})時(\d{2})分` — 漢字表記

**例**:
- `9:00〜12:00` → start=09:00, end=12:00
- `22:00- → 19:00-21:30へ時間変更` → 旧: 22:00-, 新: 19:00-21:30
- `13時発` → start=13:00

---

## Firestore マッチングルール

### 利用者の特定

ノートの利用者名 → Firestoreの`customers`コレクション

1. `customer.name.family` + `customer.name.given` の完全一致
2. `customer.name.short` の完全一致（短縮名）
3. `customer.name.family_kana` + `customer.name.given_kana` のカナ一致
4. 上記いずれも一致しない → `unmatched`（手動マッチング）

### オーダーの特定

利用者 + 日付 + 時間帯 → Firestoreの`orders`コレクション

1. `customer_id` + `date` の一致するオーダーを検索
2. 時刻が指定されている場合: `start_time` が一致 or 近いオーダーを選択
3. 複数候補がある場合: 時間帯の重複度でランキング
4. 一致なし → 新規オーダー候補として提示

---

## データフロー

```
NOTE シート (対応可否=0)
    ↓ sheets_reader.py
NoteRow[] (Pydantic)
    ↓ note_parser.py
ParsedNote[] (利用者名, アクション種別, 時刻, 日付)
    ↓ note_diff.py (+ Firestore既存データ)
NoteImportAction[] (add/update/delete/unknown + マッチしたorder)
    ↓ API response
NoteImportPreview (フロントエンドで表示)
    ↓ ユーザー確認
Firestore反映 + NOTEシートの対応可否を1に更新
```
