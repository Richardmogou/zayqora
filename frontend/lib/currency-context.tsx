export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    PKR: "₨",
    MAD: "MAD",
    XOF: "CFA",
    CAD: "CA$",
    CHF: "CHF",
    AED: "AED",
    SAR: "SAR",
  };
  return map[code.toUpperCase()] ?? code;
}
