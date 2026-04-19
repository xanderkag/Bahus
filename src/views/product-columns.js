import { escapeHtml, formatNumber, formatMoney, formatPercent } from "../utils/format.js";

export function formatDocumentType(type) {
  const labels = {
    net_price: "Нетто-прайс",
    promo: "Промо",
    price_list: "Прайс-лист",
    stock_balance: "Остатки"
  };
  return labels[type] || type || "—";
}

export function formatReviewStatus(status) {
  const labels = {
    approved: "Одобрено",
    rejected: "Отклонено",
    pending: "Ожидает",
    checked: "Проверено",
    excluded: "Исключено"
  };
  return labels[status] || status;
}

export const PRODUCT_COLUMN_DEFS = {
  "import": {
    renderTh: () => `<th>Импорт</th>`,
    renderTd: (product, importRecord) => `
      <td>
        <div class="table-title">${escapeHtml(importRecord?.meta?.source_file || "—")}</div>
        <div class="table-subtitle">${escapeHtml(importRecord?.meta?.import_date || "—")}</div>
      </td>
    `
  },
  "row_index": {
    renderTh: () => `<th>Строка</th>`,
    renderTd: (product) => `<td>${product.row_index}</td>`
  },
  "name": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Наименование", "name")}${renderMenu("name")}</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `
      <td>
        <div class="table-title">${escapeHtml(formatValue(product.raw_name))}</div>
        <div class="table-subtitle">${escapeHtml(formatValue(product.normalized_name))}</div>
      </td>
    `
  },
  "article": {
    renderTh: () => `<th>Артикул</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `<td>${escapeHtml(formatValue(product.article))}</td>`
  },
  "code": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Код", "code")}${renderMenu("code")}</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `<td>${escapeHtml(formatValue(product.product_id || product.temp_id))}</td>`
  },
  "supplier": {
    renderTh: () => `<th>Поставщик</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `
      <td>
        <div class="table-title">${escapeHtml(formatValue(supplier?.name))}</div>
      </td>
    `
  },
  "validity": {
    renderTh: () => `<th>Актуальность</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `
      <td>
        <div class="table-title">с ${escapeHtml(formatValue(importRecord?.meta?.import_date))}</div>
        <div class="table-subtitle">${escapeHtml(formatValue(importRecord?.meta?.period))}</div>
      </td>
    `
  },
  "country": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Страна", "country")}${renderMenu("country")}</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `<td>${escapeHtml(formatValue(product.country))}</td>`
  },
  "category": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Категория", "category")}${renderMenu("category")}</th>`,
    renderTd: (product, importRecord, supplier, formatValue) => `<td>${escapeHtml(formatValue(product.category))}</td>`
  },
  "document_type": {
    renderTh: () => `<th>Тип</th>`,
    renderTd: (product, importRecord) => `<td>${escapeHtml(formatDocumentType(importRecord?.meta?.document_type))}</td>`
  },
  "volume_l": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Объём", "volume_l")}${renderMenu("volume_l")}</th>`,
    renderTd: (product) => `<td>${formatNumber(product.volume_l)}</td>`
  },
  "purchase_price": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Закупка", "purchase_price")}${renderMenu("purchase_price")}</th>`,
    renderTd: (product, importRecord) => `<td>${formatMoney(product.purchase_price, importRecord?.meta?.currency || "RUB")}</td>`
  },
  "rrc_min": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("РРЦ", "rrc_min")}${renderMenu("rrc_min")}</th>`,
    renderTd: (product, importRecord) => `<td>${formatMoney(product.rrc_min, importRecord?.meta?.currency || "RUB")}</td>`
  },
  "client_price": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Цена клиенту", "client_price")}${renderMenu("client_price")}</th>`,
    renderTd: (product, importRecord) => {
       const clientPrice = typeof product.rrc_min === "number" ? product.rrc_min : product.purchase_price;
       return `<td>${formatMoney(clientPrice, importRecord?.meta?.currency || "RUB")}</td>`;
    }
  },
  "margin_rub": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Маржа", "margin_rub")}${renderMenu("margin_rub")}</th>`,
    renderTd: (product, importRecord) => {
       const marginRub = typeof product.purchase_price === "number" && typeof product.rrc_min === "number" ? product.rrc_min - product.purchase_price : null;
       return `<td>${formatMoney(marginRub, importRecord?.meta?.currency || "RUB")}</td>`;
    }
  },
  "margin_pct": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Маржа %", "margin_pct")}${renderMenu("margin_pct")}</th>`,
    renderTd: (product, importRecord) => {
       const marginRub = typeof product.purchase_price === "number" && typeof product.rrc_min === "number" ? product.rrc_min - product.purchase_price : null;
       const marginPct = typeof marginRub === "number" && product.purchase_price ? (marginRub / product.purchase_price) * 100 : null;
       return `<td>${formatPercent(marginPct)}</td>`;
    }
  },
  "promo": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Акция", "promo")}${renderMenu("promo")}</th>`,
    renderTd: (product) => `<td>${product.promo ? '<span class="pill pill-warn">Акция</span>' : '<span class="pill">Обычный</span>'}</td>`
  },
  "issues": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Проблемы", "issues")}${renderMenu("issues")}</th>`,
    renderTd: (product, importRecord, supplier, formatValue, state, issueSummary) => {
      const count = issueSummary?.count ? " \u00b7 " + issueSummary.count : "";
      return `<td><span class="pill pill-${issueSummary?.kind}">${issueSummary?.label}${count}</span></td>`;
    }
  },
  "review_status": {
    renderTh: (renderHeader, renderMenu) => `<th class="filterable-th">${renderHeader("Проверка", "review_status")}${renderMenu("review_status")}</th>`,
    renderTd: (product) => `<td><span class="pill">${escapeHtml(formatReviewStatus(product.review_status))}</span></td>`
  }
};
