import {
  getCurrentImport,
  getCurrentImportIssues,
  getCurrentSupplier,
  getFilterOptions,
  getOverviewStats,
  getIssuesForProduct,
  getRowIssueSummary,
  getRuntimeJobs,
  getSelectedProductDetail,
  getVisibleProducts,
} from "../state/selectors.js";
import {
  escapeHtml,
  formatDateTime,
  formatDocumentType,
  formatImportStatus,
  formatMoney,
  formatNumber,
  formatPercent,
  formatValue,
  getImportStatusClass,
} from "../utils/format.js";
import { PRODUCT_COLUMN_DEFS } from "./product-columns.js";

function renderMetaRows(currentImport, supplier, compact = true) {
  const primaryPairs = [
    ["Файл", currentImport.meta.source_file],
    ["Поставщик", supplier?.name],
    ["Период", currentImport.meta.period],
    ["Валюта", currentImport.meta.currency],
  ];
  const secondaryPairs = [
    ["Дата импорта", currentImport.meta.import_date],
    ["Тип документа", formatDocumentType(currentImport.meta.document_type)],
    ["Статус проверки", formatImportStatus(currentImport.status)],
  ];
  const pairs = compact ? primaryPairs : [...primaryPairs, ...secondaryPairs];

  return pairs
    .map(
      ([label, value]) => `
        <div class="meta-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(formatValue(value))}</strong>
        </div>
      `,
    )
    .join("");
}

