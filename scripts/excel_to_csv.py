"""本番Excel→CSV変換スクリプト（pandas版・高速）

Usage: python scripts/excel_to_csv.py
"""

import csv
import re
import sys
from pathlib import Path

import pandas as pd

EXCEL_PATH = Path("シフト作成_編集ファイル(基本シフト)20251231.xlsx")
OUTPUT_DIR = Path("seed/data/production")

DAY_MAP = {
    "月": "monday", "火": "tuesday", "水": "wednesday",
    "木": "thursday", "金": "friday", "土": "saturday", "日": "sunday",
}


def safe_int(val, default=0):
    if pd.isna(val):
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def safe_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()


def reconstruct_time(row, col_start):
    """7列 [HH, :, MM, -, HH, :, MM] → (start, end)"""
    h1 = safe_int(row.iloc[col_start])
    m1 = safe_int(row.iloc[col_start + 2])
    h2 = safe_int(row.iloc[col_start + 4])
    m2 = safe_int(row.iloc[col_start + 6])
    if h1 == 0 and m1 == 0 and h2 == 0 and m2 == 0:
        return None, None
    return f"{h1:02d}:{m1:02d}", f"{h2:02d}:{m2:02d}"


def extract_customer_id(raw):
    m = re.search(r"ID:_(\d+)", str(raw))
    return f"C{m.group(1)}" if m else None


def extract_customer_name(raw):
    name_part = re.sub(r"\(ID:_\d+\)$", "", str(raw)).strip()
    parts = name_part.split("_", 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], "")


def parse_ng_staff(raw):
    if pd.isna(raw) or not raw:
        return []
    return re.findall(r"《(.+?)》", str(raw))


