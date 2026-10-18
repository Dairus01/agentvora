export function money(value: number | null | undefined) {
  return value == null
    ? "\u2014"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 8 : 2,
      }).format(value);
}
export function num(value: number | null | undefined, digits = 2) {
  return value == null
    ? "\u2014"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
        value,
      );
}
export function pct(value: number | null | undefined) {
  return value == null
    ? "\u2014"
    : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
export function date(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
