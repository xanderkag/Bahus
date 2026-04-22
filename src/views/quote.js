import {
  enrichQuoteItems,
  findAlternatives,
  getCurrentQuoteRecord,
  getQuoteAlerts,
  getQuoteClients,
  getQuoteListOptions,
  getQuoteMeta,
  getQuotePreviewRows,
  getVisibleQuotes,
  getSelectedClient,
  getQuoteSummary,
} from "../state/selectors.js";
import {
  escapeHtml,
  formatMoney,
  formatNumber,
  formatPercent,
  formatValue,
  pluralize,
} from "../utils/format.js";

const QUOTE_STATUS_LABELS = {
  draft: "Черновик",
  review: "На проверке",
  ready: "Готово",
};

function formatQuoteStatus(status) {
  return QUOTE_STATUS_LABELS[status] || formatValue(status);
}

const AI_STATUS_LABELS = {
  idle: "Не запускали",
  queued: "В очереди",
  running: "В работе",
  ready: "Готово",
  error: "Ошибка",
};

function formatAiProcessingStatus(status) {
  return AI_STATUS_LABELS[status] || formatValue(status);
}

function summarizeQuoteRecord(quote) {
  const items = quote.items || [];
  const summary = items.reduce(
    (acc, item) => {
      const qty = Number(item.qty || 0);
      const purchase = typeof item.purchase_price === "number" ? item.purchase_price * qty : 0;
      const sale = typeof item.sale_price === "number" ? item.sale_price * qty : 0;
      acc.positions += 1;
      acc.qty += qty;
      acc.sale += sale;
      acc.purchase += purchase;
      return acc;
    },
    { positions: 0, qty: 0, sale: 0, purchase: 0 },
  );

  const margin = summary.sale - summary.purchase;
  return {
    ...summary,
    margin,
    marginPct: summary.purchase > 0 ? (margin / summary.purchase) * 100 : null,
  };
}

const quoteColumns = [
  { key: "alternatives", label: "Аналоги", minWidth: 70 },
  { key: "row", label: "Строка", minWidth: 62 },
  { key: "product", label: "Товар", minWidth: 240 },
  { key: "volume", label: "Объём", minWidth: 76 },
  { key: "qty", label: "Кол-во", minWidth: 90 },
  { key: "purchase", label: "Закупка", minWidth: 104 },
  { key: "rrc", label: "RRC", minWidth: 92 },
  { key: "sale", label: "Цена продажи", minWidth: 126 },
  { key: "marginRub", label: "Маржа", minWidth: 104 },
  { key: "marginPct", label: "Маржа %", minWidth: 88 },
  { key: "lineSum", label: "Сумма", minWidth: 108 },
  { key: "status", label: "Статус", minWidth: 100 },
  { key: "alternativesAction", label: "", minWidth: 102 },
  { key: "removeAction", label: "", minWidth: 102 },
];

function renderQuoteColGroup(state) {
  const widths = state.ui.quoteTableColumns || {};
  return `
    <colgroup>
      ${quoteColumns
        .map((column) => `<col style="width:${Math.max(column.minWidth, widths[column.key] || column.minWidth)}px">`)
        .join("")}
    </colgroup>
  `;
}

function renderQuoteTableHeader(state) {
  const widths = state.ui.quoteTableColumns || {};
  return quoteColumns
    .map((column) => {
      const width = Math.max(column.minWidth, widths[column.key] || column.minWidth);
      return `
        <th style="min-width:${column.minWidth}px;width:${width}px;">
          <div class="table-head-cell ${column.label ? "" : "is-blank"}">
            <span>${column.label || "&nbsp;"}</span>
            <button
              class="column-resize-handle"
              type="button"
              aria-label="Изменить ширину колонки ${column.label || "служебной"}"
              data-resize-column="${column.key}"
              data-min-width="${column.minWidth}"
            ></button>
          </div>
        </th>
      `;
    })
    .join("");
}

