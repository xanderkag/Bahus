import { createActions } from "./actions/app-actions.js";

import { loadStateFromApi } from "./services/api.js";
import { createBackend } from "./services/backend.js";
import { getBootstrapConfig, getStoredSidebarCollapsed, getStoredTheme, persistDataSource } from "./services/config.js";
import { createStore } from "./state/store.js";
import { createAppEventHandlers } from "./utils/dom.js";
import { renderLayout } from "./views/layout.js";

const root = document.getElementById("app");
document.documentElement.dataset.theme = getStoredTheme();

const IMPORT_STATUS_POLL_MS = 3000;

function attachQuoteColumnResize(rootElement, store, actions) {
  rootElement.addEventListener("mousedown", (event) => {
    const handle = event.target.closest("[data-resize-column]");
    if (!handle) return;

    event.preventDefault();
    const { resizeColumn: columnKey, minWidth } = handle.dataset;
    const headerCell = handle.closest("th");
    const startX = event.clientX;
    const startWidth =
      store.getState().ui.quoteTableColumns?.[columnKey] ||
      headerCell?.getBoundingClientRect().width ||
      Number(minWidth) ||
      80;

    function onMouseMove(moveEvent) {
      const width = startWidth + (moveEvent.clientX - startX);
      actions.setQuoteColumnWidth({ columnKey }, Math.max(Number(minWidth) || 64, width));
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function renderBootMessage(title, message, isLoading = false) {
  root.innerHTML = `
    <div class="boot-screen">
      <div class="boot-particles">
        ${Array.from({ length: 18 }, (_, i) => `<div class="boot-particle boot-particle-${i % 6}" style="--delay:${(i * 0.37).toFixed(2)}s;--x:${(i * 5.5 + 3).toFixed(0)}%"></div>`).join('')}
      </div>

      <div class="boot-center">
        <!-- Logo & Branding -->
        <div class="boot-logo-block">
          <div class="boot-logo-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <!-- Wine bottle body -->
              <rect x="18" y="18" width="12" height="22" rx="3" fill="url(#boot-bottle-grad)"/>
              <!-- Bottle neck -->
              <rect x="20" y="10" width="8" height="10" rx="2" fill="url(#boot-bottle-grad)"/>
              <!-- Cork -->
              <rect x="21" y="7" width="6" height="4" rx="1.5" fill="#c8a96e"/>
              <!-- Wine level -->
              <rect x="18" y="26" width="12" height="14" rx="3" fill="url(#boot-wine-grad)" opacity="0.8"/>
              <!-- Label -->
              <rect x="19" y="21" width="10" height="8" rx="1" fill="rgba(255,255,255,0.15)"/>
              <defs>
                <linearGradient id="boot-bottle-grad" x1="18" y1="7" x2="30" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#4a7fc1"/>
                  <stop offset="100%" stop-color="#1e3d6e"/>
                </linearGradient>
                <linearGradient id="boot-wine-grad" x1="18" y1="26" x2="30" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#9b2335"/>
                  <stop offset="100%" stop-color="#6b0f1a"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="boot-brand-text">
            <span class="boot-brand-name">Bahus</span>
            <span class="boot-brand-sub">Assistant</span>
          </div>
        </div>

        <!-- Wine convoy animation -->
        <div class="boot-convoy">
          <div class="boot-road">
            <div class="boot-road-line"></div>
          </div>
          <!-- Truck -->
          <div class="boot-truck">
            <div class="boot-truck-body">
              <div class="boot-truck-cab">
                <div class="boot-truck-window"></div>
              </div>
              <div class="boot-truck-cargo">
                <div class="boot-cargo-label">🍷</div>
              </div>
            </div>
            <div class="boot-truck-wheels">
              <div class="boot-wheel"></div>
              <div class="boot-wheel"></div>
            </div>
          </div>
          <!-- Floating bottles -->
          <div class="boot-bottle-float boot-bottle-float-1">🍾</div>
          <div class="boot-bottle-float boot-bottle-float-2">🍷</div>
          <div class="boot-bottle-float boot-bottle-float-3">🍾</div>
          <!-- Destination box -->
          <div class="boot-destination">
            <div class="boot-dest-icon">🏬</div>
            <div class="boot-dest-boxes">
              <div class="boot-box boot-box-1">📦</div>
              <div class="boot-box boot-box-2">📦</div>
            </div>
          </div>
        </div>

        <!-- Status card -->
        <div class="boot-status-card">
          <div class="boot-status-header">
            ${isLoading ? '<div class="boot-pulse-ring"><div class="boot-pulse-dot"></div></div>' : '<span style="font-size:20px">✓</span>'}
            <span class="boot-status-title">${title}</span>
          </div>
          <p class="boot-status-msg">${message}</p>
          ${isLoading ? `
            <div class="boot-progress-track">
              <div class="boot-progress-fill"></div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function bootstrapState() {
  const config = getBootstrapConfig();

  try {
    const apiState = await loadStateFromApi(config.apiBaseUrl);
    apiState.runtime.apiBaseUrl = config.apiBaseUrl;
    persistDataSource("local-api");
    return apiState;
  } catch (error) {
    document.body.innerHTML = `
      <div style="font-family: var(--font-sans); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0b1120; color: #ff6b6b; text-align: center; padding: 2rem;">
        <h1 style="margin-bottom: 1rem;">Ошибка запуска приложения</h1>
        <p style="color: #94a3b8; max-width: 600px; line-height: 1.5;">Не удалось подключиться к бэкенду Bahus: <b>${error.message}</b></p>
        <p style="color: #94a3b8; max-width: 600px; margin-top: 1rem; font-size: var(--text-sm);">Убедитесь, что сервер доступен по адресу ${config.apiBaseUrl}</p>
      </div>
    `;
    throw error;
  }
}

async function main() {
  renderBootMessage("Инициализация", "Подключение к серверам, загрузка зависимостей...", true);
  const config = getBootstrapConfig();
  const initialState = await bootstrapState();
  initialState.ui = {
    ...initialState.ui,
    sidebarCollapsed: getStoredSidebarCollapsed(),
  };
  try {
    const storedSettings = JSON.parse(localStorage.getItem("bahus_settings") || "{}");
    
    const mergeTableColumns = (defaultCols, storedCols) => {
      if (!storedCols || !Array.isArray(storedCols)) return defaultCols;
      const storedMap = new Map(storedCols.map(c => [c.id, c]));
      const merged = [];
      storedCols.forEach(sc => {
        const dc = defaultCols.find(d => d.id === sc.id);
        if (dc) merged.push({ ...dc, visible: 'visible' in sc ? sc.visible : dc.visible });
      });
      defaultCols.forEach(dc => {
        if (!storedMap.has(dc.id)) merged.push(dc);
      });
      return merged;
    };

    if (storedSettings.itemsTableColumns) {
      initialState.ui.itemsTableColumns = mergeTableColumns(initialState.ui.itemsTableColumns, storedSettings.itemsTableColumns);
    }
    if (storedSettings.overviewTableColumns) {
      initialState.ui.overviewTableColumns = mergeTableColumns(initialState.ui.overviewTableColumns, storedSettings.overviewTableColumns);
    }
    initialState.settings = {
      ...initialState.settings,
      ...storedSettings,
      theme: getStoredTheme(),
    };
  } catch (e) {
    initialState.settings = {
      ...initialState.settings,
      theme: getStoredTheme(),
    };
  }
  const store = createStore(initialState);
  const backend = createBackend(initialState.runtime.apiBaseUrl || config.apiBaseUrl);
  const actions = createActions(store, backend);
  store.actions = actions;
  const handlers = createAppEventHandlers(actions);
  let importStatusPollId = null;
  let pollingInFlight = false;

  function stopImportStatusPolling() {
    if (importStatusPollId) {
      window.clearInterval(importStatusPollId);
      importStatusPollId = null;
    }
  }

  function getProcessingImportIds(state) {
    const processingStatuses = new Set(["queued", "pending", "processing"]);
    return (state.entities.importOrder || []).filter(
      (id) => processingStatuses.has(state.entities.importsById[id]?.status)
    );
  }

  function shouldPollImports(state) {
    if (state.runtime?.dataSource !== "local-api") return false;
    // Don't poll while file picker is open (prevents DOM destruction)
    if (state.ui.modal === "upload-files") return false;
    // Don't poll while an upload is in progress
    if (state.runtime?.resources?.imports?.status === "saving") return false;
    return getProcessingImportIds(state).length > 0;
  }

  function syncImportStatusPolling(state) {
    if (!shouldPollImports(state)) {
      stopImportStatusPolling();
      return;
    }
    if (importStatusPollId) return;
    importStatusPollId = window.setInterval(async () => {
      if (pollingInFlight) return;
      pollingInFlight = true;
      try {
        const processingIds = getProcessingImportIds(store.getState());
        if (!processingIds.length) {
          stopImportStatusPolling();
          return;
        }
        await Promise.all(processingIds.map((id) => actions.refreshSelectedImportStatus(id)));
      } finally {
        pollingInFlight = false;
      }
    }, IMPORT_STATUS_POLL_MS);
  }

  function render() {
    // Save focus context
    const activeDocElement = document.activeElement;
    let focusSelector = null;
    let selectionStart = null;
    let selectionEnd = null;

    if (activeDocElement && (activeDocElement.tagName === "INPUT" || activeDocElement.tagName === "TEXTAREA")) {
      if (activeDocElement.id) {
        focusSelector = `#${activeDocElement.id}`;
      } else {
        const parts = [];
        if (activeDocElement.dataset.input) parts.push(`[data-input="${activeDocElement.dataset.input}"]`);
        if (activeDocElement.dataset.field) parts.push(`[data-field="${activeDocElement.dataset.field}"]`);
        if (activeDocElement.dataset.productId) parts.push(`[data-product-id="${activeDocElement.dataset.productId}"]`);
        if (activeDocElement.dataset.itemId) parts.push(`[data-item-id="${activeDocElement.dataset.itemId}"]`);
        if (parts.length > 0) focusSelector = parts.join("");
      }
      try {
        selectionStart = activeDocElement.selectionStart;
        selectionEnd = activeDocElement.selectionEnd;
      } catch (e) {}
    }

    // Save scroll positions for all scrollable containers
    const scrollSelectors = [
      ".main",
      ".overview-imports-table",
      ".overview-table-wrap",
      ".table-wrap.compact-table",
      ".overview-products-panel .table-wrap",
      ".quote-items-panel .table-wrap",
    ];
    const savedScrolls = [];
    for (const sel of scrollSelectors) {
      const el = root.querySelector(sel);
      if (el && el.scrollTop > 0) {
        savedScrolls.push({ sel, top: el.scrollTop, left: el.scrollLeft });
      }
    }

    document.documentElement.dataset.theme = store.getState().settings?.theme || "dark";
    root.innerHTML = renderLayout(store.getState());

    // Restore scroll positions
    for (const { sel, top, left } of savedScrolls) {
      const el = root.querySelector(sel);
      if (el) {
        el.scrollTop = top;
        el.scrollLeft = left;
      }
    }

    // Restore focus context
    if (focusSelector) {
      const newActive = root.querySelector(focusSelector);
      if (newActive) {
        newActive.focus();
        try {
          if (selectionStart !== null && selectionEnd !== null) {
            newActive.setSelectionRange(selectionStart, selectionEnd);
          }
        } catch (e) {}
      }
    }
  }

  root.addEventListener("click", handlers.click);
  root.addEventListener("click", (event) => {
    if (!event.target.closest(".client-picker") && store.getState().ui.clientPickerOpen) {
      actions.closeClientPicker();
    }
  });
  root.addEventListener("input", handlers.input);
  root.addEventListener("change", handlers.change);
  attachQuoteColumnResize(root, store, actions);

  store.subscribe((state) => {
    render();
    syncImportStatusPolling(state);
  });
  render();

  if (initialState.runtime?.dataSource === "local-api") {
    void actions.refreshRemoteData();
  }
  syncImportStatusPolling(store.getState());
}

main().catch((error) => {
  renderBootMessage("Ошибка запуска", `Не удалось инициализировать приложение: ${error.message}`);
});
