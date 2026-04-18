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
          <button class="primary-btn" data-action="createNewQuote">Создать КП</button>
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
  return `
    <div class="modal-overlay">
      <div class="app-dialog compact-dialog">
        <div class="dialog-header">
          <div>
            <h3>Загрузка файлов поставщиков</h3>
            <p>Подготовьте новый импорт для проверки. Можно приложить прайс и дополнительные вложения по запросу или поставке.</p>
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
            ${
              draft.files?.length
                ? `
                    <div class="upload-file-list">
                      ${draft.files
                        .map(
                          (file, idx) => `
                            <div class="upload-file-pill" style="display: flex; justify-content: space-between; align-items: center;">
                              <div>
                                <strong>${escapeHtml(file.name)}</strong>
                                <span>${escapeHtml(formatValue(file.type))} · ${escapeHtml(formatValue(file.size))} bytes</span>
                              </div>
                              <button class="ghost-btn icon-action-btn table-danger-btn" style="padding: 4px; min-width: unset; height: unset;" data-action="removeUploadDraftFile" data-index="${idx}" title="Удалить файл">🗑️</button>
                            </div>
                          `,
                        )
                        .join("")}
                    </div>
                  `
                : ''
            }
          </div>
        </div>

        <div class="form-stack" style="margin-bottom:16px;">
          <label class="field-label">Комментарий к импорту</label>
          <textarea class="input textarea compact-textarea" placeholder="Укажите важные детали или комментарии для себя..." data-input="setUploadDraftField" data-field="managerNote">${escapeHtml(draft.managerNote || "")}</textarea>
        </div>


        ${importsResource.error ? `<div class="hint hint-error">Не удалось создать импорт: ${escapeHtml(importsResource.error)}</div>` : ""}
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="createImportsFromUpload" ${isSubmitting ? "disabled" : ""} style="display:flex; align-items:center; gap:8px;">
            ${isSubmitting 
              ? `<div class="boot-loader" style="width:14px;height:14px;border-width:2px; flex-shrink: 0;"></div>
                 ${importsResource.total > 1 ? `Файл ${importsResource.completed + 1} из ${importsResource.total}: ${importsResource.currentFilePercent || 0}%...` : `Загрузка: ${importsResource.currentFilePercent || 0}%...`}`
              : "Создать импорт"
            }
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
    </div>
  `;
}