function getVisibleImports(state) {
  const fileQuery = String(state.ui.importFilters?.file || "").toLowerCase().trim();
  const selectedSuppliers = new Set(state.ui.importFilters?.supplier || []);
  const selectedFormats = new Set(state.ui.importFilters?.format || []);
  const selectedTypes = new Set(state.ui.importFilters?.type || []);
  const selectedStatuses = new Set(state.ui.importFilters?.status || []);

  return state.entities.importOrder
    .map((importId) => state.entities.importsById[importId])
    .filter((item) => {
      const supplier = state.entities.suppliersById[item.supplier_id];
      if (fileQuery && !String(item.meta.source_file || "").toLowerCase().includes(fileQuery)) return false;
      if (selectedSuppliers.size && !selectedSuppliers.has(supplier?.name)) return false;
      if (selectedFormats.size && !selectedFormats.has(item.meta.source_format?.toUpperCase())) return false;
      if (selectedTypes.size && !selectedTypes.has(formatDocumentType(item.meta.document_type))) return false;
      if (selectedStatuses.size && !selectedStatuses.has(formatImportStatus(item.status))) return false;
      return true;
    })
    .sort((left, right) => {
      const direction = state.ui.importSort?.direction === "asc" ? 1 : -1;
      const column = state.ui.importSort?.column || "import_date";
      const getValue = (item) => {
        const supplier = state.entities.suppliersById[item.supplier_id];
        switch (column) {
          case "file":
            return String(item.meta.source_file || "").toLowerCase();
          case "supplier":
            return String(supplier?.name || "").toLowerCase();
          case "format":
            return String(item.meta.source_format || "").toLowerCase();
          case "type":
            return String(formatDocumentType(item.meta.document_type) || "").toLowerCase();
          case "status":
            return String(formatImportStatus(item.status) || "").toLowerCase();
          default:
            return String(item.meta.import_date || "");
        }
      };
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
}

function renderImportColumnHeader(label, column, activeColumnFilter) {
  const isActive = activeColumnFilter === column;
  return `
    <div class="column-header">
      <span>${escapeHtml(label)}</span>
      <button
        class="column-filter-btn ${isActive ? "is-active" : ""}"
        data-action="toggleImportColumnFilter"
        data-column="${column}"
        aria-label="Фильтр по колонке ${escapeHtml(label)}"
        title="Фильтр по колонке ${escapeHtml(label)}"
      >
        ▾
      </button>
    </div>
  `;
}

function renderImportSortControls(column, sort) {
  const isAsc = sort?.column === column && sort?.direction === "asc";
  const isDesc = sort?.column === column && sort?.direction === "desc";
  return `
    <div class="column-menu-sort">
      <button class="ghost-btn compact-action-btn ${isAsc ? "is-active" : ""}" data-action="setImportTableSort" data-column="${column}" data-direction="asc">Сортировать A→Я</button>
      <button class="ghost-btn compact-action-btn ${isDesc ? "is-active" : ""}" data-action="setImportTableSort" data-column="${column}" data-direction="desc">Сортировать Я→A</button>
    </div>
  `;
}

function renderImportChoiceList(field, values, selectedValues) {
  return `
    <div class="column-menu-list">
      ${values
        .map(
          (item) => `
            <label class="column-menu-option">
              <input
                type="checkbox"
                data-change="toggleImportFilterChoice"
                data-field="${field}"
                data-value="${escapeHtml(item.value)}"
                ${selectedValues.includes(item.value) ? "checked" : ""}
              />
              <span>${escapeHtml(item.label)}</span>
              <button class="ghost-btn compact-action-btn" type="button" data-action="setSingleImportFilterChoice" data-field="${field}" data-value="${escapeHtml(item.value)}">Только</button>
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderImportColumnMenu(state, column) {
  if (state.ui.activeImportColumnFilter !== column) return "";

  const supplierOptions = [...new Set(state.entities.importOrder
    .map((importId) => state.entities.suppliersById[state.entities.importsById[importId].supplier_id]?.name)
    .filter(Boolean))]
    .sort()
    .map((value) => ({ value, label: value }));
  const formatOptions = [...new Set(state.entities.importOrder
    .map((importId) => state.entities.importsById[importId].meta.source_format?.toUpperCase())
    .filter(Boolean))]
    .sort()
    .map((value) => ({ value, label: value }));
  const typeOptions = [...new Set(state.entities.importOrder
    .map((importId) => formatDocumentType(state.entities.importsById[importId].meta.document_type))
    .filter(Boolean))]
    .sort()
    .map((value) => ({ value, label: value }));
  const statusOptions = [...new Set(state.entities.importOrder
    .map((importId) => formatImportStatus(state.entities.importsById[importId].status))
    .filter(Boolean))]
    .sort()
    .map((value) => ({ value, label: value }));

  const contentByColumn = {
    file: `
      ${renderImportSortControls(column, state.ui.importSort)}
      <div class="column-menu-search">
        <input class="input input-compact" placeholder="Поиск по файлу" value="${escapeHtml(state.ui.importFilters.file || "")}" data-input="setImportTextFilter" data-field="file" />
      </div>
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearImportColumnFilter" data-field="file">Сбросить</button>
      </div>
    `,
    supplier: `
      ${renderImportSortControls(column, state.ui.importSort)}
      ${renderImportChoiceList("supplier", supplierOptions, state.ui.importFilters.supplier || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearImportColumnFilter" data-field="supplier">Сбросить</button>
      </div>
    `,
    format: `
      ${renderImportSortControls(column, state.ui.importSort)}
      ${renderImportChoiceList("format", formatOptions, state.ui.importFilters.format || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearImportColumnFilter" data-field="format">Сбросить</button>
      </div>
    `,
    type: `
      ${renderImportSortControls(column, state.ui.importSort)}
      ${renderImportChoiceList("type", typeOptions, state.ui.importFilters.type || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearImportColumnFilter" data-field="type">Сбросить</button>
      </div>
    `,
    status: `
      ${renderImportSortControls(column, state.ui.importSort)}
      ${renderImportChoiceList("status", statusOptions, state.ui.importFilters.status || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearImportColumnFilter" data-field="status">Сбросить</button>
      </div>
    `,
  };

  const labels = {
    file: "Файл",
    supplier: "Поставщик",
    format: "Формат",
    type: "Тип",
    status: "Статус",
  };

  return `
    <div class="column-menu">
      <div class="column-menu-header">
        <strong>${escapeHtml(labels[column] || column)}</strong>
        <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="toggleImportColumnFilter" data-column="${column}" aria-label="Закрыть фильтр">×</button>
      </div>
      ${contentByColumn[column] || ""}
    </div>
  `;
}

function renderImportsTable(state) {
  const selectedImportId = state.ui.selectedImportId;
  const processingStatuses = new Set(["queued", "pending", "processing"]);
  return getVisibleImports(state)
    .map((item, index) => {
      const supplier = state.entities.suppliersById[item.supplier_id];
      const issueCount = item.issue_ids.length;
      const isProcessing = processingStatuses.has(item.status);
      return `
        <tr class="${selectedImportId === item.id ? "is-active" : ""} clickable-row" data-action="selectImport" data-import-id="${item.id}" style="cursor:pointer">
          <td>${index + 1}</td>
          <td>
            <button class="row-link" data-action="selectImport" data-import-id="${item.id}">
              ${escapeHtml(item.meta.source_file)}
            </button>
          </td>
          <td>${escapeHtml(item.created_at ? formatDateTime(item.created_at) : item.meta.import_date)}</td>
          <td>${escapeHtml((item.meta.source_format || "").toUpperCase() || "—")}</td>
          <td>${escapeHtml(formatValue(supplier?.name))}</td>
          <td>${escapeHtml(formatDocumentType(item.meta.document_type))}</td>
          <td>
            <span class="status-pill ${getImportStatusClass(item.status)}${isProcessing ? " status-pill-processing" : ""}">
              ${isProcessing ? '<span class="status-pill-spinner"></span>' : ""}
              ${escapeHtml(formatImportStatus(item.status))}
            </span>
          </td>
          <td style="text-align:right; font-variant-numeric: tabular-nums;">
            ${item.row_count > 0
              ? `<span class="pill" style="background:var(--accent-subtle,rgba(99,102,241,.12));color:var(--accent,#6366f1);font-weight:600;">${item.row_count}</span>`
              : isProcessing
                ? `<span style="color:var(--text-3,#888);font-size:12px;">…</span>`
                : `<span style="color:var(--text-3,#888);">—</span>`
            }
          </td>
          <td><span class="pill${issueCount > 0 ? ' status-bad' : ''}">${issueCount > 0 ? issueCount + " ⚠" : "0 проблем"}</span></td>
        </tr>
      `;
    })
    .join("");
}

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
  const numericColumns = new Set(["volume_l", "purchase_price", "rrc_min", "client_price", "margin_rub", "margin_pct"]);
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
    client_price: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("client_price")}
    `,
    margin_rub: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("margin_rub")}
    `,
    margin_pct: `
      ${renderSortControls(column, state.ui.sort)}
      ${renderColumnMenuFooter("margin_pct")}
    `,
  };

  return `
    <div class="column-menu">
      <div class="column-menu-header">
        <strong>${escapeHtml(
          column === "review_status" ? "Проверка"
            : column === "promo" ? "Акция"
              : column === "issues" ? "Проблемы"
                : column === "name" ? "Наименование"
                  : column === "code" ? "Код"
                    : column === "country" ? "Страна"
                      : column === "category" ? "Категория"
                        : column === "volume_l" ? "Объём"
                          : column === "purchase_price" ? "Закупка"
                            : column === "rrc_min" ? "РРЦ"
                              : column === "client_price" ? "Цена клиенту"
                                : column === "margin_rub" ? "Маржа"
                                  : column === "margin_pct" ? "Маржа %"
                                    : column
        )}</strong>
        <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="toggleColumnFilter" data-column="${column}" aria-label="Закрыть фильтр">×</button>
      </div>
      ${contentByColumn[column] || ""}
    </div>
  `;
}

