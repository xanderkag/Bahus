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
  formatMoney,
  formatNumber,
  formatPercent,
  formatValue,
} from "../utils/format.js";

function formatImportStatus(status) {
  const labels = {
    success: "Готово",
    parsed: "Разобрано",
    partial: "Требует проверки",
    error: "Ошибка импорта",
    pending: "В обработке",
    queued: "В очереди",
    uploaded: "Загружено",
    failed: "Ошибка обработки",
  };
  return labels[status] || formatValue(status);
}

function formatDocumentType(type) {
  const labels = {
    net_price: "Нетто-прайс",
    promo: "Промо",
    price_list: "Прайс-лист",
  };
  return labels[type] || formatValue(type);
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd} ${HH}:${min}`;
}

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
  return getVisibleImports(state)
    .map((item, index) => {
      const supplier = state.entities.suppliersById[item.supplier_id];
      const issueCount = item.issue_ids.length;
      return `
        <tr class="${selectedImportId === item.id ? "is-active" : ""}">
          <td>${index + 1}</td>
          <td>
            <button class="row-link" data-action="selectImport" data-import-id="${item.id}">
              ${escapeHtml(item.meta.source_file)}
            </button>
          </td>
          <td>${escapeHtml(item.created_at ? formatDateTime(item.created_at) : item.meta.import_date)}</td>
          <td>${escapeHtml(item.meta.source_format.toUpperCase())}</td>
          <td>${escapeHtml(formatValue(supplier?.name))}</td>
          <td>${escapeHtml(formatDocumentType(item.meta.document_type))}</td>
          <td><span class="status-pill">${escapeHtml(formatImportStatus(item.status))}</span></td>
          <td><span class="pill">${issueCount} проблем</span></td>
          <td>
            <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn table-add-btn" data-action="seedQuoteFromImport" data-import-id="${item.id}" title="Создать КП из файла" aria-label="Создать КП">+</button>
          </td>
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
      const clientPrice =
        typeof product.rrc_min === "number" ? product.rrc_min : product.purchase_price;
      const marginRub =
        typeof product.purchase_price === "number" && typeof product.rrc_min === "number"
          ? product.rrc_min - product.purchase_price
          : null;
      const marginPct =
        typeof marginRub === "number" && product.purchase_price
          ? (marginRub / product.purchase_price) * 100
          : null;

      return `
        <tr class="${selectedRows.has(product.id) ? "is-selected" : ""}">
          <td>
            <input
              type="checkbox"
              data-change="toggleRowSelection"
              data-product-id="${product.id}"
              ${selectedRows.has(product.id) ? "checked" : ""}
            />
          </td>
          <td>${product.row_index}</td>
          <td>
            <div class="table-title">${escapeHtml(formatValue(product.raw_name))}</div>
            <div class="table-subtitle">${escapeHtml(formatValue(product.normalized_name))}</div>
          </td>
          <td>${escapeHtml(formatValue(product.product_id || product.temp_id))}</td>
          <td>${escapeHtml(formatValue(product.country))}</td>
          <td>${escapeHtml(formatValue(product.category))}</td>
          <td>${formatNumber(product.volume_l)}</td>
          <td>${formatMoney(product.purchase_price, currentImport.meta.currency)}</td>
          <td>${formatMoney(product.rrc_min, currentImport.meta.currency)}</td>
          <td>${formatMoney(clientPrice, currentImport.meta.currency)}</td>
          <td>${formatMoney(marginRub, currentImport.meta.currency)}</td>
          <td>${formatPercent(marginPct)}</td>
          <td>${product.promo ? '<span class="pill pill-warn">Акция</span>' : '<span class="pill">Обычный</span>'}</td>
          <td><span class="pill pill-${issue.kind}">${issue.label}${issue.count ? ` · ${issue.count}` : ""}</span></td>
          <td><span class="pill">${escapeHtml(formatReviewStatus(product.review_status))}</span></td>
          <td>
            <button class="ghost-btn" data-action="openRowDetails" data-product-id="${product.id}">
              Детали
            </button>
          </td>
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
  const images = [
    ...(product.images || []),
    ...(product.manual_match_result?.images || []),
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
                <div class="detail-photo-placeholder">
                  <strong>${escapeHtml(product.normalized_name || product.raw_name || `Фото ${index + 1}`)}</strong>
                  <span>${escapeHtml(photo.title)}</span>
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
  const issues = getIssuesForProduct(state, product.id);
  const issueByField = new Map(issues.map((issue) => [issue.field, issue]));
  const clientPrice =
    typeof product.rrc_min === "number" ? product.rrc_min : product.purchase_price;
  const marginRub =
    typeof product.purchase_price === "number" && typeof clientPrice === "number"
      ? clientPrice - product.purchase_price
      : null;
  const marginPct =
    typeof marginRub === "number" && product.purchase_price
      ? (marginRub / product.purchase_price) * 100
      : null;

  const fields = [
    {
      label: "Исходное наименование",
      value: product.raw_name,
      source: `строка ${product.row_index} файла ${currentImport.meta.source_file}`,
    },
    {
      label: "Нормализованное имя",
      value: product.manual_normalized_name || product.normalized_name,
      source: product.manual_normalized_name ? "ручная нормализация" : "авторазбор",
      field: "normalized_name",
      editable: true,
      kind: "text",
    },
    {
      label: "ID товара",
      value: product.product_id || product.temp_id,
      source: product.product_id ? "идентификатор позиции" : "временный идентификатор до сопоставления",
    },
    {
      label: "Категория",
      value: product.category,
      source: issueByField.get("category")?.message || "разобрано из прайса",
      field: "category",
      editable: true,
      kind: "text",
    },
    {
      label: "Страна",
      value: product.country,
      source: issueByField.get("country")?.message || "разобрано из прайса",
      field: "country",
      editable: true,
      kind: "text",
    },
    {
      label: "Объём",
      value: product.volume_l,
      source: issueByField.get("volume_l")?.message || "значение из строки / авторазбор",
      field: "volume_l",
      editable: true,
      kind: "number",
    },
    {
      label: "Закупка",
      value: product.purchase_price,
      source: issueByField.get("purchase_price")?.message || "закупочная цена поставщика",
      field: "purchase_price",
      editable: true,
      kind: "number",
    },
    {
      label: "РРЦ",
      value: product.rrc_min,
      source: issueByField.get("rrc_min")?.message || "рекомендованная розничная цена",
      field: "rrc_min",
      editable: true,
      kind: "number",
    },
    {
      label: "Цена клиенту",
      value: formatMoney(clientPrice, currentImport.meta.currency),
      source: typeof product.rrc_min === "number" ? "берём из РРЦ" : "резервно из закупки",
    },
    {
      label: "Ориентир по марже",
      value: `${formatMoney(marginRub, currentImport.meta.currency)} · ${formatPercent(marginPct)}`,
      source: "предварительный расчёт от закупки и РРЦ, не финальная цена продажи",
    },
    {
      label: "Акция",
      value: product.promo ? "Да" : "Нет",
      source: "флаг из импортированной строки",
    },
    {
      label: "Статус проверки",
      value: product.review_status,
      source: product.excluded ? "позиция исключена вручную" : "рабочий статус проверки",
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

  return fields
    .map(
      (field) => `
        <article class="detail-property-card ${isEditing && field.editable ? "is-editable" : ""}">
          <span>${escapeHtml(field.label)}</span>
          ${
            isEditing && field.editable
              ? field.kind === "select"
                ? `
                  <select class="input detail-property-input" data-change="setProductField" data-product-id="${product.id}" data-field="${field.field}">
                    ${field.options
                      .map(
                        (option) => `<option value="${option.value}" ${field.value === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
                      )
                      .join("")}
                  </select>
                `
                : `
                  <input
                    class="input detail-property-input"
                    ${field.kind === "number" ? 'inputmode="decimal"' : ""}
                    value="${escapeHtml(formatValue(field.value ?? ""))}"
                    data-change="setProductField"
                    data-product-id="${product.id}"
                    data-field="${field.field}"
                    placeholder="${escapeHtml(field.label)}"
                  />
                `
              : `<strong>${escapeHtml(formatValue(
                  field.kind === "number" && field.field
                    ? field.field === "volume_l"
                      ? formatNumber(field.value)
                      : formatMoney(field.value, currentImport.meta.currency)
                    : field.field === "review_status"
                      ? formatReviewStatus(field.value)
                      : field.value,
                ))}</strong>`
          }
          <p>${escapeHtml(field.source)}</p>
        </article>
      `,
    )
    .join("");
}

