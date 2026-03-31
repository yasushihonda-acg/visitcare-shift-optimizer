"""本番データCSV分析スクリプト

Firestore不要。CSVを直接読んでデータ品質・割当パターンを分析する。

Usage: python scripts/analyze_production_data.py
"""

import csv
from collections import Counter, defaultdict
from pathlib import Path

DATA_DIR = Path("seed/data/production")


def load_csv(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def analyze_data_quality(customers, helpers, services, constraints, availability, assignments):
    section("1. データ品質")

    print(f"\n  顧客: {len(customers)}")
    print(f"  ヘルパー: {len(helpers)}")
    print(f"  週間サービス: {len(services)}")
    print(f"  NG制約: {len(constraints)}")
    print(f"  ヘルパー可用性: {len(availability)}")
    print(f"  手動割当: {len(assignments)}")

    # 空フィールド率（顧客）
    empty_fields = Counter()
    for c in customers:
        for k, v in c.items():
            if not v.strip():
                empty_fields[k] += 1
    print(f"\n  顧客 空フィールド率 (上位5):")
    for field, count in empty_fields.most_common(5):
        print(f"    {field}: {count}/{len(customers)} ({count/len(customers)*100:.0f}%)")

    # ID整合性
    customer_ids = {c["id"] for c in customers}
    helper_ids = {h["id"] for h in helpers}

    svc_orphans = sum(1 for s in services if s["customer_id"] not in customer_ids)
    cst_orphan_c = sum(1 for c in constraints if c["customer_id"] not in customer_ids)
    cst_orphan_h = sum(1 for c in constraints if c["staff_id"] not in helper_ids)

    print(f"\n  ID整合性:")
    print(f"    サービス→顧客 孤立: {svc_orphans}/{len(services)}")
    print(f"    制約→顧客 孤立: {cst_orphan_c}/{len(constraints)}")
    print(f"    制約→ヘルパー 孤立: {cst_orphan_h}/{len(constraints)}")

    # ヘルパー時間の異常値
    print(f"\n  ヘルパー勤務時間（上位5 available_hours_max）:")
    sorted_h = sorted(helpers, key=lambda h: int(h["available_hours_max"] or "0"), reverse=True)
    for h in sorted_h[:5]:
        pmin = h["preferred_hours_min"]
        pmax = h["preferred_hours_max"]
        amax = h["available_hours_max"]
        print(f"    {h['id']} {h['short_name']}: preferred={pmin}-{pmax}, available_max={amax}")


def analyze_assignment_patterns(assignments, helpers, constraints):
    section("2. 手動割当パターン")

    helper_name_to_id = {h["short_name"]: h["id"] for h in helpers}

    # ヘルパー別担当件数
    helper_counts = Counter()
    for a in assignments:
        names = a["assigned_helpers"].split("|")
        for name in names:
            helper_counts[name] += 1

    print(f"\n  ヘルパー別担当件数 (上位10):")
    for name, count in helper_counts.most_common(10):
        hid = helper_name_to_id.get(name, "?")
        print(f"    {name} ({hid}): {count}件")

    print(f"\n  ヘルパー別担当件数 (下位5):")
    for name, count in helper_counts.most_common()[-5:]:
        hid = helper_name_to_id.get(name, "?")
        print(f"    {name} ({hid}): {count}件")

    unmatched = {name for name in helper_counts if name not in helper_name_to_id}
    if unmatched:
        print(f"\n  ⚠ ヘルパーCSVに未登録の名前: {len(unmatched)}")
        for name in sorted(unmatched)[:10]:
            print(f"    {name} ({helper_counts[name]}件)")

    # 曜日分布
    day_counts = Counter(a["day_of_week"] for a in assignments)
    print(f"\n  曜日分布:")
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
        print(f"    {day:>9}: {day_counts.get(day, 0)}")

    # staff_count分布
    sc_counts = Counter(int(a["staff_count"]) for a in assignments)
    print(f"\n  staff_count分布:")
    for sc in sorted(sc_counts):
        print(f"    {sc}人: {sc_counts[sc]}件 ({sc_counts[sc]/len(assignments)*100:.1f}%)")

    # サービス種別分布
    type_counts = Counter(a["service_type"] for a in assignments)
    print(f"\n  サービス種別分布 (上位10):")
    for stype, count in type_counts.most_common(10):
        print(f"    {stype}: {count}件")


def analyze_ng_violations(assignments, constraints, helpers):
    section("3. NG制約チェック")

    helper_name_to_id = {h["short_name"]: h["id"] for h in helpers}

    # NG制約をセットに変換
    ng_pairs = set()
    for c in constraints:
        if c["constraint_type"] == "ng":
            ng_pairs.add((c["customer_id"], c["staff_id"]))

    violations = []
    for a in assignments:
        cid = a["customer_id"]
        names = a["assigned_helpers"].split("|")
        for name in names:
            hid = helper_name_to_id.get(name)
            if hid and (cid, hid) in ng_pairs:
                violations.append({
                    "customer_id": cid,
                    "helper": f"{name}({hid})",
                    "day": a["day_of_week"],
                    "time": f"{a['start_time']}-{a['end_time']}",
                })

    print(f"\n  NG制約数: {len(ng_pairs)}")
    print(f"  手動割当でのNG違反: {len(violations)}件")
    if violations:
        print(f"\n  NG違反例（最大10件）:")
        for v in violations[:10]:
            print(f"    {v['customer_id']} × {v['helper']} ({v['day']} {v['time']})")


def analyze_availability_coverage(assignments, helpers, availability):
    section("4. ヘルパー稼働分析")

    helper_name_to_id = {h["short_name"]: h["id"] for h in helpers}

    # ヘルパー別可用性
    avail_by_helper = defaultdict(list)
    for a in availability:
        avail_by_helper[a["helper_id"]].append(a)

    # ヘルパー別割当時間
    assign_minutes = defaultdict(float)
    for a in assignments:
        names = a["assigned_helpers"].split("|")
        h1, m1 = map(int, a["start_time"].split(":"))
        h2, m2 = map(int, a["end_time"].split(":"))
        duration = (h2 * 60 + m2) - (h1 * 60 + m1)
        for name in names:
            hid = helper_name_to_id.get(name)
            if hid:
                assign_minutes[hid] += duration

    # 可用性があるヘルパーの割当状況
    helpers_with_avail = len(avail_by_helper)
    helpers_with_assign = len(assign_minutes)

    print(f"\n  可用性登録ヘルパー: {helpers_with_avail}/{len(helpers)}")
    print(f"  割当があるヘルパー: {helpers_with_assign}/{len(helpers)}")

    # 週間稼働時間（上位/下位）
    sorted_assign = sorted(assign_minutes.items(), key=lambda x: x[1], reverse=True)
    name_by_id = {h["id"]: h["short_name"] for h in helpers}

    print(f"\n  週間割当時間 (上位5):")
    for hid, minutes in sorted_assign[:5]:
        print(f"    {name_by_id.get(hid, hid)}: {minutes/60:.1f}h")

    print(f"\n  週間割当時間 (下位5):")
    for hid, minutes in sorted_assign[-5:]:
        print(f"    {name_by_id.get(hid, hid)}: {minutes/60:.1f}h")

    # 割当のないヘルパー
    no_assign = [h for h in helpers if h["id"] not in assign_minutes]
    if no_assign:
        print(f"\n  割当ゼロのヘルパー: {len(no_assign)}")
        for h in no_assign[:10]:
            has_avail = "可用性あり" if h["id"] in avail_by_helper else "可用性なし"
            print(f"    {h['short_name']} ({h['id']}): {has_avail}")


def main():
    print("=" * 60)
    print("  本番データ分析レポート")
    print("=" * 60)

    customers = load_csv("customers.csv")
    helpers = load_csv("helpers.csv")
    services = load_csv("customer-services.csv")
    constraints = load_csv("customer-staff-constraints.csv")
    availability = load_csv("helper-availability.csv")
    assignments = load_csv("manual-assignments.csv")

    analyze_data_quality(customers, helpers, services, constraints, availability, assignments)
    analyze_assignment_patterns(assignments, helpers, constraints)
    analyze_ng_violations(assignments, constraints, helpers)
    analyze_availability_coverage(assignments, helpers, availability)

    section("完了")
    print()


if __name__ == "__main__":
    main()
