import {
  getFilterOptions,
  getIssuesForProduct,
  getProductsByScope,
  getRowIssueSummary,
} from "../state/selectors.js";
import { escapeHtml, formatValue } from "../utils/format.js";
import { PRODUCT_COLUMN_DEFS } from "./product-columns.js";

function renderColumnHeader(label, column, activeColumnFilter) {
  const isActive = activeColumnFilter === column;
  return `
    <div class="column-header">
      <span>${escapeHtml(label)}</span>
      <button
        class="column-filter-btn ${isActive ? "is-active" : ""}"
        data-action="toggleColumnFilter"
        data-column="${column}"
        aria-label="Фильтр по колонке ${escapeHtml(label)}"
        title="Фильтр по колонке ${escapeHtml(label)}"
      >
        ▾
      </button>
    </div>
  `;
}

function renderSortControls(column, sort) {
  const isAsc = sort?.column === column && sort?.direction === "asc";
  const isDesc = sort?.column === column && sort?.direction === "desc";
  const numericColumns = new Set(["volume_l", "purchase_price", "rrc_min"]);
  const isNumeric = numericColumns.has(column);
  return `
    <div class="column-menu-sort">
      <button class="ghost-btn compact-action-btn ${isAsc ? "is-active" : ""}" data-action="setTableSort" data-column="${column}" data-direction="asc">${isNumeric ? "Сначала меньше" : "От А до Я"}</button>
      <button class="ghost-btn compact-action-btn ${isDesc ? "is-active" : ""}" data-action="setTableSort" data-column="${column}" data-direction="desc">${isNumeric ? "Сначала больше" : "От Я до А"}</button>
    </div>
  `;
}

function renderChoiceList(field, values, selectedValues) {
  return `
    <div class="column-menu-list">
      ${values
        .map(
          (item) => `
            <label class="column-menu-option">
              <input
                type="checkbox"
                data-change="toggleFilterChoice"
                data-field="${field}"
                data-value="${escapeHtml(item.value)}"
                ${selectedValues.includes(item.value) ? "checked" : ""}
              />
              <span>${escapeHtml(item.label)}</span>
              <button class="ghost-btn compact-action-btn" type="button" data-action="setSingleFilterChoice" data-field="${field}" data-value="${escapeHtml(item.value)}">Только</button>
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderColumnMenuFooter(field) {
  return `
    <div class="column-menu-footer">
      <button class="ghost-btn compact-action-btn" data-action="clearColumnFilter" data-field="${field}">Сбросить</button>
    </div>
  `;
}

function renderColumnMenu(state, filterOptions, column) {
  if (state.ui.activeColumnFilter !== column) return "";

  const categoricalOptions = {
    country: filterOptions.countries.map((value) => ({ value, label: value })),
    category: filterOptions.categories.map((value) => ({ value, label: value })),
    promo: filterOptions.promo,
    issues: filterOptions.issues,
    review_status: filterOptions.reviewStatus,
  };

  const contentByColumn = {
    name: `
      ${renderSortControls(column, state.ui.sort)}
      <div class="column-menu-search">
        <input class="input input-compact" placeholder="Поиск по названию" value="${escapeHtml(state.ui.filters.name)}" data-input="setFilter" data-field="name" />
      </div>
      ${renderColumnMenuFooter("name")}
    `,
    code: `
      ${renderSortControls(column, state.ui.sort)}
      <div class="column-menu-search">
        <input class="input input-compact" placeholder="Поиск по коду" value="${escapeHtml(state.ui.filters.code)}" data-input="setFilter" data-field="code" />
      </div>
      ${renderColumnMenuFooter("code")}
    `,
    country: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderChoiceList("country", categoricalOptions.country, state.ui.filters.country || [])}
      ${renderColumnMenuFooter("country")}
    `,
    category: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderChoiceList("category", categoricalOptions.category, state.ui.filters.category || [])}
      ${renderColumnMenuFooter("category")}
    `,
    promo: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderChoiceList("promo", categoricalOptions.promo, state.ui.filters.promo || [])}
      ${renderColumnMenuFooter("promo")}
    `,
    issues: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderChoiceList("issues", categoricalOptions.issues, state.ui.filters.issues || [])}
      ${renderColumnMenuFooter("issues")}
    `,
    review_status: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderChoiceList("review_status", categoricalOptions.review_status, state.ui.filters.review_status || [])}
      ${renderColumnMenuFooter("review_status")}
    `,
    volume_l: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("volume_l")}
    `,
    purchase_price: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("purchase_price")}
    `,
    rrc_min: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("rrc_min")}
    `,
  };

  return `
    <div class="column-menu">
      <div class="column-menu-header">
        <strong>${escapeHtml(column === "review_status" ? "Проверка" : column === "promo" ? "Акция" : column === "issues" ? "Проблемы" : column === "name" ? "Наименование" : column === "code" ? "Код" : column === "country" ? "Страна" : "Категория")}</strong>
        <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="toggleColumnFilter" data-column="${column}" aria-label="Закрыть фильтр">×</button>
      </div>
      ${contentByColumn[column] || ""}
    </div>
  `;
}

