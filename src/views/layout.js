import { renderItems } from "./items.js";
import { renderOverview } from "./overview.js";
import { renderQuote } from "./quote.js";
import { renderSettings } from "./settings.js";
import { escapeHtml, formatValue } from "../utils/format.js";
import { VERSION_INFO } from "../version.js";

const navigation = [
  { id: "overview", label: "Импорт файлов", icon: "ИФ" },
  { id: "quote", label: "КП", icon: "КП" },
  { id: "items", label: "Позиции", icon: "ПО" },
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
    subtitle: "Тема, пользователи и базовые параметры рабочего контура.",
  },
};

function renderAuthGate(state) {
  const auth = state.auth || {};
  const draft = state.ui.loginDraft || {};
  const isLoading = auth.status === "authenticating" || auth.status === "loading";
  return `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="auth-title">Bahus</h1>
        
        <div class="auth-form">
          <div class="form-stack">
            <input 
              type="text" 
              class="input auth-input" 
              placeholder="Username" 
              value="${escapeHtml(draft.username || "")}" 
              data-input="setLoginDraftField" 
              data-field="username"
              ${isLoading ? "disabled" : ""}
            />
          </div>
          <div class="form-stack">
            <input 
              type="password" 
              class="input auth-input" 
              placeholder="Password" 
              value="${escapeHtml(draft.password || "")}" 
              data-input="setLoginDraftField" 
              data-field="password"
              ${isLoading ? "disabled" : ""}
            />
          </div>
        </div>

        <div class="auth-actions">
          <button class="primary-btn auth-submit-btn full-width" data-action="signInMaster" ${isLoading ? "disabled" : ""}>
            ${isLoading ? "Вход..." : "Войти"}
          </button>
          ${auth.error ? `<div class="hint hint-error auth-status">${escapeHtml(auth.error)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

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
        <div class="form-grid">
          <select class="input" data-change="setUploadDraftField" data-field="supplierId">
            ${suppliers
              .map(
                (supplier) =>
                  `<option value="${supplier.id}" ${draft.supplierId === supplier.id ? "selected" : ""}>${escapeHtml(supplier.name)}</option>`,
              )
              .join("")}
          </select>
          <select class="input" data-change="setUploadDraftField" data-field="documentType">
            <option value="price_list" ${draft.documentType === "price_list" ? "selected" : ""}>Общий прайс</option>
            <option value="promo" ${draft.documentType === "promo" ? "selected" : ""}>Акция / promo</option>
            <option value="request_offer" ${draft.documentType === "request_offer" ? "selected" : ""}>Под конкретный запрос</option>
          </select>
        </div>
        <input class="input" placeholder="Связанный запрос / номер КП (опционально)" value="${escapeHtml(draft.requestId || "")}" data-input="setUploadDraftField" data-field="requestId" />
        <div class="form-stack">
          <label class="field-label">Файлы поставщика</label>
          <label class="upload-dropzone">
            <input class="upload-dropzone-input" type="file" multiple data-change="setUploadDraftFiles" />
            <strong>Перетащите прайс сюда или выберите файлы</strong>
            <span>Подходят Excel, PDF и другие входящие файлы поставщика.</span>
          </label>
          ${
            draft.files?.length
              ? `
                  <div class="upload-file-list">
                    ${draft.files
                      .map(
                        (file) => `
                          <div class="upload-file-pill">
                            <strong>${escapeHtml(file.name)}</strong>
                            <span>${escapeHtml(formatValue(file.type))} · ${escapeHtml(formatValue(file.size))} bytes</span>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                `
              : '<div class="hint">Можно выбрать несколько файлов. При работе через API каждый файл создаётся как отдельный импорт и сразу отправляется в обработку.</div>'
          }
        </div>
        <div class="form-stack">
          <label class="field-label">Дополнительные вложения</label>
          <label class="upload-dropzone">
            <input class="upload-dropzone-input" type="file" multiple data-change="setUploadDraftAttachments" />
            <strong>Перетащите вложения сюда</strong>
            <span>Например: запрос клиента, сопроводительный PDF, таблицы или любые связанные файлы.</span>
          </label>
          ${
            draft.attachments?.length
              ? `
                  <div class="upload-file-list">
                    ${draft.attachments
                      .map(
                        (file) => `
                          <div class="upload-file-pill">
                            <strong>${escapeHtml(file.name)}</strong>
                            <span>${escapeHtml(formatValue(file.type))} · ${escapeHtml(formatValue(file.size))} bytes</span>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                `
              : '<div class="hint">Вложения сохраняются вместе с импортом как дополнительные материалы по запросу или поставке.</div>'
          }
          <textarea class="input textarea compact-textarea" placeholder="Комментарий к импорту или вложениям" data-input="setUploadDraftField" data-field="managerNote">${escapeHtml(draft.managerNote || "")}</textarea>
        </div>
        <div class="inline-card">
          <div class="inline-card-header">
            <strong>Как это работает для менеджера</strong>
          </div>
          <div class="hint">
            Сценарий такой: вы добавляете прайс и при необходимости прикладываете дополнительные файлы по запросу. Импорт создаётся как рабочая сущность с файлом-источником, затем сразу уходит в processing-контур.
          </div>
        </div>
        ${importsResource.error ? `<div class="hint hint-error">Не удалось создать импорт: ${escapeHtml(importsResource.error)}</div>` : ""}
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="createImportsFromUpload" ${isSubmitting ? "disabled" : ""}>
            ${isSubmitting ? "Создаём и отправляем..." : "Создать импорт"}
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
            <p>Пока это заглушка под будущую выгрузку. Дальше сюда можно подключить CSV, JSON и другие форматы.</p>
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
              Экспорт CSV
            </button>
            <button
              class="segmented-option ${draft.format === "json" ? "is-active" : ""}"
              type="button"
              data-action="setExportFormat"
              data-format="json"
            >
              Экспорт JSON
            </button>
          </div>
          <div class="inline-card">
            <div class="inline-card-header">
              <strong>Что будет дальше</strong>
            </div>
            <div class="hint">
              Для импорта в другие системы сюда можно будет подключить выгрузку CSV, JSON, а позже и интеграции с учётной системой или базой клиента.
            </div>
          </div>
        </div>
        <div class="toolbar-actions justify-end">
          <button class="ghost-btn" data-action="closeModal">Отмена</button>
          <button class="primary-btn" data-action="closeModal">Понятно</button>
        </div>
      </div>
    </div>
  `;
}

export function renderLayout(state) {
  if (state.settings?.auth_enabled && !state.auth?.currentUser) {
    return renderAuthGate(state);
  }

  const meta = pageMeta[state.ui.activeView];
  const isSidebarCollapsed = Boolean(state.ui.sidebarCollapsed);
  const runtime = state.runtime || {
    dataSource: "unknown",
    dataSourceLabel: "unknown",
    bootstrapMode: "unknown",
    bootstrapError: null,
  };
  const showRuntimeMeta = !["overview", "quote"].includes(state.ui.activeView);
  return `
    <div class="shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}">
      <aside class="sidebar">
        <div class="brand-block">
          <div class="brand-identity">
            <div class="brand-mark"></div>
            <div class="brand-copy">
              <div class="brand-title">Bahus Assistant</div>
              <div class="brand-subtitle">local workspace</div>
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
            <div class="eyebrow">Bahus Assistant / Workspace <span class="pill pill-accent" style="margin-left: 8px; font-variant-numeric: tabular-nums;" title="Обновлено: ${escapeHtml(VERSION_INFO.date)}">v${escapeHtml(VERSION_INFO.version)} (${escapeHtml(VERSION_INFO.commit)})</span></div>
            <h1>${meta.title}</h1>
            ${meta.subtitle ? `<p>${meta.subtitle}</p>` : ""}
            ${
              showRuntimeMeta
                ? `
                    <div class="topbar-meta topbar-meta-subtle">
                      <span class="pill">${runtime.dataSourceLabel}</span>
                      <span class="pill">${runtime.bootstrapMode}</span>
                      ${runtime.bootstrapError ? `<span class="pill pill-warn">fallback after bootstrap error</span>` : ""}
                    </div>
                  `
                : ""
            }
          <div class="topbar-actions">
            <span class="pill">${escapeHtml(state.auth?.currentUser?.email || "")}</span>
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
    </div>
  `;
}
