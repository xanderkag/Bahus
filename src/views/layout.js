import { renderItems } from "./items.js";
import { renderOverview } from "./overview.js";
import { renderQuote } from "./quote.js";
import { renderSettings } from "./settings.js";
import { escapeHtml, formatDateTime, formatImportStatus, formatValue, getImportStatusClass } from "../utils/format.js";

const navigation = [
  { id: "overview", label: "Импорт файлов", icon: "⬆" },
  { id: "quote", label: "КП", icon: "◈" },
  { id: "items", label: "Позиции", icon: "☰" },
  { id: "settings", label: "Настройки", icon: "⚙" },
];

const pageMeta = {
  overview: {
    title: "Импорт файлов",
    subtitle: "",
  },
  quote: {
    title: "КП",
    subtitle: "Рабочий список коммерческих предложений и состав позиций.",
  },
  items: {
    title: "Позиции",
    subtitle: "Общая таблица позиций по всем импортам и поставщикам.",
  },
  settings: {
    title: "Настройки",
    subtitle: "Тема, пользователи и параметры системы.",
  },
};



function renderActiveView(state) {
  if (state.ui.activeView === "quote") return renderQuote(state);
  if (state.ui.activeView === "items") return renderItems(state);
  if (state.ui.activeView === "settings") return renderSettings(state);
  return renderOverview(state);
}