export function renderItems(state) {
  const filterOptions = getFilterOptions(state);
  const products = getProductsByScope(state).filter((product) => {
    const nameQuery = String(state.ui.filters.name || "").trim().toLowerCase();
    const codeQuery = String(state.ui.filters.code || "").trim().toLowerCase();
    const selectedCountries = new Set(state.ui.filters.country || []);
    const selectedCategories = new Set(state.ui.filters.category || []);
    const selectedPromo = new Set(state.ui.filters.promo || []);
    const selectedIssues = new Set(state.ui.filters.issues || []);
    const selectedReview = new Set(state.ui.filters.review_status || []);

    if (
      nameQuery &&
      !`${product.raw_name || ""} ${product.normalized_name || ""}`.toLowerCase().includes(nameQuery)
    ) {
      return false;
    }
    if (
      codeQuery &&
      !`${product.product_id || ""} ${product.temp_id || ""} ${product.ids?.internal_code || ""}`.toLowerCase().includes(codeQuery)
    ) {
      return false;
    }
    if (selectedPromo.size && !selectedPromo.has(String(Boolean(product.promo)))) return false;
    if (selectedCountries.size && !selectedCountries.has(product.country)) return false;
    if (selectedCategories.size && !selectedCategories.has(product.category)) return false;
    
    if (selectedReview.size === 0) {
      if (product.review_status !== "checked") return false;
    } else {
      if (!selectedReview.has(product.review_status)) return false;
    }

    const issues = getIssuesForProduct(state, product.id);
    const hasErrors = issues.some((issue) => issue.severity === "error");
    const hasWarnings = issues.some((issue) => issue.severity === "warning");
    const issueToken = hasErrors ? "errors" : hasWarnings ? "warnings" : "clean";
    if (selectedIssues.size && !selectedIssues.has(issueToken)) return false;

    return true;
  }).sort((left, right) => {
    const column = state.ui.sort?.column || "row_index";
    const direction = state.ui.sort?.direction === "desc" ? -1 : 1;
    const normalize = (value) => String(value || "").toLowerCase();
    const getValue = (product) => {
      switch (column) {
        case "name":
          return normalize(product.normalized_name || product.raw_name);
        case "code":
          return normalize(product.product_id || product.temp_id || product.ids?.internal_code);
        case "country":
          return normalize(product.country);
        case "category":
          return normalize(product.category);
        case "promo":
          return product.promo ? 1 : 0;
        case "volume_l":
          return product.volume_l ?? -1;
        case "purchase_price":
          return product.purchase_price ?? -1;
        case "rrc_min":
          return product.rrc_min ?? -1;
        case "issues": {
          const issue = getRowIssueSummary(state, product.id);
          if (issue.kind === "bad") return 2;
          if (issue.kind === "warn") return 1;
          return 0;
        }
        case "review_status":
          return normalize(product.review_status);
        default:
          return product.row_index || 0;
      }
    };
    const leftValue = getValue(left);
    const rightValue = getValue(right);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });

  const selectedRows = new Set(state.ui.selectedRowIds || []);

  return `
    <section class="view-stack">
      <article class="panel overview-products-panel">
        <div class="panel-header overview-panel-header">
          <div class="overview-panel-headline">
            <h2>Позиции</h2>
            <p>${products.length} строк в общем реестре.</p>
          </div>
          <div class="overview-summary-inline">
            <span class="pill">Все импорты</span>
            <span class="pill">${state.ui.scope === "my" ? "Мои" : "Все"}</span>
            <button class="ghost-btn compact-action-btn table-action-btn" data-action="resetFilters" title="Сбросить все фильтры">Сбросить</button>
          </div>
        </div>
        <div class="table-wrap overview-table-wrap">
          <div class="overview-table-toolbar">
            <div class="toolbar-actions overview-table-actions">
              <button class="icon-btn" data-action="openTableSettings" data-table="items" title="Настроить столбцы" aria-label="Настройки">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <div class="toolbar-divider"></div>
              <span class="overview-selection-pill">Выбрано ${selectedRows.size}</span>
              <button class="icon-btn" data-action="selectAllVisibleRows" title="Выделить все строки текущего представления" aria-label="Выделить все">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="8" x="2" y="2" rx="1"/><path d="M2 9h8M9 2v8"/><rect width="8" height="8" x="14" y="2" rx="1"/><rect width="8" height="8" x="2" y="14" rx="1"/><path d="m14 14 7 7M14 21l7-7"/></svg>
              </button>
              <button class="icon-btn" data-action="clearSelectedRows" title="Снять выделение" aria-label="Снять выделение">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/></svg>
              </button>
              <button class="icon-btn icon-btn-danger" data-action="excludeSelectedRows" title="Исключить выделенные строки из реестра" aria-label="Исключить">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
              <div class="toolbar-divider"></div>
              <button class="icon-btn" data-action="openDetailsForSelectedRow" ${selectedRows.size !== 1 ? "disabled" : ""} title="Открыть детали позиции" aria-label="Детали">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </button>
              <button class="icon-btn icon-btn-primary" data-action="addSelectionToQuote" title="Добавить выделенные позиции в КП" aria-label="В КП">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
                <span>В&nbsp;КП</span>
              </button>
            </div>
            <div class="toolbar-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toolbar-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" class="toolbar-search-input" placeholder="Поиск по всем полям..." value="${escapeHtml(state.ui.productSearchQuery || '')}" data-input="searchProducts" />
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th></th>
                ${state.ui.itemsTableColumns
                  .filter((col) => col.visible)
                  .map((col) => {
                     const def = PRODUCT_COLUMN_DEFS[col.id];
                     if (!def) return '<th></th>';
                     return def.renderTh((label, id) => renderColumnHeader(label, id, state.ui.activeColumnFilter), (id) => renderColumnMenu(state, filterOptions, id));
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${products
                .map((product) => {
                  const importRecord = state.entities.importsById[product.import_id];
                  const supplier = state.entities.suppliersById[product.supplier_id];
                  const issue = getRowIssueSummary(state, product.id);

                  return `
                    <tr class="${selectedRows.has(product.id) ? "is-selected" : ""}" data-dblaction="openRowDetails" data-product-id="${product.id}">
                      <td>
                        <input
                          type="checkbox"
                          data-change="toggleRowSelection"
                          data-product-id="${product.id}"
                          ${selectedRows.has(product.id) ? "checked" : ""}
                        />
                      </td>
                      ${state.ui.itemsTableColumns
                        .filter((col) => col.visible)
                        .map((col) => {
                          const def = PRODUCT_COLUMN_DEFS[col.id];
                          return def ? def.renderTd(product, importRecord, supplier, formatValue, state, issue) : '<td></td>';
                        })
                        .join("")}
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}