def main():
    if not EXCEL_PATH.exists():
        print(f"ERROR: {EXCEL_PATH} が見つかりません", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Helper Sheet ---
    print("Loading Helper sheet...")
    df_h = pd.read_excel(str(EXCEL_PATH), sheet_name="Helper", header=None)
    print(f"  Raw shape: {df_h.shape}")

    helpers = []
    availabilities = []
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for idx in range(1, len(df_h)):  # skip header row
        name = df_h.iloc[idx, 0]
        if pd.isna(name) or not str(name).strip():
            break
        short_name = str(name).strip()
        helper_id = f"H{len(helpers) + 1:03d}"

        helpers.append({
            "id": helper_id,
            "family_name": short_name,
            "given_name": "",
            "short_name": short_name,
            "qualifications": "",
            "can_physical_care": "true",
            "transportation": "car",
            "preferred_hours_min": safe_int(df_h.iloc[idx, 50] if df_h.shape[1] > 50 else 0),
            "preferred_hours_max": safe_int(df_h.iloc[idx, 51] if df_h.shape[1] > 51 else 0),
            "available_hours_min": safe_int(df_h.iloc[idx, 52] if df_h.shape[1] > 52 else 0),
            "available_hours_max": safe_int(df_h.iloc[idx, 53] if df_h.shape[1] > 53 else 0),
            "employment_type": "full_time",
            "gender": "",
            "employee_number": "",
            "address": "",
            "phone_number": "",
            "email": "",
        })

        for day_idx, day_name in enumerate(days):
            col_start = 1 + day_idx * 7  # 0-indexed: col1 = Mon start
            if col_start + 6 >= df_h.shape[1]:
                continue
            start_time, end_time = reconstruct_time(df_h.iloc[idx], col_start)
            if start_time and end_time:
                availabilities.append({
                    "helper_id": helper_id,
                    "day_of_week": day_name,
                    "start_time": start_time,
                    "end_time": end_time,
                })

    name_to_id = {h["short_name"]: h["id"] for h in helpers}
    print(f"  Helpers: {len(helpers)}, Availability: {len(availabilities)}")

    # --- Customer Sheet ---
    print("Loading Customer sheet...")
    df_c = pd.read_excel(str(EXCEL_PATH), sheet_name="Customer", header=None)
    print(f"  Raw shape: {df_c.shape}")

    customers = []
    services = []
    constraints = []
    manual_assignments = []
    ng_names_all = set()

    idx = 1  # skip header
    while idx < len(df_c):
        col0 = df_c.iloc[idx, 0]
        if not (pd.notna(col0) and "ID:_" in str(col0)):
            idx += 1
            continue

        customer_id = extract_customer_id(col0)
        family, given = extract_customer_name(col0)
        address = safe_str(df_c.iloc[idx, 7])
        phone_info = safe_str(df_c.iloc[idx, 8])
        svc_manager = safe_str(df_c.iloc[idx, 9])
        ng_raw = safe_str(df_c.iloc[idx, 10])
        notes = safe_str(df_c.iloc[idx, 13])
        home_care = safe_str(df_c.iloc[idx, 1])
        svc_count = safe_int(df_c.iloc[idx, 14])

        # NG staff
        ng_names = parse_ng_staff(ng_raw)
        ng_names_all.update(ng_names)
        for ng_name in ng_names:
            if ng_name in name_to_id:
                constraints.append({
                    "customer_id": customer_id,
                    "staff_id": name_to_id[ng_name],
                    "constraint_type": "ng",
                })

        customers.append({
            "id": customer_id,
            "family_name": family,
            "given_name": given,
            "family_kana": "",
            "given_kana": "",
            "address": address,
            "lat": "",
            "lng": "",
            "service_manager": svc_manager,
            "household_id": "",
            "notes": notes,
            "gender_requirement": "",
            "aozora_id": "",
            "phone_number": phone_info,
            "phone_number2": "",
            "phone_note": "",
            "home_care_office": home_care,
            "care_manager_name": "",
            "consultation_support_office": "",
            "support_specialist_name": "",
        })

        # Service detail rows
        for _ in range(svc_count):
            idx += 1
            if idx >= len(df_c):
                break
            row = df_c.iloc[idx]

            day_raw = safe_str(row.iloc[14])
            day_of_week = DAY_MAP.get(day_raw, "")
            if not day_of_week:
                continue

            start_time, end_time = reconstruct_time(row, 15)
            if not start_time or not end_time:
                continue

            service_type = safe_str(row.iloc[23]) if df_c.shape[1] > 23 else ""
            staff_count = safe_int(row.iloc[26] if df_c.shape[1] > 26 else 1, 1)

            services.append({
                "customer_id": customer_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "service_type": service_type,
                "staff_count": staff_count,
            })

            # Manual assignments: col27-33 are assigned helper names
            # (col25=designated helper, col26=staff_count — skip these)
            assigned = []
            for col in range(27, min(34, df_c.shape[1])):
                name = safe_str(row.iloc[col])
                if name:
                    assigned.append(name)

            if assigned:
                manual_assignments.append({
                    "customer_id": customer_id,
                    "day_of_week": day_of_week,
                    "start_time": start_time,
                    "end_time": end_time,
                    "service_type": service_type,
                    "staff_count": staff_count,
                    "assigned_helpers": "|".join(assigned),
                })

        idx += 1

    matched_ng = sum(1 for n in ng_names_all if n in name_to_id)
    print(f"  Customers: {len(customers)}, Services: {len(services)}")
    print(f"  Constraints: {len(constraints)}, Manual assignments: {len(manual_assignments)}")
    print(f"  NG staff match: {matched_ng}/{len(ng_names_all)}")

    # --- Write CSVs ---
    print("\nWriting CSV files...")

    def write_csv(name, rows, fields):
        path = OUTPUT_DIR / name
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print(f"  {name}: {len(rows)} rows")

    write_csv("customers.csv", customers, [
        "id", "family_name", "given_name", "family_kana", "given_kana",
        "address", "lat", "lng", "service_manager", "household_id", "notes",
        "gender_requirement", "aozora_id", "phone_number", "phone_number2",
        "phone_note", "home_care_office", "care_manager_name",
        "consultation_support_office", "support_specialist_name",
    ])
    write_csv("helpers.csv", helpers, [
        "id", "family_name", "given_name", "short_name", "qualifications",
        "can_physical_care", "transportation", "preferred_hours_min",
        "preferred_hours_max", "available_hours_min", "available_hours_max",
        "employment_type", "gender", "employee_number", "address",
        "phone_number", "email",
    ])
    write_csv("customer-services.csv", services, [
        "customer_id", "day_of_week", "start_time", "end_time",
        "service_type", "staff_count",
    ])
    write_csv("helper-availability.csv", availabilities, [
        "helper_id", "day_of_week", "start_time", "end_time",
    ])
    write_csv("customer-staff-constraints.csv", constraints, [
        "customer_id", "staff_id", "constraint_type",
    ])
    write_csv("manual-assignments.csv", manual_assignments, [
        "customer_id", "day_of_week", "start_time", "end_time",
        "service_type", "staff_count", "assigned_helpers",
    ])
    write_csv("customer-irregular-patterns.csv", [], [
        "customer_id", "type", "description", "active_weeks",
    ])
    write_csv("staff-unavailability.csv", [], [
        "staff_id", "day_of_week", "all_day", "start_time", "end_time", "notes",
    ])

    print(f"\nDone! Output: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
