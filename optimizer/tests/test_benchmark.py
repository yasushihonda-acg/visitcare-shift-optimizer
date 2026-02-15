"""ベンチマークテスト — 大規模データでのソルバー性能検証

pytest -m benchmark で実行（通常テストではスキップ）
"""

import time
import random

import pytest

from optimizer.engine.solver import solve, SoftWeights
from optimizer.models import (
    AvailabilitySlot,
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    ServiceType,
    StaffConstraint,
    StaffConstraintType,
    TravelTime,
)

DAYS = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
DATE_MAP = {
    DayOfWeek.MONDAY: "2026-02-16",
    DayOfWeek.TUESDAY: "2026-02-17",
    DayOfWeek.WEDNESDAY: "2026-02-18",
    DayOfWeek.THURSDAY: "2026-02-19",
    DayOfWeek.FRIDAY: "2026-02-20",
}

# 現実的なタイムスロット（重複しない1時間枠 × 8スロット/日）
TIME_SLOTS = [
    ("08:00", "09:00"), ("09:00", "10:00"), ("10:00", "11:00"),
    ("11:00", "12:00"), ("13:00", "14:00"), ("14:00", "15:00"),
    ("15:00", "16:00"), ("16:00", "17:00"),
]


def _generate_data(
    n_helpers: int, n_customers: int, orders_per_customer_per_day: float = 0.65,
) -> OptimizationInput:
    """テスト用大規模データを生成（現実的な制約を満たすデータ）"""
    rng = random.Random(42)

    # ヘルパー生成（全員が週5日勤務 08:00-17:00）
    helpers = []
    for i in range(n_helpers):
        can_physical = rng.random() < 0.8  # 80%が有資格
        availability = {
            d: [AvailabilitySlot(start_time="08:00", end_time="17:00")]
            for d in DAYS
        }
        helpers.append(Helper(
            id=f"h{i:03d}",
            family_name=f"ヘルパー{i}",
            given_name="太郎",
            can_physical_care=can_physical,
            transportation="car",
            weekly_availability=availability,
            preferred_hours=HoursRange(min=15.0, max=35.0),
            available_hours=HoursRange(min=0.0, max=40.0),
            employment_type="full_time",
        ))

    # 利用者生成
    customers = []
    for i in range(n_customers):
        lat = 31.56 + rng.uniform(-0.03, 0.03)
        lng = 130.56 + rng.uniform(-0.03, 0.03)
        customers.append(Customer(
            id=f"c{i:03d}",
            family_name=f"利用者{i}",
            given_name="花子",
            address=f"鹿児島市テスト町{i}",
            location=GeoLocation(lat=lat, lng=lng),
        ))

    # オーダー生成（各利用者は週に2-4日、1日1スロット）
    orders = []
    order_id = 0
    for c in customers:
        # この利用者のサービス曜日（2-4日/週）
        n_days = rng.randint(2, 4)
        service_days = rng.sample(DAYS, k=n_days)
        for day in service_days:
            if rng.random() < orders_per_customer_per_day:
                slot = rng.choice(TIME_SLOTS)
                # 生活援助を多めに（身体介護は有資格者のみなので制約が厳しい）
                stype = ServiceType.PHYSICAL_CARE if rng.random() < 0.4 else ServiceType.DAILY_LIVING
                orders.append(Order(
                    id=f"o{order_id:04d}",
                    customer_id=c.id,
                    date=DATE_MAP[day],
                    day_of_week=day,
                    start_time=slot[0],
                    end_time=slot[1],
                    service_type=stype,
                ))
                order_id += 1

    # 移動時間生成（近い利用者ペアのみ — 距離0.02以内）
    travel_times = []
    for i, c1 in enumerate(customers):
        for j, c2 in enumerate(customers):
            if i >= j:
                continue
            dist = abs(c1.location.lat - c2.location.lat) + abs(c1.location.lng - c2.location.lng)
            if dist > 0.02:
                continue  # 遠い利用者ペアは除外
            tt = max(5.0, min(20.0, dist * 500))
            travel_times.append(TravelTime(
                from_id=c1.id, to_id=c2.id, travel_time_minutes=round(tt, 1),
            ))
            travel_times.append(TravelTime(
                from_id=c2.id, to_id=c1.id, travel_time_minutes=round(tt, 1),
            ))

    return OptimizationInput(
        customers=customers,
        helpers=helpers,
        orders=orders,
        travel_times=travel_times,
        staff_unavailabilities=[],
        staff_constraints=[],
    )


@pytest.mark.benchmark
class TestBenchmark:
    """大規模データでのベンチマークテスト"""

    def test_current_scale_160_orders(self) -> None:
        """現行規模（~160オーダー/20ヘルパー）— ベースライン"""
        inp = _generate_data(n_helpers=20, n_customers=50)
        print(f"\n[ベースライン] ヘルパー: {len(inp.helpers)}, "
              f"オーダー: {len(inp.orders)}, "
              f"移動時間: {len(inp.travel_times)}")

        result = solve(inp, time_limit_seconds=60)
        print(f"  Status: {result.status}, Time: {result.solve_time_seconds:.1f}s")
        assert result.status == "Optimal"
        assert result.solve_time_seconds < 30

    def test_medium_scale_500_orders(self) -> None:
        """中規模（~500オーダー/30ヘルパー）"""
        inp = _generate_data(n_helpers=30, n_customers=160)
        print(f"\n[中規模] ヘルパー: {len(inp.helpers)}, "
              f"オーダー: {len(inp.orders)}, "
              f"移動時間: {len(inp.travel_times)}")

        result = solve(inp, time_limit_seconds=60)
        print(f"  Status: {result.status}, Time: {result.solve_time_seconds:.1f}s")
        assert result.status in ("Optimal", "Feasible")
        assert result.solve_time_seconds < 60

    def test_large_scale_1000_orders(self) -> None:
        """大規模（~1000オーダー/50ヘルパー）— 目標60秒以内"""
        inp = _generate_data(n_helpers=50, n_customers=350)
        print(f"\n[大規模] ヘルパー: {len(inp.helpers)}, "
              f"オーダー: {len(inp.orders)}, "
              f"移動時間: {len(inp.travel_times)}")
        print(f"  決定変数(全): {len(inp.helpers) * len(inp.orders)}")

        result = solve(inp, time_limit_seconds=120)
        print(f"  Status: {result.status}, Time: {result.solve_time_seconds:.1f}s")
        assert result.status in ("Optimal", "Feasible")
        assert result.solve_time_seconds < 120

    def test_memory_usage(self) -> None:
        """メモリ使用量計測（大規模データ）"""
        import tracemalloc
        tracemalloc.start()

        inp = _generate_data(n_helpers=50, n_customers=350)
        result = solve(inp, time_limit_seconds=120)

        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        peak_mb = peak / 1024 / 1024
        print(f"\n[メモリ] ピーク使用量: {peak_mb:.1f} MB")
        print(f"  Status: {result.status}, Time: {result.solve_time_seconds:.1f}s")
        # Cloud Run 1Gi制限（OSオーバーヘッド除くと約800MB）
        assert peak_mb < 800, f"メモリ使用量が高すぎます: {peak_mb:.1f} MB"
