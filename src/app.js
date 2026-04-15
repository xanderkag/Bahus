import { createActions } from "./actions/app-actions.js";

import { loadStateFromApi } from "./services/api.js";
import { createBackend } from "./services/backend.js";
import { getBootstrapConfig, getStoredSidebarCollapsed, getStoredTheme, persistDataSource } from "./services/config.js";
import { createFirebaseAuthService } from "./services/firebase-auth.js";
import { createFirebaseStorageService } from "./services/firebase-storage.js";
import { createStore } from "./state/store.js";
import { createAppEventHandlers } from "./utils/dom.js";
import { renderLayout } from "./views/layout.js";

const root = document.getElementById("app");
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

function renderBootMessage(title, message) {
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;">
      <div style="max-width:680px;width:100%;padding:24px;border:1px solid rgba(86,113,166,.24);border-radius:24px;background:rgba(12,21,39,.92);box-shadow:0 22px 50px rgba(2,8,23,.42);color:#ebf1ff;">
        <div style="font-size:12px;color:#92a4ca;margin-bottom:10px;">Bakhus Assistant bootstrap</div>
        <h1 style="margin:0 0 10px;font-size:28px;">${title}</h1>
        <p style="margin:0;color:#92a4ca;line-height:1.5;">${message}</p>
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
      <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0b1120; color: #ff6b6b; text-align: center; padding: 2rem;">
        <h1 style="margin-bottom: 1rem;">Ошибка запуска приложения</h1>
        <p style="color: #94a3b8; max-width: 600px; line-height: 1.5;">Не удалось подключиться к бэкенду Bakhus: <b>${error.message}</b></p>
        <p style="color: #94a3b8; max-width: 600px; margin-top: 1rem; font-size: 0.9em;">Убедитесь, что сервер доступен по адресу ${config.apiBaseUrl}</p>
      </div>
    `;
    throw error;
  }
}

async function main() {
  renderBootMessage("Загрузка workspace", "Подключаемся к Bakhus API...");
  const config = getBootstrapConfig();
  const initialState = await bootstrapState();
  initialState.ui = {
    ...initialState.ui,
    sidebarCollapsed: getStoredSidebarCollapsed(),
  };
  initialState.settings = {
    ...initialState.settings,
    theme: getStoredTheme(),
  };
  const store = createStore(initialState);
  const authService = initialState.settings?.auth_enabled ? createFirebaseAuthService() : null;
  const storageService = initialState.settings?.live_upload_enabled ? createFirebaseStorageService() : null;
  const backend = createBackend(initialState.runtime.apiBaseUrl || config.apiBaseUrl);
  const actions = createActions(store, backend, authService, storageService);
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

  function shouldPollImportStatus(state) {
    if (state.runtime?.dataSource !== "local-api") return false;
    if (state.ui.activeView !== "overview") return false;
    const importId = state.ui.selectedImportId;
    if (!importId) return false;
    const status = state.entities.importsById[importId]?.status;
    return ["uploaded", "queued", "pending"].includes(status);
  }

  function syncImportStatusPolling(state) {
    if (!shouldPollImportStatus(state)) {
      stopImportStatusPolling();
      return;
    }
    if (importStatusPollId) return;
    importStatusPollId = window.setInterval(async () => {
      if (pollingInFlight) return;
      pollingInFlight = true;
      try {
        await actions.refreshSelectedImportStatus();
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
      if (activeDocElement.dataset.field) {
        focusSelector = `[data-field="${activeDocElement.dataset.field}"]`;
      } else if (activeDocElement.id) {
        focusSelector = `#${activeDocElement.id}`;
      }
      try {
        selectionStart = activeDocElement.selectionStart;
        selectionEnd = activeDocElement.selectionEnd;
      } catch (e) {}
    }

    document.documentElement.dataset.theme = store.getState().settings?.theme || "dark";
    root.innerHTML = renderLayout(store.getState());

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
  if (authService) {
    actions.setAuthStatus({ status: "loading" });
    await authService.initialize((user) => {
      actions.handleAuthStateChange({ user });
    });
  }
  if (initialState.runtime?.dataSource === "local-api") {
    void actions.refreshRemoteData();
  }
  syncImportStatusPolling(store.getState());
}

main().catch((error) => {
  renderBootMessage("Ошибка запуска", `Не удалось инициализировать приложение: ${error.message}`);
});
