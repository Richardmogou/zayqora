from decimal import Decimal

from app.core.money import from_minor, to_minor


def test_money_never_loses_precision():
    assert to_minor("184999999.84") == 18499999984
    assert from_minor(18499999984) == Decimal("184999999.84")


def test_rounding_is_half_up():
    assert to_minor("0.005") == 1
    assert to_minor("0.004") == 0
