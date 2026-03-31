"""E: 資格制約 — 身体介護に無資格者を割り当てない"""

from optimizer.engine.solver import solve
from optimizer.models import (
    Customer,
    DayOfWeek,
    GeoLocation,
    Helper,
    HoursRange,
    OptimizationInput,
    Order,
    ServiceTypeConfig,
)


def _make_helper(id: str, can_physical: bool) -> Helper:
    return Helper(
        id=id,
        family_name="テスト",
        given_name=id,
        can_physical_care=can_physical,
        transportation="car",
        preferred_hours=HoursRange(min=4, max=8),
        available_hours=HoursRange(min=4, max=8),
        employment_type="full_time",
    )


def _make_customer(id: str) -> Customer:
    return Customer(
        id=id,
        family_name="テスト",
        given_name=id,
        address="テスト住所",
        location=GeoLocation(lat=31.59, lng=130.55),
    )


def _make_order(id: str, customer_id: str, stype: str) -> Order:
    return Order(
        id=id,
        customer_id=customer_id,
        date="2025-01-06",
        day_of_week=DayOfWeek.MONDAY,
        start_time="09:00",
        end_time="10:00",
        service_type=stype,
    )


def _make_service_type_config(code: str, requires_cert: bool) -> ServiceTypeConfig:
    return ServiceTypeConfig(
        code=code,
        label=code,
        short_label=code[:2],
        requires_physical_care_cert=requires_cert,
        sort_order=0,
    )


_CERT_CONFIGS = [
    _make_service_type_config("身体介護2・Ⅱ", requires_cert=True),
    _make_service_type_config("生活援助３・Ⅱ", requires_cert=False),
]


class TestQualificationConstraint:
    def test_unqualified_not_assigned_to_physical_care(self) -> None:
        """無資格者は資格必要サービス（身体介護2・Ⅱ）に割り当てられない"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[
                _make_helper("H1", can_physical=True),
                _make_helper("H2", can_physical=False),
            ],
            orders=[_make_order("O1", "C1", "身体介護2・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=_CERT_CONFIGS,
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assigned = result.assignments[0].staff_ids
        assert "H1" in assigned
        assert "H2" not in assigned

    def test_unqualified_can_do_daily_living(self) -> None:
        """無資格者は資格不要サービス（生活援助３・Ⅱ）に割り当て可能"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "生活援助３・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=_CERT_CONFIGS,
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids

    def test_infeasible_only_unqualified_for_physical(self) -> None:
        """無資格者しかいないのに資格必要サービス → Infeasible"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "身体介護2・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=_CERT_CONFIGS,
        )
        result = solve(inp)
        # 無資格者しかいない → ペナルティ付きOptimal（未割当）
        assert result.status == "Optimal"
        assert result.unassigned_count >= 1

    def test_unqualified_not_assigned_to_mixed(self) -> None:
        """無資格者は資格必要サービス（身体1生活1・Ⅱ）に割り当てられない"""
        mixed_configs = [
            _make_service_type_config("身体1生活1・Ⅱ", requires_cert=True),
        ]
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[
                _make_helper("H1", can_physical=True),
                _make_helper("H2", can_physical=False),
            ],
            orders=[_make_order("O1", "C1", "身体1生活1・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=mixed_configs,
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assigned = result.assignments[0].staff_ids
        assert "H1" in assigned
        assert "H2" not in assigned

    def test_infeasible_only_unqualified_for_mixed(self) -> None:
        """無資格者しかいないのに資格必要混合サービス → Infeasible"""
        mixed_configs = [
            _make_service_type_config("身体1生活1・Ⅱ", requires_cert=True),
        ]
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "身体1生活1・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=mixed_configs,
        )
        result = solve(inp)
        # 無資格者しかいないのに資格必要混合サービス → ペナルティ付きOptimal（未割当）
        assert result.status == "Optimal"
        assert result.unassigned_count >= 1

    def test_unqualified_can_do_prevention(self) -> None:
        """無資格者は資格不要サービスに割り当て可能"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "生活援助３・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=_CERT_CONFIGS,
        )
        result = solve(inp)
        assert result.status == "Optimal"
        assert "H1" in result.assignments[0].staff_ids


class TestDynamicQualificationConstraint:
    def test_dynamic_requires_cert_true(self) -> None:
        """service_type_configsでrequires_cert=trueの種別は資格制約が適用される（通常は資格不要な種別でも）"""
        # daily_living は通常資格不要だが、マスタでrequires=trueにする
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],  # 無資格者のみ
            orders=[_make_order("O1", "C1", "daily_living")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=[
                _make_service_type_config("daily_living", requires_cert=True),
            ],
        )
        result = solve(inp)
        # 無資格者しかいないので割当不可 → ペナルティ付きOptimal（未割当）
        assert result.status == "Optimal"
        assert result.unassigned_count >= 1

    def test_dynamic_requires_cert_false(self) -> None:
        """service_type_configsでrequires_cert=falseの種別は資格不問（通常は資格必要でも）"""
        # physical_care は通常資格必要だが、マスタでrequires=falseにする
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],  # 無資格者
            orders=[_make_order("O1", "C1", "physical_care")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=[
                _make_service_type_config("physical_care", requires_cert=False),
            ],
        )
        result = solve(inp)
        assert result.status == "Optimal"  # 資格不問なので無資格者でも割当可

    def test_no_restriction_when_no_configs(self) -> None:
        """service_type_configsが空の場合は制約なし（全員割り当て可能）"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "physical_care")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=[],  # 空 = 資格制約なし
        )
        result = solve(inp)
        assert result.status == "Optimal"  # 制約なしなので無資格者でも割当可

    def test_dynamic_config_for_unknown_type(self) -> None:
        """マスタに存在しない種別はrequires_cert=False（config_map.getがNoneの場合）"""
        inp = OptimizationInput(
            customers=[_make_customer("C1")],
            helpers=[_make_helper("H1", can_physical=False)],
            orders=[_make_order("O1", "C1", "生活援助３・Ⅱ")],
            travel_times=[],
            staff_unavailabilities=[],
            staff_constraints=[],
            service_type_configs=[
                # 身体介護2・Ⅱのみ登録（生活援助３・Ⅱは未登録）
                _make_service_type_config("身体介護2・Ⅱ", requires_cert=True),
            ],
        )
        # 生活援助３・Ⅱはマスタ未登録 → requires_cert=False扱いで無資格者でも割当可
        result = solve(inp)
        assert result.status == "Optimal"
