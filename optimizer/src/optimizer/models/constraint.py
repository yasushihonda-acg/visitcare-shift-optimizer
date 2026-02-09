"""スタッフ制約モデル — customer-staff-constraints.csv に対応"""

from pydantic import BaseModel

from .common import StaffConstraintType


class StaffConstraint(BaseModel):
    customer_id: str
    staff_id: str
    constraint_type: StaffConstraintType
