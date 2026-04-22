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
              <button class="toolbar-btn" data-action="openTableSettings" data-table="items" title="Настроить видимость и порядок столбцов" aria-label="Столбцы">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><circle cx="12" cy="4" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="20" r="2"/></svg>
                <span>Столбцы</span>
              </button>
              <div class="toolbar-divider"></div>
              <span class="overview-selection-pill">Выбрано ${selectedRows.size}</span>
              <button class="toolbar-btn" data-action="selectAllVisibleRows" title="Выделить все строки текущего представления" aria-label="Выбрать все">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>Выбрать все</span>
              </button>
              <button class="toolbar-btn" data-action="clearSelectedRows" title="Снять выделение со всех строк" aria-label="Снять">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                <span>Снять</span>
              </button>
              <div class="toolbar-divider"></div>
              <button class="toolbar-btn toolbar-btn-danger" data-action="excludeSelectedRows" title="Исключить выделенные строки из реестра" aria-label="Исключить">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                <span>Исключить</span>
              </button>
              <button class="toolbar-btn" data-action="openDetailsForSelectedRow" ${selectedRows.size !== 1 ? "disabled" : ""} title="Открыть подробную информацию о позиции" aria-label="Детали">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                <span>Детали</span>
              </button>
              <button class="toolbar-btn toolbar-btn-primary" data-action="addSelectionToQuote" title="Добавить выделенные позиции в коммерческое предложение" aria-label="В КП">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                <span>В&nbsp;КП</span>
              </button>
            </div>
            <div class="toolbar-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toolbar-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
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