function renderClientPicker(state) {
  const meta = getQuoteMeta(state);
  const selectedClient = getSelectedClient(state);
  const clients = getQuoteClients(state).slice(0, 7);
  const isOpen = state.ui.clientPickerOpen;
  return `
    <div class="client-picker ${isOpen ? "is-open" : ""}">
      <button
        class="client-picker-trigger"
        type="button"
        data-action="${isOpen ? "closeClientPicker" : "openClientPicker"}"
        aria-label="Открыть справочник клиентов"
      >
        <span class="client-picker-label">Клиент из базы</span>
        <span class="client-picker-value">${escapeHtml(selectedClient?.name || meta.clientName || "Выберите клиента из справочника")}</span>
        <span class="client-picker-hint">${selectedClient ? `${escapeHtml(selectedClient.city || "—")} · ИНН ${escapeHtml(selectedClient.inn || "—")}` : "Поиск по базе клиентов"}</span>
      </button>
      ${
        isOpen
          ? `
            <div class="client-picker-dropdown">
              <input
                class="input client-picker-input"
                placeholder="Найти по названию, ИНН или городу"
                value="${escapeHtml(state.ui.clientPickerQuery)}"
                data-input="setClientPickerQuery"
              />
              <div class="client-picker-options">
                ${
                  clients.length
                    ? clients
                        .map(
                          (client) => `
                            <button
                              class="client-option ${selectedClient?.id === client.id ? "is-active" : ""}"
                              type="button"
                              data-action="selectClient"
                              data-client-id="${client.id}"
                              title="${escapeHtml(client.name)}"
                            >
                              <span class="client-option-name">${escapeHtml(client.name)}</span>
                              <span class="client-option-meta">${escapeHtml(client.city || "—")} · ИНН ${escapeHtml(client.inn || "—")}</span>
                            </button>
                          `,
                        )
                        .join("")
                    : '<div class="empty-block compact-empty">По вашему запросу в справочнике пока ничего не найдено.</div>'
                }
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderQuoteListColumnHeader(label, column, activeColumnFilter) {
  const isActive = activeColumnFilter === column;
  return `
    <div class="column-header">
      <span>${escapeHtml(label)}</span>
      <button
        class="column-filter-btn ${isActive ? "is-active" : ""}"
        data-action="toggleQuoteListColumnFilter"
        data-column="${column}"
        aria-label="Фильтр по колонке ${escapeHtml(label)}"
        title="Фильтр по колонке ${escapeHtml(label)}"
      >
        ▾
      </button>
    </div>
  `;
}

function renderQuoteListSortControls(column, sort) {
  const isAsc = sort?.column === column && sort?.direction === "asc";
  const isDesc = sort?.column === column && sort?.direction === "desc";
  return `
    <div class="column-menu-sort">
      <button class="ghost-btn compact-action-btn ${isAsc ? "is-active" : ""}" data-action="setQuoteListSort" data-column="${column}" data-direction="asc">Сортировать A→Я</button>
      <button class="ghost-btn compact-action-btn ${isDesc ? "is-active" : ""}" data-action="setQuoteListSort" data-column="${column}" data-direction="desc">Сортировать Я→A</button>
    </div>
  `;
}

function renderQuoteListChoiceList(field, values, selectedValues) {
  return `
    <div class="column-menu-list">
      ${values
        .map(
          (item) => `
            <label class="column-menu-option">
              <input
                type="checkbox"
                data-change="toggleQuoteListFilterChoice"
                data-field="${field}"
                data-value="${escapeHtml(item.value)}"
                ${selectedValues.includes(item.value) ? "checked" : ""}
              />
              <span>${escapeHtml(item.label)}</span>
              <button class="ghost-btn compact-action-btn" type="button" data-action="setSingleQuoteListFilterChoice" data-field="${field}" data-value="${escapeHtml(item.value)}">Только</button>
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderQuoteListColumnMenu(state, column) {
  if (!column || state.ui.activeQuoteListColumnFilter !== column) return "";
  const options = getQuoteListOptions(state);
  const contentByColumn = {
    quoteNumber: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
      <div class="column-menu-search">
        <input class="input input-compact" placeholder="Поиск (клиент, статус...)" value="${escapeHtml(state.ui.quoteListFilters.query || "")}" data-input="setQuoteListTextFilter" data-field="query" />
      </div>
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearQuoteListColumnFilter" data-field="query">Сбросить</button>
      </div>
    `,
    quoteDate: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
    `,
    client: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
      ${renderQuoteListChoiceList("client", options.clients.map((value) => ({ value, label: value })), state.ui.quoteListFilters.client || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearQuoteListColumnFilter" data-field="client">Сбросить</button>
      </div>
    `,
    manager: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
      ${renderQuoteListChoiceList("manager", options.managers.map((value) => ({ value, label: value })), state.ui.quoteListFilters.manager || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearQuoteListColumnFilter" data-field="manager">Сбросить</button>
      </div>
    `,
    status: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
      ${renderQuoteListChoiceList("status", options.statuses, state.ui.quoteListFilters.status || [])}
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearQuoteListColumnFilter" data-field="status">Сбросить</button>
      </div>
    `,
    requestTitle: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
      <div class="column-menu-search">
        <input class="input input-compact" placeholder="Поиск по теме КП" value="${escapeHtml(state.ui.quoteListFilters.query || "")}" data-input="setQuoteListTextFilter" data-field="query" />
      </div>
      <div class="column-menu-footer">
        <button class="ghost-btn compact-action-btn" data-action="clearQuoteListColumnFilter" data-field="query">Сбросить</button>
      </div>
    `,
    positions: `
      ${renderQuoteListSortControls(column, state.ui.quoteListSort)}
    `,
  };

  const labels = {
    quoteNumber: "КП",
    quoteDate: "Дата",
    client: "Клиент",
    manager: "Менеджер",
    status: "Статус",
    requestTitle: "Тема",
    positions: "Позиции",
  };

  return `
    <div class="column-menu">
      <div class="column-menu-header">
        <strong>${escapeHtml(labels[column] || column)}</strong>
        <button class="ghost-btn compact-action-btn icon-action-btn table-icon-btn" data-action="toggleQuoteListColumnFilter" data-column="${column}" aria-label="Закрыть фильтр">×</button>
      </div>
      ${contentByColumn[column] || ""}
    </div>
  `;
}

function renderQuotesTable(state) {
  const selectedQuoteId = state.ui.selectedQuoteId;
  return getVisibleQuotes(state)
    .map((quote, index) => {
      const summary = summarizeQuoteRecord(quote);
      return `
        <tr class="${selectedQuoteId === quote.id ? "is-active" : ""}">
          <td>${index + 1}</td>
          <td>
            <button class="row-link" data-action="selectQuote" data-quote-id="${quote.id}">
              ${escapeHtml(quote.meta?.quoteNumber || "Без номера")}
            </button>
          </td>
          <td>${escapeHtml(quote.meta?.quoteDate || "—")}</td>
          <td>${escapeHtml(quote.meta?.clientName || "Не выбран")}</td>
          <td>${escapeHtml(quote.meta?.requestTitle || "Новая подборка")}</td>
          <td>${escapeHtml(quote.meta?.managerName || "—")}</td>
          <td>${quote.meta?.mode === "internal" ? "Внутренний" : "Клиентский"}</td>
          <td>${summary.positions}</td>
          <td>${formatMoney(summary.sale)}</td>
          <td>${formatPercent(summary.marginPct)}</td>
          <td><span class="status-pill">${escapeHtml(formatQuoteStatus(quote.status))}</span></td>
          <td>
            <button class="toolbar-btn" data-action="selectQuote" data-quote-id="${quote.id}" title="Открыть позиции КП" aria-label="Открыть КП">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <span>Открыть</span>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderQuotePreviewModal(state) {
  if (state.ui.modal !== "quote-preview") return "";
  return `
    <div class="modal-overlay">
      <div class="app-dialog quote-preview-dialog">
        <div class="dialog-header">
          <div>
            <h3>Предпросмотр КП</h3>
            <p>Отдельный слой для просмотра клиентской версии без перегруза основного рабочего экрана.</p>
          </div>
          <button class="ghost-btn" data-action="closeModal">Закрыть</button>
        </div>
        ${renderPreview(state)}
      </div>
    </div>
  `;
}

function renderQuoteTable(state) {
  const items = enrichQuoteItems(state);
  const currency = "RUB";

  if (!items.length) {
    return `
      <tr>
        <td colspan="14">
          <div class="empty-block">
            В КП пока нет позиций. Добавьте выбранные строки из review или используйте быстрый сценарий заполнения.
          </div>
        </td>
      </tr>
    `;
  }

  return items
    .map((item) => {
      const alternatives = findAlternatives(state, item.id);
      const marginClass =
        typeof item.marginRub === "number" && item.marginRub < 0 ? "pill-bad" : "pill-good";
      const pricingState =
        typeof item.sale_price !== "number" || item.sale_price <= 0
          ? '<span class="pill pill-bad">Нужна цена</span>'
          : typeof item.rrc_min !== "number"
            ? '<span class="pill pill-warn">RRC нет</span>'
            : '<span class="pill pill-good">Готово</span>';
      return `
        <tr>
          <td><span class="pill">${alternatives.length}</span></td>
          <td>${item.row_index}</td>
          <td>
            <div class="table-title">${escapeHtml(formatValue(item.name))}</div>
            <div class="table-subtitle">${escapeHtml(formatValue(item.normalized_name))} · ${escapeHtml(formatValue(item.country))} · ${escapeHtml(formatValue(item.category))}</div>
          </td>
          <td>${formatNumber(item.volume_l)}</td>
          <td><input class="input input-compact" value="${item.qty}" data-change="setQuoteItemQty" data-item-id="${item.id}" /></td>
          <td>${formatMoney(item.purchase_price, currency)}</td>
          <td>${formatMoney(item.rrc_min, currency)}</td>
          <td><input class="input input-compact" value="${item.sale_price ?? ""}" data-change="setQuoteItemSale" data-item-id="${item.id}" /></td>
          <td><span class="pill ${marginClass}">${formatMoney(item.marginRub, currency)}</span></td>
          <td>${formatPercent(item.marginPct)}</td>
          <td>${formatMoney(item.lineSum, currency)}</td>
          <td>${pricingState}</td>
          <td>
            <button class="toolbar-btn" data-action="toggleAlternativeBlock" data-item-id="${item.id}" title="Показать аналоги для этой позиции">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 16 4-4-4-4"/><path d="m17 16-4-4 4-4"/></svg>
              <span>Аналоги</span>
            </button>
          </td>
          <td>
            <button class="toolbar-btn toolbar-btn-danger" data-action="removeQuoteItem" data-item-id="${item.id}" title="Убрать позицию из КП">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span>Удалить</span>
            </button>
          </td>
        </tr>
        ${
          item.alternative_open
            ? `
              <tr class="subtable-row">
                <td colspan="14">
                  ${renderAlternativesTable(item.id, alternatives)}
                </td>
              </tr>
            `
            : ""
        }
      `;
    })
    .join("");
}

function renderAlternativesTable(itemId, alternatives) {
  if (!alternatives.length) {
    return `
      <div class="inline-card quote-alternatives-card">
        <div class="empty-block quote-alternatives-empty">
          Подходящих альтернатив пока не найдено. Следующим шагом сюда можно будет подключить более точный ассортиментный match.
        </div>
      </div>
    `;
  }

  return `
    <div class="inline-card quote-alternatives-card">
      <div class="inline-card-header quote-alternatives-header">
        <div class="quote-alternatives-headline">
          <strong>Альтернативные товары</strong>
          <span class="table-subtitle">${alternatives.length} вариантов для быстрой замены позиции</span>
        </div>
        <button class="toolbar-btn toolbar-btn-primary" data-action="useBestAlternative" data-item-id="${itemId}" title="Автоматически выбрать лучший аналог">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Выбрать лучший</span>
        </button>
      </div>
      <table class="nested-table quote-alternatives-table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th>Поставщик</th>
            <th>Объём</th>
            <th>Закупка</th>
            <th>RRC</th>
            <th>Сходство</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${alternatives
            .map(
              (alternative, index) => `
                <tr class="${index === 0 ? "is-best-alternative" : ""}">
                  <td>
                    <div class="table-title">${escapeHtml(alternative.raw_name)}</div>
                    <div class="table-subtitle">${escapeHtml(alternative.importRecord.meta.source_file)} · ${escapeHtml(alternative.country || "—")} · ${escapeHtml(alternative.category || "—")}</div>
                  </td>
                  <td>${escapeHtml(alternative.supplier?.name || "—")}</td>
                  <td>${formatNumber(alternative.volume_l)}</td>
                  <td>${formatMoney(alternative.purchase_price)}</td>
                  <td>${formatMoney(alternative.rrc_min)}</td>
                  <td>
                    <div class="quote-alternative-match">
                      <span class="pill pill-accent">${alternative.score >= 8 ? "Высокое" : alternative.score >= 6 ? "Хорошее" : "Базовое"}</span>
                      <span class="hint">${alternative.score}/10</span>
                    </div>
                  </td>
                  <td>
                    <button class="toolbar-btn ${index === 0 ? "toolbar-btn-primary" : ""}" data-action="applyAlternative" data-item-id="${itemId}" data-alternative-id="${alternative.id}" title="Заменить текущую позицию на этот аналог">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      <span>${index === 0 ? "Выбрать лучший" : "Выбрать"}</span>
                    </button>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPreview(state) {
  const meta = getQuoteMeta(state);
  const summary = getQuoteSummary(state);
  const rows = getQuotePreviewRows(state);

  if (!rows.length) {
    return `<div class="empty-block">Сформируйте состав КП, чтобы увидеть предпросмотр клиентской версии документа.</div>`;
  }

  return `
    <div class="preview-sheet">
      <div class="preview-header">
        <div>
          <h3>Коммерческое предложение</h3>
          <p>№ ${escapeHtml(meta.quoteNumber)} от ${escapeHtml(meta.quoteDate)}</p>
        </div>
        <div class="preview-company">
          <strong>Bahus Assistant</strong>
          <span>Менеджер: ${escapeHtml(meta.managerName || "—")}</span>
          <span>Режим: ${meta.mode === "internal" ? "внутренний" : "клиентский"}</span>
        </div>
      </div>
      <div class="preview-meta">
        <div><strong>Клиент:</strong> ${escapeHtml(meta.clientName || "не выбран")}</div>
        <div><strong>Комментарий:</strong> ${escapeHtml(meta.note || "—")}</div>
      </div>
      <table class="preview-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Позиция</th>
            <th>Объём</th>
            <th>Кол-во</th>
            <th>Цена</th>
            <th>Сумма</th>
            ${
              meta.mode === "internal"
                ? "<th>Закупка</th><th>Маржа %</th>"
                : ""
            }
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${row.index}</td>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${formatNumber(row.volume)}</td>
                  <td>${row.qty}</td>
                  <td>${formatMoney(row.sale)}</td>
                  <td>${formatMoney(row.lineSum)}</td>
                  ${
                    meta.mode === "internal"
                      ? `<td>${formatMoney(row.purchase)}</td><td>${row.marginPctLabel}</td>`
                      : ""
                  }
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      <div class="preview-total">Итого: ${formatMoney(summary.sale)}</div>
    </div>
  `;
}

export function renderQuote(state) {
  const summary = getQuoteSummary(state);
  const meta = getQuoteMeta(state);
  const alerts = getQuoteAlerts(state);
  const draftResource = state.runtime?.resources?.quoteDraft;
  const currentQuoteRecord = getCurrentQuoteRecord(state);
  const aiStatus = meta.aiProcessingStatus || "idle";
  const workflowEndpoint = String(state.settings?.workflow_endpoint || "");
  const hasRealWorkflowEndpoint = /^https?:\/\//i.test(workflowEndpoint);
  const localQuoteFile = state.ui.selectedQuoteId ? state.runtime?.quoteRequestFilesByQuoteId?.[state.ui.selectedQuoteId] : null;
  const hasRemoteFile = Boolean(meta.requestFiles?.some((file) => file?.downloadUrl || file?.storagePath)) || Boolean(localQuoteFile);
  const hasInput = Boolean(meta.requestFiles?.length || meta.note);
  const canRunAi = hasInput && hasRealWorkflowEndpoint && hasRemoteFile;

  return `
    <section class="view-stack quote-workspace">
      <article class="panel quote-list-panel">
        <div class="panel-header quote-panel-header">
          <div class="quote-panel-headline">
            <h2>Коммерческие предложения</h2>
            <p>Рабочий список КП с выбором строки, созданием нового предложения и быстрым переходом в детализацию.</p>
          </div>
          <div class="toolbar-actions">
            <button class="toolbar-btn" data-action="resetQuoteListFilters" title="Сбросить все фильтры в таблице КП">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
              <span>Сбросить фильтры</span>
            </button>
            <button class="toolbar-btn toolbar-btn-primary" data-action="openNewQuoteModal" title="Создать новое коммерческое предложение">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              <span>Создать КП</span>
            </button>
          </div>
        </div>
        <div class="table-wrap quote-list-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${renderQuoteListColumnHeader("КП", "quoteNumber", state.ui.activeQuoteListColumnFilter)}</th>
                <th>${renderQuoteListColumnHeader("Дата", "quoteDate", state.ui.activeQuoteListColumnFilter)}</th>
                <th>${renderQuoteListColumnHeader("Клиент", "client", state.ui.activeQuoteListColumnFilter)}</th>
                <th>${renderQuoteListColumnHeader("Тема", "requestTitle", state.ui.activeQuoteListColumnFilter)}</th>
                <th>${renderQuoteListColumnHeader("Менеджер", "manager", state.ui.activeQuoteListColumnFilter)}</th>
                <th>Режим</th>
                <th>${renderQuoteListColumnHeader("Позиции", "positions", state.ui.activeQuoteListColumnFilter)}</th>
                <th>Сумма</th>
                <th>Маржа %</th>
                <th>${renderQuoteListColumnHeader("Статус", "status", state.ui.activeQuoteListColumnFilter)}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderQuotesTable(state)}</tbody>
          </table>
          ${renderQuoteListColumnMenu(state, state.ui.activeQuoteListColumnFilter)}
        </div>
      </article>
      <article class="panel quote-items-panel">
        <div class="panel-header quote-panel-header">
          <div class="quote-panel-headline" style="display: flex; align-items: flex-start; gap: 8px;">
            <div>
              <h2 style="display: flex; align-items: center; gap: 8px;">
                Позиции КП
                <button class="ghost-btn icon-btn" style="padding: 4px; height: auto; min-width: 0; color: var(--muted);" data-action="openQuoteSettings" title="Настроить параметры КП (клиент, файлы запроса)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
              </h2>
              <p>
                ${escapeHtml(currentQuoteRecord?.meta?.quoteNumber || meta.quoteNumber)} · ${escapeHtml(currentQuoteRecord?.meta?.requestTitle || "Выбранное коммерческое предложение")}
              </p>
            </div>
          </div>
          <div class="toolbar-actions quote-actions">
            <button class="toolbar-btn" data-action="goToReview" title="Вернуться в каталог и добавить новые позиции">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              <span>Добавить позицию</span>
            </button>
            <button class="toolbar-btn" data-action="runQuoteAiProcessing" ${canRunAi ? "" : "disabled"} title="Запустить ИИ-подбор по прикрепленному файлу клиента">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>
              <span>${aiStatus === "running" ? "Обработка ИИ..." : "Авто-подбор (ИИ)"}</span>
            </button>
            <button class="toolbar-btn toolbar-btn-primary" data-action="downloadQuoteExcel" title="Скачать готовое КП в Excel">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>Скачать Excel</span>
            </button>
          </div>
        </div>
        <div class="quote-alert-strip">
          <span class="pill ${alerts.total ? "pill-warn" : "pill-good"}">
            ${alerts.total ? `Есть рабочие замечания: ${alerts.total}` : "КП выглядит готовым к отправке"}
          </span>
          <span class="pill">${meta.mode === "internal" ? "Внутренний режим" : "Клиентский режим"}</span>
          <span class="pill">${meta.clientName || "Клиент не выбран"}</span>
          <span class="pill">${summary.positions} ${pluralize(summary.positions, "позиция", "позиции", "позиций")}</span>
          <span class="pill">${formatMoney(summary.sale)}</span>
          <span class="pill ${aiStatus === "ready" ? "pill-good" : aiStatus === "error" ? "pill-bad" : aiStatus === "running" || aiStatus === "queued" ? "pill-warn" : ""}">ИИ: ${escapeHtml(formatAiProcessingStatus(aiStatus))}</span>
          ${alerts.missingRrc.length ? `<span class="pill pill-warn">без RRC: ${alerts.missingRrc.length}</span>` : ""}
          ${alerts.missingSale.length ? `<span class="pill pill-bad">без цены продажи: ${alerts.missingSale.length}</span>` : ""}
          ${alerts.negativeMargin.length ? `<span class="pill pill-bad">отрицательная маржа: ${alerts.negativeMargin.length}</span>` : ""}
          ${
            state.runtime?.dataSource === "local-api"
              ? `<span class="pill">Черновик КП API: ${draftResource?.status || "idle"}</span>`
              : ""
          }
        </div>
        ${
          !hasRealWorkflowEndpoint
            ? `<div class="hint quote-items-hint">Webhook для обработки ИИ пока не настроен. Укажите реальный http(s) endpoint для отправки файла на разбор.</div>`
            : localQuoteFile
              ? `<div class="hint quote-items-hint">К этому КП привязан локальный файл запроса. Bahus может сразу отправить его на внешнюю ИИ-обработку.</div>`
              : ""
        }
        ${
          meta.aiProcessingNote
            ? `<div class="hint quote-items-hint">${escapeHtml(meta.aiProcessingNote)}</div>`
            : ""
        }
        <div class="hint quote-items-hint">Для позиций КП сейчас важнее быстрые действия по строке и подбор аналогов. Полный слой фильтрации здесь пока не нужен и только перегрузит рабочий сценарий.</div>
        <div class="table-wrap">
          <table>
            ${renderQuoteColGroup(state)}
            <thead>
              <tr>${renderQuoteTableHeader(state)}</tr>
            </thead>
            <tbody>${renderQuoteTable(state)}</tbody>
          </table>
        </div>
      </article>
      ${renderQuotePreviewModal(state)}
    </section>
  `;
}
