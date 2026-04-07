export function formatValue(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

export function formatMoney(value, currency = "RUB") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(2)} ${currency}`;
}

export function formatNumber(value, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function formatPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toInputDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

export function pluralize(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
