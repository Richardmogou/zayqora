from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")


def to_minor(amount: Decimal | str | int) -> int:
    dec = Decimal(str(amount)).quantize(_CENT, rounding=ROUND_HALF_UP)
    return int(dec * 100)


def from_minor(minor_units: int) -> Decimal:
    return (Decimal(int(minor_units)) / Decimal(100)).quantize(_CENT, rounding=ROUND_HALF_UP)