function renderRowDetailModal(state) {
  const product = getSelectedProductDetail(state);
  if (!product || state.ui.modal !== "row-details") {
    return "";
  }

  const currentImport = getCurrentImport(state);
  const supplier = getCurrentSupplier(state);
  const issues = getIssuesForProduct(state, product.id);
  const issueSummary = getRowIssueSummary(state, product.id);
  const isEditing = Boolean(state.ui.rowDetailEditMode);

  return `
    <div class="modal-overlay">
      <div class="app-dialog row-detail-dialog">
        <div class="dialog-header row-detail-dialog-header">
          <div class="row-detail-heading">
            <span class="eyebrow">Позиция из прайса</span>
            <h3>${escapeHtml(formatValue(product.normalized_name || product.raw_name))}</h3>
            <p>Строка ${product.row_index} · ${escapeHtml(currentImport.meta.source_file)} · ${escapeHtml(formatValue(supplier?.name))}</p>
          </div>
          <div class="toolbar-actions row-detail-header-actions">
            <span class="pill pill-${issueSummary.kind}">${issueSummary.label}${issueSummary.count ? ` · ${issueSummary.count}` : ""}</span>
            <button class="ghost-btn" data-action="toggleRowDetailEditMode">${isEditing ? "Готово" : "Редактировать"}</button>
            <button class="ghost-btn" data-action="closeModal" aria-label="Закрыть окно деталей">Закрыть</button>
          </div>
        </div>
        <div class="row-detail-summary-wrap">
          <div class="row-detail-summary">
            <div class="compact-stat compact-stat-inline"><span>Код позиции</span><strong>${escapeHtml(formatValue(product.product_id || product.temp_id))}</strong></div>
            <div class="compact-stat compact-stat-inline"><span>Категория</span><strong>${escapeHtml(formatValue(product.category))}</strong></div>
            <div class="compact-stat compact-stat-inline"><span>Страна</span><strong>${escapeHtml(formatValue(product.country))}</strong></div>
            <div class="compact-stat compact-stat-inline"><span>Статус проверки</span><strong>${escapeHtml(formatReviewStatus(product.review_status))}</strong></div>
          </div>
        </div>
        <div class="row-detail-shell">
          <section class="detail-card row-detail-main">
            <div class="row-detail-card-header">
              <h3>Что у позиции сейчас</h3>
              <p class="hint">${isEditing ? "Измените спорные поля и подтвердите правки кнопкой «Готово»." : "Ключевые поля, которые уже извлечены из прайса и участвуют в review."}</p>
            </div>
            <div class="detail-properties-grid">
              ${renderDetailProperties(state, product, currentImport, isEditing)}
            </div>
          </section>
          <section class="detail-card row-detail-side">
            <div class="row-detail-card-header">
              <h3>Фото и карточка товара</h3>
              <p class="hint">Будут подтягиваться после сопоставления с каталогом или ручной загрузки.</p>
            </div>
            <div class="detail-photo-grid">
              ${renderPhotoGallery(product)}
            </div>
            ${
              product.manual_match_result
                ? `
                  <div class="match-card">
                    <div class="match-card-header">
                      <strong>Найденный товар каталога</strong>
                      <span class="pill pill-good">${escapeHtml(product.manual_match_result.catalog_id || product.manual_match_id || "сопоставлено")}</span>
                    </div>
                    <div class="match-grid">
                      <div><span>Наименование</span><strong>${escapeHtml(formatValue(product.manual_match_result.title))}</strong></div>
                      <div><span>Категория</span><strong>${escapeHtml(formatValue(product.manual_match_result.category))}</strong></div>
                      <div><span>Страны</span><strong>${escapeHtml(formatValue((product.manual_match_result.countries || []).join(", ")))}</strong></div>
                      <div><span>Поставщики</span><strong>${escapeHtml(formatValue((product.manual_match_result.supplier_names || []).join(", ")))}</strong></div>
                      <div><span>Мин. закупка</span><strong>${formatMoney(product.manual_match_result.price_min)}</strong></div>
                      <div><span>Макс. закупка</span><strong>${formatMoney(product.manual_match_result.price_max)}</strong></div>
                    </div>
                  </div>
                `
                : '<div class="empty-block row-detail-empty">Карточка каталога появится после сопоставления. Сюда же можно будет подтянуть фото, атрибуты и описание.</div>'
            }
          </section>
          <section class="detail-card">
            <div class="row-detail-card-header">
              <h3>Ошибки и замечания разбора</h3>
              <p class="hint">Здесь видно, что потребует ручной проверки перед добавлением позиции в КП.</p>
            </div>
            <div class="detail-list">
              ${
                issues.length
                  ? issues
                      .map(
                        (issue) => `
                          <div class="issue-row">
                            <span class="pill pill-${issue.severity === "error" ? "bad" : "warn"}">${issue.severity === "error" ? "Ошибка" : "Предупреждение"}</span>
                            <div>
                              <strong>${escapeHtml(issue.field)}</strong>
                              <div>${escapeHtml(issue.message)}</div>
                              ${
                                issue.raw_value !== undefined
                                  ? `<div class="hint">Исходное значение: ${escapeHtml(formatValue(issue.raw_value))}</div>`
                                  : ""
                              }
                            </div>
                          </div>
                        `,
                      )
                      .join("")
                  : '<div class="empty-block row-detail-empty">У этой строки нет ошибок парсинга. Можно переходить к проверке и добавлению в КП.</div>'
              }
            </div>
          </section>
          <section class="detail-card ${isEditing ? "" : "is-collapsed"}">
            <div class="row-detail-card-header">
              <h3>Ручная корректировка</h3>
              <p class="hint">Используйте только для спорных строк, которые не удалось разобрать автоматически.</p>
            </div>
            <div class="future-stack">
              <div class="form-stack">
                <label class="field-label">Нормализованное имя</label>
                <input class="input" value="${escapeHtml(product.manual_normalized_name || product.normalized_name || "")}" data-input="setProductField" data-product-id="${product.id}" data-field="manual_normalized_name" placeholder="Нормализованное имя" />
                <textarea class="input textarea compact-textarea" data-input="setProductField" data-product-id="${product.id}" data-field="normalization_note" placeholder="Почему поменяли имя и что важно учесть">${escapeHtml(product.normalization_note || "")}</textarea>
                <button class="ghost-btn" data-action="saveManualNormalization" data-product-id="${product.id}">Сохранить нормализацию</button>
              </div>
              <div class="form-stack">
                <label class="field-label">Сопоставление с каталогом</label>
                <input class="input" value="${escapeHtml(product.manual_match_id || "")}" data-input="setProductField" data-product-id="${product.id}" data-field="manual_match_id" placeholder="Код каталога / код сопоставления" />
                <button class="ghost-btn" data-action="saveManualMatch" data-product-id="${product.id}">Сохранить сопоставление</button>
              </div>
            </div>
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
  const resource = state.runtime?.resources?.jobs;
  if (state.runtime?.dataSource !== "local-api") return "";

  return `
    <article class="panel jobs-panel">
      <div class="panel-header">
        <div>
          <h2>Фоновые операции</h2>
          <p>Служебный блок для этапов разбора, нормализации, сопоставления и выгрузки.</p>
        </div>
        <button class="ghost-btn" data-action="refreshRemoteData">Обновить операции</button>
      </div>
      <div class="resource-banner">
        <span class="pill">Статус API: ${escapeHtml(formatValue(resource?.status || "idle"))}</span>
        ${resource?.error ? `<span class="pill pill-bad">${escapeHtml(resource.error)}</span>` : ""}
      </div>
      <div class="toolbar-actions jobs-actions" style="margin-top:12px;">
        <button class="ghost-btn" data-action="triggerJob" data-job-type="parse" data-target="${escapeHtml(state.ui.selectedImportId)}">Запустить разбор</button>
        <button class="ghost-btn" data-action="triggerJob" data-job-type="normalize" data-target="${escapeHtml(state.ui.selectedImportId)}">Запустить нормализацию</button>
        <button class="ghost-btn" data-action="triggerJob" data-job-type="match" data-target="${escapeHtml(state.ui.selectedImportId)}">Запустить сопоставление</button>
        <button class="ghost-btn" data-action="triggerJob" data-job-type="export_quote" data-target="quote_draft">Запустить выгрузку</button>
      </div>
      <div class="table-wrap jobs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Операция</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Цель</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            ${jobs
              .map(
                (job) => `
                  <tr>
                    <td><div class="table-title">${escapeHtml(job.id)}</div></td>
                    <td>${escapeHtml(formatValue(job.type))}</td>
                    <td><span class="pill ${job.status === "done" ? "pill-good" : "pill-warn"}">${job.status === "done" ? "Завершено" : escapeHtml(formatValue(job.status))}</span></td>
                    <td>${escapeHtml(job.target)}</td>
                    <td>${escapeHtml(job.updated_at)}</td>
                  </tr>
                `,
              )
              .join("")}
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
      <article class="panel overview-files-panel">
        <div class="panel-header overview-panel-header">
          <div class="overview-panel-headline">
            <h2>Файлы</h2>
            <p>Импортированные файлы, поиск и быстрый переход в КП.</p>
          </div>
          <div class="toolbar-actions overview-table-actions">
            <button class="ghost-btn compact-action-btn" data-action="openExportModal">Экспорт</button>
            <button class="ghost-btn compact-action-btn" data-action="openUploadFilesModal" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 4px 12px;">Загрузить прайс-лист</button>
            <button class="ghost-btn compact-action-btn" data-action="resetImportFilters" title="Сбросить фильтры файлов">Сбросить</button>
          </div>
        </div>
        <div class="table-wrap compact-table overview-imports-table">
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
                <th>Проблемы</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderImportsTable(state)}</tbody>
          </table>
        </div>
      </article>

      <article class="panel overview-products-panel">
        <div class="panel-header overview-panel-header">
          <div class="overview-panel-headline">
            <h2>Позиции</h2>
            <p>${visibleProducts.length} строк в текущем представлении.</p>
          </div>
          <div class="overview-summary-inline">
            <span class="pill">Строк: ${stats.totalRows}</span>
            <span class="pill">Ошибки: ${stats.errors}</span>
            <span class="pill">Предупреждения: ${stats.warnings}</span>
            <span class="pill">Проверено: ${stats.checked}</span>
            <span class="pill">Исключено: ${stats.excluded}</span>
            <span class="pill ${selectedCount ? "pill-accent" : ""}">Выбрано: ${selectedCount}</span>
            ${currentImport ? `<span class="pill ${currentImport?.status === 'completed' || currentImport?.status === 'ready' ? 'pill-good' : currentImport?.status === 'error' ? 'pill-bad' : currentImport?.status === 'queued' || currentImport?.status === 'processing' ? 'pill-warn' : ''}">ИИ: ${currentImport?.status === 'completed' || currentImport?.status === 'ready' ? 'Обработано' : currentImport?.status === 'queued' ? 'В очереди' : currentImport?.status === 'error' ? 'Ошибка обработки' : currentImport?.status === 'processing' ? 'Обрабатывается...' : currentImport?.status || 'Ожидание'}</span>` : ''}
            <button class="ghost-btn compact-action-btn table-action-btn" data-action="openCurrentImportInFiles">К импорту</button>
          </div>
        </div>
        <div class="table-wrap overview-table-wrap">
          <div class="overview-table-toolbar">
            <div class="toolbar-actions overview-table-actions">
              <span class="overview-selection-pill">Выбрано ${selectedCount}</span>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="selectAllVisibleRows" title="Выделить все строки после текущей фильтрации" aria-label="Выделить все">◎</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="clearSelectedRows" title="Снять текущее выделение" aria-label="Снять выделение">◌</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn icon-action-good" data-action="markSelectedChecked" title="Отметить выделенные строки как проверенные" aria-label="Проверено">✓</button>
              <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn icon-action-bad" data-action="excludeSelectedRows" title="Исключить выделенные строки из дальнейшей обработки" aria-label="Исключить">×</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="addSelectionToQuote" title="Добавить выделенные строки в состав КП">В КП</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="openIssuesModal" title="Открыть список ошибок и предупреждений по текущему файлу">Проблемы</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="resetFilters" title="Сбросить все фильтры">Сбросить</button>
              <button class="ghost-btn compact-action-btn table-action-btn" data-action="triggerImportAiProcessing" title="Запустить внешнюю ИИ-обработку текущего импорта">${currentImport?.status === 'processing' ? "ИИ-обработка..." : "Обработка ИИ"}</button>
              <button class="primary-btn compact-action-btn table-action-btn" data-action="buildQuote" title="Сформировать рабочий сценарий коммерческого предложения по выделенным строкам">Сформировать КП</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Строка</th>
                <th class="filterable-th">${renderColumnHeader("Наименование", "name", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "name")}</th>
                <th class="filterable-th">${renderColumnHeader("Код", "code", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "code")}</th>
                <th class="filterable-th">${renderColumnHeader("Страна", "country", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "country")}</th>
                <th class="filterable-th">${renderColumnHeader("Категория", "category", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "category")}</th>
                <th class="filterable-th">${renderColumnHeader("Объём", "volume_l", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "volume_l")}</th>
                <th class="filterable-th">${renderColumnHeader("Закупка", "purchase_price", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "purchase_price")}</th>
                <th class="filterable-th">${renderColumnHeader("РРЦ", "rrc_min", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "rrc_min")}</th>
                <th class="filterable-th">${renderColumnHeader("Цена клиенту", "client_price", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "client_price")}</th>
                <th class="filterable-th">${renderColumnHeader("Маржа", "margin_rub", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "margin_rub")}</th>
                <th class="filterable-th">${renderColumnHeader("Маржа %", "margin_pct", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "margin_pct")}</th>
                <th class="filterable-th">${renderColumnHeader("Акция", "promo", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "promo")}</th>
                <th class="filterable-th">${renderColumnHeader("Проблемы", "issues", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "issues")}</th>
                <th class="filterable-th">${renderColumnHeader("Проверка", "review_status", state.ui.activeColumnFilter)}${renderColumnMenu(state, filterOptions, "review_status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderProductsTable(state)}</tbody>
          </table>
        </div>
      </article>

      ${renderJobsPanel(state)}

      ${renderIssuesModal(state)}
      ${renderRowDetailModal(state)}
    </section>
  `;
}
