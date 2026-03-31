"""本番データ精度評価: 自動割当 vs 手動割当の一致率を計測

Usage:
    cd optimizer
    python ../scripts/evaluate_accuracy.py [--day monday] [--result /tmp/optimization_result.csv]
"""

import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRODUCTION_DIR = ROOT / "seed" / "data" / "production"
DEFAULT_RESULT = Path("/tmp/optimization_result.csv")


def load_helper_name_to_id() -> dict[str, str]:
    """ヘルパー名(short_name/family_name) → ID のマッピング"""
    mapping: dict[str, str] = {}
    with open(PRODUCTION_DIR / "helpers.csv") as f:
        for row in csv.DictReader(f):
            name = row.get("short_name") or row.get("family_name", "")
            if name:
                mapping[name] = row["id"]
    return mapping


def load_manual_assignments(
    name_to_id: dict[str, str],
) -> dict[str, set[str]]:
    """手動割当を (customer_id, day_of_week, start_time, end_time, service_type) → set[helper_id] で返す"""
    manual: dict[str, set[str]] = {}
    unresolved = 0
    with open(PRODUCTION_DIR / "manual-assignments.csv") as f:
        for row in csv.DictReader(f):
            key = f"{row['customer_id']}|{row['day_of_week']}|{row['start_time']}|{row['end_time']}|{row['service_type']}"
            helpers_str = row.get("assigned_helpers", "")
            helper_ids: set[str] = set()
            for name in helpers_str.split("|"):
                name = name.strip()
                if not name:
                    continue
                hid = name_to_id.get(name)
                if hid:
                    helper_ids.add(hid)
                else:
                    unresolved += 1
            manual[key] = helper_ids
    if unresolved > 0:
        print(f"  (ヘルパー名未解決: {unresolved}件)")
    return manual


def load_auto_assignments(
    result_path: Path,
) -> dict[str, set[str]]:
    """自動割当を (customer_id, day_of_week, start_time, end_time, service_type) → set[helper_id] で返す"""
    auto: dict[str, set[str]] = {}
    with open(result_path) as f:
        for row in csv.DictReader(f):
            key = f"{row['customer_id']}|{row['day_of_week']}|{row['start_time']}|{row['end_time']}|{row['service_type']}"
            staff_ids = set(row["assigned_staff_ids"].split("|")) if row["assigned_staff_ids"] else set()
            auto[key] = staff_ids
    return auto


def evaluate(
    manual: dict[str, set[str]],
    auto: dict[str, set[str]],
    day_filter: str | None = None,
) -> None:
    """精度評価レポートを出力"""
    # フィルタ適用
    if day_filter:
        manual = {k: v for k, v in manual.items() if k.split("|")[1] == day_filter}
        auto = {k: v for k, v in auto.items() if k.split("|")[1] == day_filter}

    all_keys = set(manual.keys()) | set(auto.keys())
    both_keys = set(manual.keys()) & set(auto.keys())

    day_label = day_filter or "全曜日"
    print(f"\n{'='*60}")
    print(f"  精度評価レポート — {day_label}")
    print(f"{'='*60}")

    # カバレッジ
    auto_assigned = sum(1 for k in auto if len(auto[k]) > 0)
    auto_unassigned = sum(1 for k in auto if len(auto[k]) == 0)
    print(f"\n📊 カバレッジ:")
    print(f"  自動割当オーダー数: {len(auto)}")
    print(f"  割当済み: {auto_assigned} ({auto_assigned/max(1,len(auto))*100:.1f}%)")
    print(f"  未割当: {auto_unassigned}")

    # 手動割当との比較（共通キーのみ）
    exact_match = 0
    partial_match = 0
    no_match = 0
    manual_only = 0  # 手動=あり, 自動=なし
    auto_only = 0  # 手動=なし, 自動=あり
    different_helper = 0

    for key in both_keys:
        m_set = manual[key]
        a_set = auto[key]

        if not m_set and not a_set:
            exact_match += 1
        elif m_set == a_set:
            exact_match += 1
        elif m_set and not a_set:
            manual_only += 1
        elif not m_set and a_set:
            auto_only += 1
        elif m_set & a_set:  # 部分一致
            partial_match += 1
        else:
            different_helper += 1

    # 手動にあるが自動にないキー
    manual_not_in_auto = len(set(manual.keys()) - set(auto.keys()))
    auto_not_in_manual = len(set(auto.keys()) - set(manual.keys()))

    total_comparable = len(both_keys)
    print(f"\n🎯 手動割当との一致率 (比較可能: {total_comparable}件):")
    if total_comparable > 0:
        print(f"  完全一致: {exact_match} ({exact_match/total_comparable*100:.1f}%)")
        print(f"  部分一致: {partial_match} ({partial_match/total_comparable*100:.1f}%)")
        print(f"  別ヘルパー: {different_helper} ({different_helper/total_comparable*100:.1f}%)")
        print(f"  手動=あり→自動=なし: {manual_only}")
        print(f"  手動=なし→自動=あり: {auto_only}")

    if manual_not_in_auto or auto_not_in_manual:
        print(f"\n⚠️ キー不一致:")
        print(f"  手動にあるが自動にない: {manual_not_in_auto}")
        print(f"  自動にあるが手動にない: {auto_not_in_manual}")

    # ヘルパー別割当件数
    helper_counts: Counter[str] = Counter()
    for a_set in auto.values():
        for hid in a_set:
            helper_counts[hid] += 1

    if helper_counts:
        counts = sorted(helper_counts.values())
        import statistics
        print(f"\n👥 ワークロード分散:")
        print(f"  ヘルパー数: {len(helper_counts)}")
        print(f"  平均: {statistics.mean(counts):.1f}件")
        print(f"  標準偏差: {statistics.stdev(counts):.1f}" if len(counts) > 1 else "")
        print(f"  範囲: {min(counts)}-{max(counts)}件")
        top5 = helper_counts.most_common(5)
        print(f"  上位5: {', '.join(f'{h}={c}件' for h, c in top5)}")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="精度評価")
    parser.add_argument("--day", default="monday", help="評価対象曜日 (default: monday)")
    parser.add_argument("--result", default=str(DEFAULT_RESULT), help="自動割当結果CSV")
    parser.add_argument("--all-days", action="store_true", help="全曜日を評価")
    args = parser.parse_args()

    result_path = Path(args.result)
    if not result_path.exists():
        print(f"❌ 結果ファイルが見つかりません: {result_path}")
        sys.exit(1)

    print("📂 ヘルパー名→IDマッピング読み込み中...")
    name_to_id = load_helper_name_to_id()
    print(f"  マッピング数: {len(name_to_id)}")

    print("📂 手動割当読み込み中...")
    manual = load_manual_assignments(name_to_id)
    print(f"  手動割当数: {len(manual)}")

    print("📂 自動割当結果読み込み中...")
    auto = load_auto_assignments(result_path)
    print(f"  自動割当数: {len(auto)}")

    if args.all_days:
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in days:
            day_auto = {k: v for k, v in auto.items() if k.split("|")[1] == day}
            if day_auto:
                evaluate(manual, auto, day_filter=day)
        evaluate(manual, auto, day_filter=None)
    else:
        evaluate(manual, auto, day_filter=args.day)


if __name__ == "__main__":
    main()
