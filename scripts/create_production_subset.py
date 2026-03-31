"""本番データから小規模サブセットを生成

月曜の上位50顧客 + 関連ヘルパーで seed/data 互換CSVを生成する。
staff_count は手動割当から「同時に必要な人数=1」に修正。

Usage: python scripts/create_production_subset.py
"""

import csv
from collections import defaultdict
from pathlib import Path

SRC = Path("seed/data/production")
DST = Path("seed/data/production-subset")


def load_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict], fields: list[str]):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"  {path.name}: {len(rows)} rows")


def main():
    DST.mkdir(parents=True, exist_ok=True)

    # Load source data
    customers = load_csv(SRC / "customers.csv")
    services = load_csv(SRC / "customer-services.csv")
    constraints = load_csv(SRC / "customer-staff-constraints.csv")
    helpers = load_csv(SRC / "helpers.csv")
    availability = load_csv(SRC / "helper-availability.csv")
    assignments = load_csv(SRC / "manual-assignments.csv")

    # 月曜のサービスがある顧客を取得、サービス数で上位50を選択
    monday_svcs = [s for s in services if s["day_of_week"] == "monday"]
    cust_svc_count = defaultdict(int)
    for s in monday_svcs:
        cust_svc_count[s["customer_id"]] += 1
    top_ids = sorted(cust_svc_count, key=cust_svc_count.get, reverse=True)[:20]
    top50_set = set(top_ids)

    print(f"対象顧客: {len(top50_set)} (月曜サービス数上位20)")

    # その顧客に割当されているヘルパー名を収集
    helper_name_to_id = {h["short_name"]: h["id"] for h in helpers}
    assigned_helper_ids = set()
    subset_assignments = []
    for a in assignments:
        if a["customer_id"] in top50_set:
            names = a["assigned_helpers"].split("|")
            for name in names:
                hid = helper_name_to_id.get(name)
                if hid:
                    assigned_helper_ids.add(hid)
            subset_assignments.append(a)

    print(f"関連ヘルパー: {len(assigned_helper_ids)}")

    # 顧客CSV
    subset_customers = [c for c in customers if c["id"] in top50_set]
    write_csv(DST / "customers.csv", subset_customers, list(customers[0].keys()))

    # ヘルパーCSV（staff_count関連の時間も修正）
    subset_helpers = [h for h in helpers if h["id"] in assigned_helper_ids]
    write_csv(DST / "helpers.csv", subset_helpers, list(helpers[0].keys()))

    # サービスCSV（全曜日、staff_count=1に修正）
    subset_services = []
    for s in services:
        if s["customer_id"] in top50_set:
            s_copy = dict(s)
            s_copy["staff_count"] = "1"  # 同時必要人数は1
            subset_services.append(s_copy)
    write_csv(DST / "customer-services.csv", subset_services, list(services[0].keys()))

    # 制約CSV
    subset_constraints = [
        c for c in constraints
        if c["customer_id"] in top50_set and c["staff_id"] in assigned_helper_ids
    ]
    write_csv(DST / "customer-staff-constraints.csv", subset_constraints, list(constraints[0].keys()))

    # 可用性CSV
    subset_avail = [a for a in availability if a["helper_id"] in assigned_helper_ids]
    write_csv(DST / "helper-availability.csv", subset_avail, list(availability[0].keys()))

    # 手動割当CSV（比較用）
    for a in subset_assignments:
        a["staff_count"] = "1"
    write_csv(DST / "manual-assignments.csv", subset_assignments, list(assignments[0].keys()))

    # 空ファイル
    write_csv(DST / "customer-irregular-patterns.csv", [], ["customer_id", "type", "description", "active_weeks"])
    write_csv(DST / "staff-unavailability.csv", [], ["staff_id", "day_of_week", "all_day", "start_time", "end_time", "notes"])

    # service-types.csvはproductionからコピー
    svc_types = load_csv(SRC / "service-types.csv")
    write_csv(DST / "service-types.csv", svc_types, list(svc_types[0].keys()))

    # helper-training-status.csv（空）
    write_csv(DST / "helper-training-status.csv", [], ["helper_id", "customer_id", "status"])

    print(f"\n✅ サブセット生成完了: {DST}/")
    print(f"   顧客: {len(subset_customers)}, ヘルパー: {len(subset_helpers)}")
    print(f"   サービス: {len(subset_services)}, 制約: {len(subset_constraints)}")
    print(f"   手動割当: {len(subset_assignments)}")


if __name__ == "__main__":
    main()
