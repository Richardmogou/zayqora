import enum


class Role(str, enum.Enum):
    OWNER = "owner"
    MANAGER = "manager"
    CASHIER = "cashier"
    KITCHEN = "kitchen"
    WAITER = "waiter"
    RIDER = "rider"
    ACCOUNTANT = "accountant"
