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

// ─── Import / Job domain helpers ──────────────────────────────────────────────

const IMPORT_STATUS_LABELS = {
  success: "Готово",
  done: "Готово",
  parsed: "Разобрано",
  partial: "Требует проверки",
  processing: "В обработке",
  error: "Ошибка импорта",
  pending: "В обработке",
  queued: "В очереди",
  uploaded: "Загружено",
  failed: "Ошибка обработки",
};

/** Localised human-readable label for import / job status values. */
export function formatImportStatus(status) {
  return IMPORT_STATUS_LABELS[status] || formatValue(status);
}

/** Returns the CSS class to apply to a status-pill element. */
export function getImportStatusClass(status) {
  switch (status) {
    case "success":
    case "done":
    case "parsed":   return "status-good";
    case "partial":
    case "processing":
    case "pending":  return "status-warn";
    case "error":
    case "failed":   return "status-bad";
    case "queued":   return "status-default";
    default:         return "";
  }
}

const DOCUMENT_TYPE_LABELS = {
  net_price:     "Нетто-прайс",
  promo:         "Промо",
  price_list:    "Прайс-лист",
  request_offer: "Под запрос",
  stock_balance: "Остатки",
};

/** Localised label for import document_type values. */
export function formatDocumentType(type) {
  return DOCUMENT_TYPE_LABELS[type] || formatValue(type);
}

const REVIEW_STATUS_LABELS = {
  pending:  "Ждёт проверки",
  checked:  "Проверено",
  excluded: "Исключено",
  approved: "Одобрено",
  rejected: "Отклонено",
};

/** Localised label for product review_status values. */
export function formatReviewStatus(status) {
  return REVIEW_STATUS_LABELS[status] || formatValue(status);
}

/**
 * Formats an ISO timestamp for display in Europe/Moscow timezone.
 * Returns "YYYY-MM-DD HH:mm" or falls back to raw string on parse error.
 */
export function formatDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);

  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