function renderNewQuoteModal(state) {
  if (state.ui.modal !== "new-quote") return "";
  const draft = state.ui.newQuoteDraft || {};
  const clients = (state.entities.clientOrder || []).map((id) => state.entities.clientsById[id]).filter(Boolean);
  const selectedClient = clients.find((client) => client.id === draft.clientId) || null;
  const isUploadingFiles = draft.uploadStatus === "uploading";
  const uploadProgress = Number.isFinite(draft.uploadProgress) ? draft.uploadProgress : 0;
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog quote-create-dialog">
        <div class="dialog-header">
          <div>
            <h3>Создать новое КП</h3>
            <p>Запрос клиента, основные параметры и документы для будущего подбора.</p>
          </div>
          <button class="ghost-btn" data-action="closeModal">Закрыть</button>
        </div>
        <div class="quote-create-stack">
          <section class="quote-create-card quote-create-info">
            <div class="quote-create-card-header">
              <strong>Общая информация</strong>
            </div>
            <div class="quote-create-form-grid">
              <div class="form-stack">
                <label class="field-label">Клиент</label>
                <select class="input" data-change="setNewQuoteDraftField" data-field="clientId">
                  <option value="">Выберите клиента</option>
                  ${clients
                    .map(
                      (client) =>
                        `<option value="${client.id}" ${draft.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <div class="form-stack">
                <label class="field-label">Тема / повод запроса</label>
                <input
                  class="input"
                  placeholder="Например: летняя веранда, праздничное меню, экспресс-запрос по бару"
                  value="${escapeHtml(draft.title || "")}"
                  data-input="setNewQuoteDraftField"
                  data-field="title"
                />
              </div>
            </div>
            ${
              selectedClient
                ? `
                    <div class="quote-client-meta">
                      <span class="pill">${escapeHtml(selectedClient.name)}</span>
                      <span class="pill">ИНН ${escapeHtml(selectedClient.inn || "—")}</span>
                      <span class="pill">${escapeHtml(selectedClient.city || "—")}</span>
                    </div>
                  `
                : ""
            }
          </section>

          <section class="quote-create-card">
            <div class="quote-create-card-header">
              <strong>Контекст для ИИ</strong>
            </div>
            <div class="form-stack">
              <textarea
                class="input textarea quote-request-textarea"
                placeholder="Например: поставщик такой-то, нужен подбор под праздник, фокус на игристом и крепком, бюджет такой-то, исключить отдельные категории."
                data-input="setNewQuoteDraftField"
                data-field="note"
              >${escapeHtml(draft.note || "")}</textarea>
            </div>
          </section>

          <section class="quote-create-card quote-create-files">
            <div class="quote-create-card-header">
              <strong>Основной файл запроса</strong>
              <span>${isUploadingFiles ? "Загрузка..." : draft.requestFiles?.length ? "Загружен" : "Не выбран"}</span>
            </div>
            <label class="upload-dropzone quote-upload-dropzone">
              <input id="new-quote-request-file" class="upload-dropzone-input-hidden" type="file" data-change="setNewQuoteRequestFiles" ${isUploadingFiles ? "disabled" : ""} />
              <span class="quote-upload-icon">+</span>
              <strong>${isUploadingFiles ? "Загружаем файлы клиента" : "Перетащите файлы сюда"}</strong>
              <span>${isUploadingFiles ? "Подождите, файл обрабатывается." : "Один файл: PDF, Excel, HTML, скриншот или другой входящий документ клиента."}</span>
            </label>
            ${
              draft.uploadStatus !== "idle"
                ? `
                    <div class="upload-progress-card">
                      <div class="upload-progress-header">
                        <strong>${escapeHtml(draft.uploadStage || "Подготовка загрузки")}</strong>
                        <span>${uploadProgress}%</span>
                      </div>
                      <div class="upload-progress-bar">
                        <span style="width: ${Math.max(4, Math.min(uploadProgress, 100))}%"></span>
                      </div>
                      ${
                        draft.uploadLog?.length
                          ? `
                              <div class="upload-log-list">
                                ${draft.uploadLog
                                  .map(
                                    (entry) => `
                                      <div class="upload-log-entry upload-log-entry-${escapeHtml(entry.level || "info")}">${escapeHtml(entry.message)}</div>
                                    `,
                                  )
                                  .join("")}
                              </div>
                            `
                          : ""
                      }
                    </div>
                  `
                : ""
            }
            ${draft.uploadError ? `<div class="hint hint-warning">${escapeHtml(draft.uploadError)}</div>` : ""}
            ${
              draft.requestFiles?.length
                ? `
                    <div class="upload-file-list quote-upload-grid">
                      ${draft.requestFiles
                        .map(
                          (file) => `
                            <div class="upload-file-pill quote-upload-pill quote-upload-pill-main">
                              <strong>${escapeHtml(file.name)}</strong>
                              <span>${escapeHtml(formatValue(file.type))} · ${escapeHtml(formatValue(file.size))} bytes · ${file.downloadUrl ? "загружен в storage" : file.status === "local" ? "локальный черновик" : file.status || "ожидание"}</span>
                            </div>
                          `,
                        )
                        .join("")}
                    </div>
                  `
                : ""
            }
          </section>
        </div>
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="createNewQuote" ${draft.isCreating ? "disabled" : ""}>
            ${draft.isCreating ? "Создание..." : "Создать КП"}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderUploadFilesModal(state) {
  if (state.ui.modal !== "upload-files") return "";
  const draft = state.ui.uploadDraft || {};
  const suppliers = Object.values(state.entities.suppliersById || {});
  const importsResource = state.runtime?.resources?.imports || { status: "idle", error: null };
  const isSubmitting = importsResource.status === "saving";
  const isDone      = importsResource.status === "done";
  const uploadProgress = Number.isFinite(importsResource.currentFilePercent) ? importsResource.currentFilePercent : 0;
  const total = importsResource.total || 1;
  const completed = importsResource.completed || 0;

  // Find the most recently created/dispatched import for live status
  const lastImportId = importsResource.lastCreatedImportId || importsResource.lastDispatchedId;
  const liveImport = lastImportId ? state.entities.importsById[lastImportId] : null;
  const liveStatus = liveImport?.status;
  const liveRowCount = liveImport?.row_count ?? 0;
  const isProcessingOnServer = ["queued", "pending", "processing"].includes(liveStatus);
  const isServerDone = ["parsed", "partial"].includes(liveStatus);
  const isServerError = liveStatus === "failed" || liveStatus === "error";

  // ── PHASE 3: AI Processing (upload done, server working) ─────────────────
  if (isDone && liveImport && (isProcessingOnServer || isServerDone || isServerError)) {
    const statusLabel = isServerDone
      ? `Готово — ${liveRowCount} позиций извлечено`
      : isServerError
        ? "Ошибка обработки"
        : "ИИ анализирует документ...";
    const statusIcon = isServerDone ? "✓" : isServerError ? "✕" : null;
    const statusColor = isServerDone ? "var(--good)" : isServerError ? "var(--bad)" : "var(--accent)";

    return `
      <div class="modal-overlay">
        <div class="app-dialog compact-dialog">
          <div class="dialog-header">
            <div>
              <h3>Загрузка файлов поставщиков</h3>
              <p>Файл принят и передан в обработку.</p>
            </div>
          </div>

          <div class="upload-phase-card" style="border-color:${statusColor}20;">
            <div class="upload-phase-steps">
              <div class="upload-phase-step is-done">
                <span class="upload-phase-dot" style="background:var(--good);">✓</span>
                <span>Загружено на сервер</span>
              </div>
              <div class="upload-phase-step ${isProcessingOnServer ? 'is-active' : isServerDone ? 'is-done' : isServerError ? 'is-error' : ''}">
                <span class="upload-phase-dot" style="background:${statusColor};">
                  ${statusIcon ? statusIcon : '<span class="upload-phase-spinner"></span>'}
                </span>
                <span>${statusLabel}</span>
              </div>
            </div>

            ${isServerDone ? `
              <div class="upload-result-badge" style="background:color-mix(in srgb,var(--good) 10%,transparent);border-color:var(--good);">
                <span style="font-size:28px;font-weight:800;color:var(--good);">${liveRowCount}</span>
                <span style="color:var(--muted);font-size:var(--text-xs);">позиций извлечено</span>
              </div>
            ` : isProcessingOnServer ? `
              <div class="upload-processing-hint">
                <div class="boot-loader" style="width:16px;height:16px;border-width:2px;flex-shrink:0;"></div>
                <span>Данные появятся в таблице автоматически — можно закрыть окно</span>
              </div>
            ` : isServerError ? `
              <div class="upload-processing-hint" style="color:var(--bad);">
                <span>⚠ Ошибка обработки. Попробуйте переотправить файл.</span>
              </div>
            ` : ""}
          </div>

          <div class="toolbar-actions justify-end" style="margin-top:16px;">
            <button class="ghost-btn" data-action="acceptImportUpload">Загрузить ещё</button>
            <button class="primary-btn" data-action="acceptImportUpload">Готово — закрыть</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── PHASE 2: Uploading (progress bars) ───────────────────────────────────
  if (isDone || isSubmitting) {
    const files = draft.files || [];
    return `
      <div class="modal-overlay">
        <div class="app-dialog compact-dialog">
          <div class="dialog-header">
            <div>
              <h3>Загрузка файлов поставщиков</h3>
              <p>${isDone ? "Файлы переданы на сервер." : `Файл ${completed + 1} из ${total} — отправка...`}</p>
            </div>
          </div>

          <div class="upload-phase-card">
            ${files.map((file, idx) => {
              const fileIsDone = isDone || idx < completed;
              const fileIsActive = !isDone && idx === completed;
              const pct = fileIsActive ? uploadProgress : fileIsDone ? 100 : 0;
              return `
                <div class="upload-file-status-row">
                  <div class="upload-file-status-icon ${fileIsDone ? 'is-done' : fileIsActive ? 'is-active' : ''}">
                    ${fileIsDone
                      ? '<span style="color:var(--good);font-weight:700;">✓</span>'
                      : fileIsActive
                        ? '<div class="boot-loader" style="width:12px;height:12px;border-width:2px;"></div>'
                        : '<span style="color:var(--muted);">○</span>'
                    }
                  </div>
                  <div class="upload-file-status-info">
                    <div class="upload-file-status-name">
                      <span>${escapeHtml(file.name)}</span>
                      <span class="upload-file-status-size">${Math.round((file.size || 0) / 1024)} КБ</span>
                      ${fileIsDone ? '<span class="upload-file-status-label" style="color:var(--good);">Загружено</span>' : fileIsActive ? `<span class="upload-file-status-label" style="color:var(--accent);">${pct}%</span>` : ""}
                    </div>
                    ${fileIsActive ? `
                      <div class="upload-progress-bar upload-progress-bar-active" style="margin-top:4px;">
                        <span style="width:${Math.max(4, pct)}%;"></span>
                      </div>
                    ` : fileIsDone ? `
                      <div class="upload-progress-bar" style="margin-top:4px;">
                        <span style="width:100%;background:var(--good);"></span>
                      </div>
                    ` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  // ── PHASE 1: Form (idle) ─────────────────────────────────────────────────
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog">
        <div class="dialog-header">
          <div>
            <h3>Загрузка файлов поставщиков</h3>
            <p>Подготовьте новый импорт для проверки.</p>
          </div>
          <button class="ghost-btn" data-action="closeModal">Закрыть</button>
        </div>
        <div class="panel" style="display:flex; flex-direction:column; gap:16px; margin-bottom:16px;">
          <h4 style="margin:0; font-size:var(--text-sm); color:var(--text);">Параметры импорта</h4>
          <div class="form-grid">
            <div class="form-stack">
              <label class="field-label">Поставщик</label>
              <select class="input" data-change="setUploadDraftField" data-field="supplierId">
                ${suppliers
                  .map(
                    (supplier) =>
                      `<option value="${supplier.id}" ${draft.supplierId === supplier.id ? "selected" : ""}>${escapeHtml(supplier.name)}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div class="form-stack">
              <label class="field-label">Категория прайса</label>
              <select class="input" data-change="setUploadDraftField" data-field="documentType">
                <option value="price_list" ${draft.documentType === "price_list" ? "selected" : ""}>Общий прайс</option>
                <option value="promo" ${draft.documentType === "promo" ? "selected" : ""}>Акция / promo</option>
                <option value="request_offer" ${draft.documentType === "request_offer" ? "selected" : ""}>Под конкретный запрос</option>
              </select>
            </div>
          </div>
          <div class="form-stack">
            <label class="field-label">Связанный запрос / номер КП (опционально)</label>
            <input class="input" placeholder="Например: Запрос на комплектующие от Лукойл..." value="${escapeHtml(draft.requestId || "")}" data-input="setUploadDraftField" data-field="requestId" />
          </div>
        </div>

        <div class="panel" style="display:flex; flex-direction:column; gap:16px; margin-bottom:16px;">
          <h4 style="margin:0; font-size:var(--text-sm); color:var(--text);">Медиа и файлы</h4>
          <div class="form-stack">
            <label class="upload-dropzone">
              <input class="upload-dropzone-input-hidden" type="file" multiple data-change="setUploadDraftFiles" />
              <strong>Перетащите прайсы и любые вложения сюда</strong>
              <span>Подходят Excel, PDF, картинки и другие входящие от поставщика.</span>
            </label>
            ${draft.files?.length ? `
              <div class="upload-file-list">
                ${draft.files.map((file, idx) => `
                  <div class="upload-file-pill" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <strong>${escapeHtml(file.name)}</strong>
                      <span>${escapeHtml(String(file.type || "file"))} · ${Math.round((file.size || 0) / 1024)} КБ</span>
                    </div>
                    <button class="ghost-btn icon-action-btn table-danger-btn" style="padding:4px;min-width:unset;height:unset;" data-action="removeUploadDraftFile" data-index="${idx}" title="Удалить файл">🗑️</button>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </div>
        </div>

        <div class="form-stack" style="margin-bottom:16px;">
          <label class="field-label">Комментарий к импорту</label>
          <textarea class="input textarea compact-textarea" placeholder="Укажите важные детали или комментарии для себя..." data-input="setUploadDraftField" data-field="managerNote">${escapeHtml(draft.managerNote || "")}</textarea>
        </div>

        ${importsResource.error ? `<div class="hint hint-error">Не удалось создать импорт: ${escapeHtml(importsResource.error)}</div>` : ""}
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="createImportsFromUpload" ${!draft.files?.length ? "disabled" : ""} style="min-width:160px;justify-content:center;">
            Создать импорт
          </button>
        </div>
      </div>
    </div>
  `;
}


function renderExportModal(state) {
  if (state.ui.modal !== "export") return "";
  const draft = state.ui.exportDraft || { format: "csv" };
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog">
        <div class="dialog-header">
          <div>
            <h3>Экспорт</h3>
            <p>Выберите формат для выгрузки данных.</p>
          </div>
          <button class="ghost-btn" data-action="closeModal">Закрыть</button>
        </div>
        <div class="form-stack">
          <label class="field-label">Формат экспорта</label>
          <div class="segmented-control" role="tablist" aria-label="Формат экспорта">
            <button
              class="segmented-option ${draft.format === "csv" ? "is-active" : ""}"
              type="button"
              data-action="setExportFormat"
              data-format="csv"
            >
              CSV
            </button>
            <button
              class="segmented-option ${draft.format === "json" ? "is-active" : ""}"
              type="button"
              data-action="setExportFormat"
              data-format="json"
            >
              JSON
            </button>
          </div>
        </div>
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="closeModal">Скачать</button>
        </div>
      </div>
    </div>
  `;
}

export function renderConfirmDeleteImportModal(state) {
  if (state.ui.modal !== "confirm-delete-import") return "";
  const importRecord = state.entities.importsById[state.ui.selectedImportId];
  if (!importRecord) return "";
  const fileName = importRecord.meta?.source_file || "Неизвестный файл";
  const isSaving = state.runtime?.resources?.imports?.status === "saving";

  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog">
        <div class="dialog-header">
          <div>
            <h3 style="color: var(--status-bad);">Удалить импорт?</h3>
            <p>Вы собираетесь удалить данные импорта.</p>
          </div>
          <button class="ghost-btn icon-btn" data-action="closeModal" aria-label="Закрыть">×</button>
        </div>
        <div class="dialog-body">
          <p style="margin-bottom: 12px; line-height: 1.5;">Это действие <strong>необратимо</strong>. Файл <b>${escapeHtml(fileName)}</b>, все его позиции и найденные ошибки будут удалены из базы данных.</p>
          <p style="color: var(--text-2); font-size: 13px;">Если позиции из этого импорта уже добавлены в рабочие коммерческие предложения, они также могут быть отвязаны.</p>
        </div>
        <div class="dialog-footer" style="justify-content: flex-end; gap: 12px;">
          <button class="ghost-btn" data-action="closeModal" ${isSaving ? "disabled" : ""}>Отмена</button>
          <button class="primary-btn" style="background: var(--status-bad); border-color: var(--status-bad);" data-action="deleteSelectedImport" ${isSaving ? "disabled" : ""}>
            ${isSaving ? "Удаление..." : "Удалить навсегда"}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderTableSettingsModal(state) {
  if (state.ui.modal?.type !== "tableSettings") return "";
  const tableType = state.ui.modal.tableType;
  const colsKey = tableType === "items" ? "itemsTableColumns" : "overviewTableColumns";
  const columns = state.ui[colsKey] || [];
  
  return `
    <style>
      .column-settings-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 8px;
        margin-top: 16px;
      }
      .column-setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 6px;
      }
      .column-setting-item .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        cursor: pointer;
        font-weight: 500;
        user-select: none;
      }
      .column-setting-actions {
        display: flex;
        gap: 4px;
      }
      .column-setting-actions button {
        padding: 4px;
        min-width: 24px;
        height: 24px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog" style="max-width: 400px; display: flex; flex-direction: column;">
        <div class="dialog-header text-between" style="display: flex; align-items: center; justify-content: space-between;">
          <h3 style="margin: 0;">Настройка колонок</h3>
          <button class="ghost-btn icon-action-btn" data-action="closeModal" aria-label="Закрыть">×</button>
        </div>
        <div class="dialog-body" style="padding: 0 16px;">
          <p style="color: var(--text-secondary); margin-bottom: 8px;">Выберите, какие колонки показывать и настройте их порядок.</p>
          <div class="column-settings-list">
            ${columns.map((col, index) => `
              <div class="column-setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" data-change="toggleTableColumnVisibility" data-column-id="${col.id}" data-table-type="${tableType}" ${col.visible ? "checked" : ""}>
                  ${col.label || col.id}
                </label>
                <div class="column-setting-actions">
                  <button class="ghost-btn icon-btn" data-action="moveTableColumn" data-column-id="${col.id}" data-table-type="${tableType}" data-direction="up" ${index === 0 ? "disabled" : ""} title="Вверх">↑</button>
                  <button class="ghost-btn icon-btn" data-action="moveTableColumn" data-column-id="${col.id}" data-table-type="${tableType}" data-direction="down" ${index === columns.length - 1 ? "disabled" : ""} title="Вниз">↓</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="toolbar-actions justify-end" style="padding: 16px; margin-top: 8px; border-top: 1px solid var(--border);">
          <button class="primary-btn" data-action="closeModal">Готово</button>
        </div>
      </div>
    </div>
  `;
}

export function renderLayout(state) {
  const meta = pageMeta[state.ui.activeView];
  const isSidebarCollapsed = Boolean(state.ui.sidebarCollapsed);
  return `
    <div class="shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}">
      <aside class="sidebar">
        <div class="brand-block">
          <div class="brand-identity">
            <div class="brand-mark"></div>
            <div class="brand-copy">
              <div class="brand-title">Bahus</div>
            </div>
          </div>
          <button
            class="ghost-btn icon-btn sidebar-toggle"
            data-action="toggleSidebar"
            title="${isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}"
            aria-label="${isSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}"
          >
            <img class="sidebar-toggle-logo" src="src/assets/bahus-logo.jpg" alt="Логотип Бахус" />
          </button>
        </div>

        <nav class="nav">
          ${navigation
            .map(
              (item) => `
                <button
                  class="nav-btn ${state.ui.activeView === item.id ? "is-active" : ""}"
                  data-action="setView"
                  data-view="${item.id}"
                  title="${item.label}"
                  aria-label="${item.label}"
                >
                  <span class="nav-btn-icon">${item.icon}</span>
                  <span class="nav-btn-label">${item.label}</span>
                </button>
              `,
            )
            .join("")}
        </nav>

      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <h1>${meta.title}</h1>
            ${meta.subtitle ? `<p>${meta.subtitle}</p>` : ""}
          </div>
        </header>

        ${renderActiveView(state)}
        ${
          ["overview", "quote", "items"].includes(state.ui.activeView)
            ? `
                <div class="bottom-switch">
                  <span class="bottom-switch-label">Показать</span>
                  <button class="${state.ui.scope === "my" ? "primary-btn" : "ghost-btn"}" data-action="selectScope" data-scope="my">Мои</button>
                  <button class="${state.ui.scope === "all" ? "primary-btn" : "ghost-btn"}" data-action="selectScope" data-scope="all">Все</button>
                </div>
              `
            : ""
        }
      </main>
      ${renderNewQuoteModal(state)}
      ${renderUploadFilesModal(state)}
      ${renderExportModal(state)}
      ${renderConfirmDeleteImportModal(state)}
      ${renderTableSettingsModal(state)}
      ${renderConfirmMarkCheckedModal(state)}
      ${renderMarkCheckedSuccessModal(state)}
    </div>
  `;
}

function renderMarkCheckedSuccessModal(state) {
  if (state.ui.modal !== "markCheckedSuccess") return "";
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog" style="text-align: center; padding: 32px;">
        <div style="font-size: 48px; margin-bottom: 16px; color: var(--status-good);">✓</div>
        <h3 style="margin-bottom: 8px;">Успешно!</h3>
        <p style="color: var(--text-secondary);">Выбранные строки перенесены в общую базу.</p>
      </div>
    </div>
  `;
}

function renderConfirmMarkCheckedModal(state) {
  if (state.ui.modal !== "confirmMarkChecked") return "";
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog">
        <div class="dialog-header">
          <h3>Подтверждение</h3>
        </div>
        <div class="dialog-body" style="padding-bottom: 24px; color: var(--text-secondary); line-height: 1.5;">
          Перенести проверенные строки в общий список позиций? После подтверждения эти строки будут отмечены как проверенные и попадут в общую базу проверенных позиций.
        </div>
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="markSelectedChecked">Перенести</button>
        </div>
      </div>
    </div>
  `;
}