function renderProductsTable(state) {
  const currentImport = getCurrentImport(state);
  const rows = getVisibleProducts(state);
  const selectedRows = new Set(state.ui.selectedRowIds);

  return rows
    .map((product) => {
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
          ${state.ui.overviewTableColumns
            .filter((col) => col.visible)
            .map((col) => {
              const def = PRODUCT_COLUMN_DEFS[col.id];
              return def ? def.renderTd(product, currentImport, currentImport?.supplier, formatValue, state, issue) : '<td></td>';
            })
            .join("")}
        </tr>
      `;
    })
    .join("");
}

function formatReviewStatus(status) {
  const labels = {
    pending: "Ждёт проверки",
    checked: "Проверено",
    excluded: "Исключено",
  };
  return labels[status] || formatValue(status);
}

function getDetailPhotos(product) {
  const customImages = product.image_url ? [{ url: product.image_url, title: "Фото из сети", caption: "Найдено автоматически" }] : [];
  const images = [
    ...(product.images || []),
    ...(product.manual_match_result?.images || []),
    ...customImages,
  ].filter(Boolean);

  if (images.length) {
    return images.map((image, index) => ({
      title: image.title || `Фото ${index + 1}`,
      caption: image.caption || "Из карточки товара",
      src: image.url || image.src || "",
    }));
  }

  return [
    {
      title: "Основное фото",
      caption: "Появится после сопоставления с каталогом или ручной загрузки.",
      src: "",
      showSearchBtn: true,
    },
    {
      title: "Этикетка / упаковка",
      caption: "Можно показывать отдельный кадр для менеджера и КП.",
      src: "",
    },
  ];
}

function renderPhotoGallery(product) {
  return getDetailPhotos(product)
    .map(
      (photo, index) => `
        <article class="detail-photo-card">
          ${
            photo.src
              ? `<img class="detail-photo-image" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.title)}" />`
              : `
                <div class="detail-photo-placeholder" id="photo-placeholder-${product.id}-${index}">
                  <strong>${escapeHtml(product.normalized_name || product.raw_name || `Фото ${index + 1}`)}</strong>
                  <span>${escapeHtml(photo.title)}</span>
                  ${photo.showSearchBtn ? `<button class="ghost-btn" style="margin-top: 12px; align-self: start;" data-action="enrichRowPhoto" data-product-id="${product.id}">🔍 Найти в сети</button>` : ""}
                </div>
              `
          }
          <div class="detail-photo-copy">
            <strong>${escapeHtml(photo.title)}</strong>
            <span>${escapeHtml(photo.caption)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}


function renderDetailProperties(state, product, currentImport, isEditing = false) {
  const fields = [
    { label: "Наименование в прайсе", value: product.raw_name, editable: false },
    { label: "Разобранное имя", value: product.normalized_name, field: "manual_normalized_name", editable: true, kind: "text" },
    { label: "Категория", value: product.category, field: "category", editable: false },
    { label: "Страна", value: product.country, field: "country", editable: false },
    { label: "Объём (л)", value: product.volume_l, field: "volume_l", editable: false, kind: "number" },
    { label: "Закупочная цена", value: product.purchase_price, editable: false, kind: "number" },
    { label: "РРЦ", value: product.rrc_min, editable: false, kind: "number" },
    {
      label: "Статус проверки",
      value: product.review_status,
      field: "review_status",
      editable: true,
      kind: "select",
      options: [
        { value: "pending", label: "Ждёт проверки" },
        { value: "checked", label: "Проверено" },
        { value: "excluded", label: "Исключено" },
      ],
    },
  ];

  return `<div class="clean-property-list">
    ${fields.map(field => `
      <div class="clean-property-row ${isEditing && field.editable ? "is-editable" : ""}">
        <span class="property-label">${escapeHtml(field.label)}</span>
        <div class="property-value">
          ${
            isEditing && field.editable
              ? field.kind === "select"
                ? `
                  <select class="input minimal-input" data-change="setProductField" data-product-id="${product.id}" data-field="${field.field}">
                    ${field.options.map(o => `<option value="${o.value}" ${field.value === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
                  </select>
                `
                : `
                  <input
                    class="input minimal-input"
                    ${field.kind === "number" ? 'inputmode="decimal"' : ""}
                    value="${escapeHtml(formatValue(field.value ?? ""))}"
                    data-change="setProductField"
                    data-product-id="${product.id}"
                    data-field="${field.field}"
                  />
                `
              : `<strong>${escapeHtml(formatValue(
                  field.kind === "number" && field.field !== "volume_l"
                    ? formatMoney(field.value, currentImport.meta.currency)
                    : field.field === "review_status"
                      ? formatReviewStatus(field.value)
                      : field.value,
                ))}</strong>`
          }
        </div>
      </div>
    `).join("")}
  </div>`;
}

function renderRowDetailModal(state) {
  const product = getSelectedProductDetail(state);
  if (!product || state.ui.modal !== "row-details") return "";

  const currentImport = getCurrentImport(state);
  const supplier = getCurrentSupplier(state);
  const isEditing = Boolean(state.ui.rowDetailEditMode);

  return `
    <div class="modal-overlay">
      <div class="app-dialog row-detail-dialog clean-dialog">
        <div class="dialog-header row-detail-dialog-header">
          <div class="row-detail-heading">
            <span class="eyebrow">${escapeHtml(formatValue(supplier?.name))} · Строка ${product.row_index}</span>
            <h3>${escapeHtml(formatValue(product.normalized_name || product.raw_name))}</h3>
          </div>
          <div class="toolbar-actions row-detail-header-actions">
            <button class="ghost-btn" data-action="toggleRowDetailEditMode">${isEditing ? "Готово" : "Редактировать"}</button>
            <button class="ghost-btn" data-action="closeModal" aria-label="Закрыть">Закрыть</button>
          </div>
        </div>
        
        <div class="row-detail-shell clean-shell">
          <!-- Левая колонка: Характеристики -->
          <section class="detail-card clean-card">
            <div class="clean-card-header">
              <h3>Параметры позиции</h3>
            </div>
            ${renderDetailProperties(state, product, currentImport, isEditing)}
          </section>

          <!-- Правая колонка: Фото и каталог -->
          <section class="detail-card clean-card side-card">
            <div class="clean-card-header">
              <h3>Визуал и сопоставление</h3>
            </div>
            <div class="detail-photo-grid">
              ${renderPhotoGallery(product)}
            </div>
            ${
              product.manual_match_result
                ? `
                  <div class="match-card minimal-match">
                    <div class="match-card-header">
                      <strong>Товар в каталоге</strong>
                      <span class="pill pill-good">Выбрано</span>
                    </div>
                    <div class="match-grid">
                      <div><span>Наименование</span><strong>${escapeHtml(formatValue(product.manual_match_result.title))}</strong></div>
                      <div><span>Закупочная цена</span><strong>${formatMoney(product.manual_match_result.price_min)}</strong></div>
                    </div>
                  </div>
                `
                : '<div class="empty-block row-detail-empty">Сопоставление с каталогом пока не выполнено.</div>'
            }
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderRowDetailStub(state) {
  const product = getSelectedProductDetail(state);
  if (product) {
    return `
      <div class="empty-block">
        Для позиции <strong>${escapeHtml(formatValue(product.raw_name))}</strong> доступно расширенное окно деталей. Используйте кнопку <strong>Детали</strong> в таблице, чтобы посмотреть происхождение полей, ошибки разбора и блок фото.
      </div>
    `;
  }

  return `
    <div class="empty-block">
      Откройте детали конкретной строки, чтобы увидеть полный разбор позиции, происхождение полей, проблемы импорта и фото товара.
    </div>
  `;
}

function renderRowDetailPanel(state) {
  return `
    <div class="detail-grid">
      <section class="detail-card">
        <h3>Детали позиции</h3>
        <p class="hint">Отдельное окно содержит разбор полей, ошибки импорта, ручную корректировку и медиаблок.</p>
        ${renderRowDetailStub(state)}
      </section>
    </div>
  `;
}

function renderJobsPanel(state) {
  const jobs = getRuntimeJobs(state);
  if (state.runtime?.dataSource !== "local-api") return "";

  return `
    <article class="panel jobs-panel" style="display: flex; flex-direction: column;">
      <div class="panel-header">
        <div>
          <h2>Фоновые операции</h2>
          <p>Статус системных процессов.</p>
        </div>
        <button class="ghost-btn compact-action-btn icon-action-btn" data-action="refreshRemoteData" title="Обновить">↻</button>
      </div>
      <div class="table-wrap compact-table jobs-table-wrap" style="flex: 1; border: none;">
        <table>
          <thead>
            <tr>
              <th>Тип операции</th>
              <th>Статус</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            ${jobs.length === 0
              ? `<tr><td colspan="3" style="color: var(--text-2); text-align: center;">Операций пока нет</td></tr>`
              : jobs
                  .slice(0, 5)
                  .map(
                    (job) => `
                      <tr>
                        <td><span class="pill" style="font-size: 11px;">${escapeHtml(formatValue(job.type))}</span></td>
                        <td><span class="status-pill ${getImportStatusClass(job.status)}">${escapeHtml(formatImportStatus(job.status))}</span></td>
                        <td style="color: var(--text-2); font-size: 12px;">${escapeHtml(formatDateTime(job.updated_at))}</td>
                      </tr>
                    `,
                  )
                  .join("")
            }
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderIssuesModal(state) {
  const issues = getCurrentImportIssues(state);
  if (state.ui.modal !== "issues") return "";
  return `
    <div class="modal-overlay">
      <div class="app-dialog">
        <div class="dialog-header">
          <div>
            <h3>Проблемы парсинга</h3>
            <p>Ошибки и предупреждения текущего файла импорта.</p>
          </div>
          <button class="ghost-btn" data-action="closeModal">Закрыть</button>
        </div>
        <div class="dialog-grid">
          <section class="detail-card">
            <h3>Ошибки</h3>
            <pre>${escapeHtml(
              JSON.stringify(issues.filter((issue) => issue.severity === "error"), null, 2),
            )}</pre>
          </section>
          <section class="detail-card">
            <h3>Предупреждения</h3>
            <pre>${escapeHtml(
              JSON.stringify(issues.filter((issue) => issue.severity === "warning"), null, 2),
            )}</pre>
          </section>
        </div>
      </div>
    </div>
  `;
}

export function renderOverview(state) {
  const stats = getOverviewStats(state);
  const currentImport = getCurrentImport(state);
  const filterOptions = getFilterOptions(state);
  const visibleProducts = getVisibleProducts(state);
  const selectedCount = state.ui.selectedRowIds.length;

  return `
    <section class="view-stack overview-workspace">
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
        <article class="panel overview-files-panel" style="min-width: 0; display: flex; flex-direction: column;">
          <div class="panel-header overview-panel-header">
            <div class="overview-panel-headline">
              <h2>Файлы</h2>
              <p>Импортированные файлы, поиск и быстрый переход в КП.</p>
            </div>
            <div class="toolbar-actions overview-table-actions">
              <button class="ghost-btn icon-action-btn table-add-btn" data-action="openUploadFilesModal" title="Загрузить прайс-лист">+</button>
              <button class="ghost-btn compact-action-btn" data-action="dispatchSelectedImport" ${!state.ui.selectedImportId ? "disabled" : ""} title="Отправить обрабатывать ИИ">✨ ИИ</button>
              <button class="ghost-btn icon-action-btn table-danger-btn" style="color: var(--status-bad);" data-action="promptDeleteImport" ${!state.ui.selectedImportId ? "disabled" : ""} title="Удалить выбранный прайс">🗑️</button>
              <button class="ghost-btn compact-action-btn" data-action="openExportModal" title="Экспорт списка">Экспорт</button>
            </div>
          </div>
          <div class="table-wrap compact-table overview-imports-table" style="flex: 1;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th class="filterable-th">${renderImportColumnHeader("Файл", "file", state.ui.activeImportColumnFilter)}${renderImportColumnMenu(state, "file")}</th>
                  <th>Дата</th>
                  <th class="filterable-th">${renderImportColumnHeader("Формат", "format", state.ui.activeImportColumnFilter)}${renderImportColumnMenu(state, "format")}</th>
                  <th class="filterable-th">${renderImportColumnHeader("Поставщик", "supplier", state.ui.activeImportColumnFilter)}${renderImportColumnMenu(state, "supplier")}</th>
                  <th class="filterable-th">${renderImportColumnHeader("Тип", "type", state.ui.activeImportColumnFilter)}${renderImportColumnMenu(state, "type")}</th>
                  <th class="filterable-th">${renderImportColumnHeader("Статус", "status", state.ui.activeImportColumnFilter)}${renderImportColumnMenu(state, "status")}</th>
                  <th>Позиций</th>
                  <th>Проблемы</th>
                </tr>
              </thead>
              <tbody>${renderImportsTable(state)}</tbody>
            </table>
          </div>
        </article>
        ${renderJobsPanel(state)}
      </div>

      <article class="panel overview-products-panel">
        ${
          currentImport && ["queued", "pending", "processing"].includes(currentImport.status)
            ? `
              <div class="import-processing-banner">
                <div class="boot-loader" style="width:16px;height:16px;border-width:2px;flex-shrink:0;"></div>
                <div class="import-processing-banner-copy">
                  <strong>Файл передан на обработку</strong>
                  <span>ИИ анализирует прайс-лист. Данные появятся автоматически — можно не ждать у экрана.</span>
                </div>
              </div>
            `
            : currentImport && currentImport.status === "failed"
            ? `
              <div class="import-error-banner">
                <div class="import-error-banner-icon">⚠</div>
                <div class="import-error-banner-copy">
                  <strong>Обработка завершилась с ошибкой</strong>
                  <span>${escapeHtml(currentImport.meta?.last_error || "Неизвестная ошибка. Попробуйте загрузить файл повторно.")}</span>
                </div>
                <button class="ghost-btn compact-action-btn" data-action="retryImportDispatch" data-id="${escapeHtml(currentImport.id)}" style="flex-shrink:0;white-space:nowrap;">Повторить</button>
              </div>
            `
            : ""
        }
        <div class="panel-header overview-panel-header">
          <div class="overview-panel-headline">
            <h2>Позиции</h2>
            <p>${visibleProducts.length} строк в текущем представлении.</p>
          </div>
          <div class="overview-summary-inline">
            <span class="pill">Ошибки: ${stats.errors}</span>
            <span class="pill">Проверено: ${stats.checked}</span>
            ${currentImport
              ? `<span class="status-pill ${getImportStatusClass(currentImport.status)}">ИИ: ${escapeHtml(formatImportStatus(currentImport.status))}</span>`
              : ""}
          </div>
        </div>
        <div class="table-wrap overview-table-wrap">
          <div class="overview-table-toolbar" style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div class="toolbar-actions overview-table-actions">
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="openTableSettings" data-table="overview" title="Настроить столбцы" aria-label="Настройки">⚙</button>
              <div style="width: 1px; height: 16px; background: var(--border-color); margin: 0 4px;"></div>
              <span class="overview-selection-pill">Выбрано ${selectedCount}</span>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="selectAllVisibleRows" title="Выделить все строки после текущей фильтрации" aria-label="Выделить все">◎</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="clearSelectedRows" title="Снять текущее выделение" aria-label="Снять выделение">◌</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn icon-action-good" data-action="promptMarkSelectedChecked" title="Отметить выделенные строки как проверенные" aria-label="Проверено">✓</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn icon-action-bad" data-action="excludeSelectedRows" title="Исключить выделенные строки из дальнейшей обработки" aria-label="Исключить">×</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="openDetailsForSelectedRow" ${selectedCount !== 1 ? "disabled" : ""} title="Изменить детали (Для одной выбранной строки)">Детали</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="addSelectionToQuote" title="Добавить выделенные строки в состав КП">В КП</button>
              <button class="primary-btn compact-action-btn table-action-btn" data-action="buildQuote" title="Сформировать рабочий сценарий коммерческого предложения по выделенным строкам">Сформировать КП</button>
            </div>
            <div class="search-input-wrap" style="max-width: 320px; margin-left: auto;">
              <input type="text" class="text-input" placeholder="Поиск по названию или коду" style="width: 100%; border-radius: 8px; font-size: 13px;" value="${escapeHtml(state.ui.productSearchQuery || '')}" data-input="searchProducts" />
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th></th>
                ${state.ui.overviewTableColumns
                  .filter((col) => col.visible)
                  .map((col) => {
                     const def = PRODUCT_COLUMN_DEFS[col.id];
                     if (!def) return '<th></th>';
                     return def.renderTh((label, id) => renderColumnHeader(label, id, state.ui.activeColumnFilter), (id) => renderColumnMenu(state, filterOptions, id));
                  })
                  .join("")}
              </tr>
            </thead>
            <tbody>${renderProductsTable(state)}</tbody>
          </table>
        </div>
      </article>

      ${renderIssuesModal(state)}
      ${renderRowDetailModal(state)}
      ${
        currentImport && ["queued", "pending", "processing"].includes(currentImport.status) && visibleProducts.length === 0
          ? `
            <style>
              .overview-products-panel .overview-table-wrap { display: none; }
            </style>
            <div class="import-not-ready-empty">
              <div class="boot-loader" style="width:24px;height:24px;border-width:3px;"></div>
              <div>
                <strong>Файл обрабатывается</strong>
                <p>ИИ разбирает строки прайс-листа. Таблица позиций заполнится автоматически после завершения.</p>
              </div>
            </div>
          `
          : ""
      }
    </section>
  `;
}
