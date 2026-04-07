import {
  findAlternatives,
  getCurrentImport,
  getCurrentImportProducts,
  getQuoteMeta,
  getSelectedProducts,
  getVisibleProducts,
} from "../state/selectors.js";
import { persistSidebarCollapsed, persistTheme } from "../services/config.js";
import { mapApiProductToEntity } from "../services/review-mappers.js";
import { toInputDate } from "../utils/format.js";

function asNumber(value, fallback = 0) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unique(items) {
  return [...new Set(items)];
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveQuoteStatus(meta, items) {
  if (!items.length) return "draft";
  if (!meta.clientName) return "review";
  return "ready";
}

function isImportProcessing(status) {
  return ["uploaded", "queued", "pending"].includes(status);
}

function mapApiImportToEntity(item) {
  return {
    id: item.id,
    supplier_id: item.supplier?.id || item.supplier_id,
    created_by: item.created_by,
    owner: item.owner,
    source: item.source,
    status: item.status || "uploaded",
    meta: item.meta || {},
    product_ids: Array.isArray(item.product_ids) ? item.product_ids : [],
    issue_ids: Array.isArray(item.issue_ids) ? item.issue_ids : [],
  };
}

export function createActions(store, backend = null) {
  function update(updater) {
    store.setState(updater);
  }

  function setResourceState(resource, patch) {
    update((state) => ({
      ...state,
      runtime: {
        ...state.runtime,
        resources: {
          ...state.runtime.resources,
          [resource]: {
            ...state.runtime.resources[resource],
            ...patch,
          },
        },
      },
    }));
  }

  async function loadImportsResource() {
    if (!backend) return;
    setResourceState("imports", { status: "loading", error: null });
    try {
      const payload = await backend.loadImports();
      const items = payload.items || [];
      update((state) => {
        const importsById = { ...state.entities.importsById };
        const suppliersById = { ...state.entities.suppliersById };
        const importOrder = [];

        items.forEach((item) => {
          const mapped = mapApiImportToEntity(item);
          importsById[mapped.id] = {
            ...(importsById[mapped.id] || {}),
            ...mapped,
          };
          if (item.supplier?.id) {
            suppliersById[item.supplier.id] = {
              ...(suppliersById[item.supplier.id] || {}),
              ...item.supplier,
            };
          }
          importOrder.push(mapped.id);
        });

        const selectedImportId = importsById[state.ui.selectedImportId]
          ? state.ui.selectedImportId
          : importOrder[0] || state.ui.selectedImportId;

        return {
          ...state,
          entities: {
            ...state.entities,
            importsById,
            suppliersById,
            importOrder,
          },
          ui: {
            ...state.ui,
            selectedImportId,
          },
          runtime: {
            ...state.runtime,
            resources: {
              ...state.runtime.resources,
              imports: {
                ...state.runtime.resources.imports,
                status: "ready",
                items,
                error: null,
              },
            },
          },
        };
      });
    } catch (error) {
      setResourceState("imports", { status: "error", error: error.message });
    }
  }

  async function loadImportStatusResource(importId) {
    if (!backend || !importId) return null;
    try {
      const payload = await backend.loadImportStatus(importId);
      const status = payload.item || null;
      if (!status) return null;
      update((state) => {
        const currentImport = state.entities.importsById[importId];
        if (!currentImport) return state;
        return {
          ...state,
          entities: {
            ...state.entities,
            importsById: {
              ...state.entities.importsById,
              [importId]: {
                ...currentImport,
                status: status.status || currentImport.status,
                meta: {
                  ...currentImport.meta,
                  processing_started_at: status.processing_started_at || null,
                  processing_finished_at: status.processing_finished_at || null,
                  last_webhook_at: status.last_webhook_at || null,
                  attachments: status.files?.filter((file) => file.file_kind !== "price") || currentImport.meta.attachments || [],
                },
              },
            },
          },
        };
      });
      return status;
    } catch {
      return null;
    }
  }

  async function loadProductsResource(importId) {
    if (!backend || !importId) return;
    setResourceState("products", { status: "loading", error: null });
    try {
      const payload = await backend.loadProducts(importId);
      const items = (payload.items || []).map(mapApiProductToEntity);
      update((state) => {
        const nextProducts = { ...state.entities.productsById };
        const nextImports = { ...state.entities.importsById };
        const productIds = [];

        items.forEach((product) => {
          nextProducts[product.id] = { ...(nextProducts[product.id] || {}), ...product };
          productIds.push(product.id);
        });

        if (nextImports[importId]) {
          nextImports[importId] = { ...nextImports[importId], product_ids: productIds };
        }

        return {
          ...state,
          entities: {
            ...state.entities,
            productsById: nextProducts,
            importsById: nextImports,
            productOrder: Array.from(new Set([...state.entities.productOrder, ...productIds])),
          },
          runtime: {
            ...state.runtime,
            resources: {
              ...state.runtime.resources,
              products: {
                ...state.runtime.resources.products,
                status: "ready",
                error: null,
                items,
              },
            },
          },
        };
      });
    } catch (error) {
      setResourceState("products", { status: "error", error: error.message });
    }
  }

  async function loadCatalogResource() {
    if (!backend) return;
    setResourceState("catalog", { status: "loading", error: null });
    try {
      const payload = await backend.loadCatalog();
      setResourceState("catalog", { status: "ready", items: payload.items || [], error: null });
    } catch (error) {
      setResourceState("catalog", { status: "error", error: error.message });
    }
  }

  async function loadJobsResource() {
    if (!backend) return;
    setResourceState("jobs", { status: "loading", error: null });
    try {
      const payload = await backend.loadJobs();
      setResourceState("jobs", { status: "ready", items: payload.items || [], error: null });
    } catch (error) {
      setResourceState("jobs", { status: "error", error: error.message });
    }
  }

  async function loadQuoteDraftResource() {
    if (!backend) return;
    setResourceState("quoteDraft", { status: "loading", error: null });
    try {
      const payload = await backend.loadQuoteDraft();
      update((state) => {
        const hydrated = hydrateQuoteFromDraft(state, payload);
        return {
          ...hydrated,
          runtime: {
            ...hydrated.runtime,
            resources: {
              ...hydrated.runtime.resources,
              quoteDraft: {
                ...hydrated.runtime.resources.quoteDraft,
                status: "ready",
                item: payload || null,
                error: null,
                lastSavedAt: payload?.saved_at || null,
              },
            },
          },
        };
      });
    } catch (error) {
      setResourceState("quoteDraft", { status: "error", error: error.message });
    }
  }

  function withQuoteItem(state, itemId, updater) {
    const current = state.quote.itemsById[itemId];
    if (!current) return state;
    return syncSelectedQuoteRecord({
      ...state,
      quote: {
        ...state.quote,
        itemsById: {
          ...state.quote.itemsById,
          [itemId]: updater(current),
        },
      },
    });
  }

  function createQuoteRecordFromState(state, override = {}) {
    const meta = getQuoteMeta(state);
    const items = state.quote.itemOrder
      .map((id) => state.quote.itemsById[id])
      .filter(Boolean)
      .map((item) => ({ ...item }));

    return {
      id: override.id || state.ui.selectedQuoteId || makeId("qt"),
      linkedImportId: override.linkedImportId || state.ui.selectedImportId || null,
      updatedAt: toInputDate(),
      status: override.status || deriveQuoteStatus(meta, items),
      meta,
      items,
    };
  }

  function syncSelectedQuoteRecord(state, override = {}) {
    const selectedQuoteId = override.quoteId || state.ui.selectedQuoteId;
    if (!selectedQuoteId) return state;
    const currentRecord = state.entities.quotesById?.[selectedQuoteId];
    if (!currentRecord) return state;
    const nextRecord = {
      ...currentRecord,
      ...createQuoteRecordFromState(state, {
        ...override,
        id: selectedQuoteId,
        linkedImportId: override.linkedImportId || currentRecord.linkedImportId || state.ui.selectedImportId || null,
      }),
    };
    return {
      ...state,
      entities: {
        ...state.entities,
        quotesById: {
          ...state.entities.quotesById,
          [selectedQuoteId]: nextRecord,
        },
      },
    };
  }

  function hydrateQuoteFromRecord(state, record) {
    if (!record) return state;
    const items = (record.items || []).map((item) => ({ ...item, alternative_open: false }));
    return {
      ...state,
      ui: {
        ...state.ui,
        selectedQuoteId: record.id,
        selectedImportId: record.linkedImportId || state.ui.selectedImportId,
        selectedRowIds: [],
        selectedRowDetailId: null,
      },
      quote: {
        itemOrder: items.map((item) => item.id),
        itemsById: Object.fromEntries(items.map((item) => [item.id, item])),
        meta: {
          clientId: record.meta?.clientId || "",
          clientName: record.meta?.clientName || "",
          requestTitle: record.meta?.requestTitle || "",
          requestFiles: record.meta?.requestFiles || [],
          quoteNumber: record.meta?.quoteNumber || "",
          quoteDate: record.meta?.quoteDate || toInputDate(),
          managerName: record.meta?.managerName || "Александр",
          note: record.meta?.note || "",
          mode: record.meta?.mode || "internal",
        },
      },
    };
  }

  function addProductsToQuote(state, products) {
    const nextItemsById = { ...state.quote.itemsById };
    const nextOrder = [...state.quote.itemOrder];

    products
      .filter(Boolean)
      .filter((product) => !product.excluded)
      .forEach((product) => {
        const itemId = product.id;
        if (nextItemsById[itemId]) return;
        nextItemsById[itemId] = {
          id: itemId,
          source_product_id: product.id,
          source_import_id: product.import_id,
          supplier_id: product.supplier_id,
          row_index: product.row_index,
          name: product.raw_name,
          normalized_name: product.normalized_name,
          category: product.category,
          country: product.country,
          volume_l: product.volume_l,
          purchase_price: product.purchase_price,
          rrc_min: product.rrc_min,
          sale_price:
            typeof product.rrc_min === "number"
              ? product.rrc_min
              : typeof product.purchase_price === "number"
                ? product.purchase_price
                : 0,
          qty: 1,
          alternative_open: false,
          selected_alternative_id: null,
        };
        nextOrder.push(itemId);
      });

    return syncSelectedQuoteRecord({
      ...state,
      quote: {
        ...state.quote,
        itemOrder: nextOrder,
        itemsById: nextItemsById,
        meta: {
          ...state.quote.meta,
          quoteDate: state.quote.meta.quoteDate || toInputDate(),
          quoteNumber: state.quote.meta.quoteNumber || `КП-${toInputDate().replaceAll("-", "")}`,
        },
      },
    });
  }

  function hydrateQuoteFromDraft(state, draft) {
    if (!draft || !Array.isArray(draft.items)) return state;

    const nextItemsById = {};
    const nextOrder = [];

    draft.items.forEach((item, index) => {
      const itemId = item.source_product_id || `draft_${index + 1}`;
      nextItemsById[itemId] = {
        id: itemId,
        source_product_id: item.source_product_id || null,
        source_import_id: item.source_import_id || null,
        supplier_id: item.supplier_id || null,
        row_index: item.row_index || index + 1,
        name: item.name || "Без названия",
        normalized_name: item.normalized_name || null,
        category: item.category || null,
        country: item.country || null,
        volume_l: item.volume_l || null,
        purchase_price: item.purchase_price ?? null,
        rrc_min: item.rrc_min ?? null,
        sale_price: item.sale_price ?? null,
        qty: item.qty ?? 1,
        alternative_open: false,
        selected_alternative_id: item.selected_alternative_id || null,
      };
      nextOrder.push(itemId);
    });

    return {
      ...state,
      quote: {
        itemOrder: nextOrder,
        itemsById: nextItemsById,
        meta: {
          ...state.quote.meta,
          clientId: draft.meta?.clientId || draft.meta?.client_id || state.quote.meta.clientId,
          clientName: draft.meta?.clientName || draft.meta?.client_name || state.quote.meta.clientName,
          requestTitle: draft.meta?.requestTitle || draft.meta?.request_title || state.quote.meta.requestTitle,
          requestFiles: draft.meta?.requestFiles || draft.meta?.request_files || state.quote.meta.requestFiles,
          quoteNumber: draft.meta?.quoteNumber || draft.meta?.quote_number || state.quote.meta.quoteNumber,
          quoteDate: draft.meta?.quoteDate || draft.meta?.quote_date || state.quote.meta.quoteDate,
          managerName: draft.meta?.managerName || draft.meta?.manager_name || state.quote.meta.managerName,
          note: draft.meta?.note || state.quote.meta.note,
          mode: draft.meta?.mode || state.quote.meta.mode,
        },
      },
    };
  }

  return {
    async setView({ view }) {
      update((state) => ({ ...state, ui: { ...state.ui, activeView: view } }));
      if (store.getState().runtime?.dataSource !== "local-api") return;
      if (view === "items") await loadCatalogResource();
      if (view === "overview") {
        const importId = store.getState().ui.selectedImportId;
        await Promise.all([loadProductsResource(importId), loadJobsResource()]);
      }
      if (view === "quote" && !store.getState().quote.itemOrder.length) await loadQuoteDraftResource();
    },
    goToReview() {
      update((state) => ({ ...state, ui: { ...state.ui, activeView: "overview" } }));
    },
    selectScope({ scope }) {
      update((state) => ({ ...state, ui: { ...state.ui, scope } }));
    },
    toggleRole() {
      update((state) => ({
        ...state,
        ui: { ...state.ui, role: state.ui.role === "manager" ? "admin" : "manager" },
      }));
    },
    openClientPicker() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          clientPickerOpen: true,
          clientPickerQuery: state.quote.meta.clientName || "",
        },
      }));
    },
    closeClientPicker() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          clientPickerOpen: false,
          clientPickerQuery: "",
        },
      }));
    },
    setClientPickerQuery(_dataset, value) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          clientPickerOpen: true,
          clientPickerQuery: value,
        },
      }));
    },
    selectClient({ clientId }) {
      update((state) => {
        const client = state.entities.clientsById?.[clientId];
        return syncSelectedQuoteRecord({
          ...state,
          quote: {
            ...state.quote,
            meta: {
              ...state.quote.meta,
              clientId: client?.id || "",
              clientName: client?.name || "",
            },
          },
          ui: {
            ...state.ui,
            clientPickerOpen: false,
            clientPickerQuery: "",
          },
        });
      });
    },
    toggleSidebar() {
      update((state) => {
        const sidebarCollapsed = !state.ui.sidebarCollapsed;
        persistSidebarCollapsed(sidebarCollapsed);
        return {
          ...state,
          ui: { ...state.ui, sidebarCollapsed },
        };
      });
    },
    setTheme({ theme }) {
      const nextTheme = theme === "light" ? "light" : "dark";
      persistTheme(nextTheme);
      update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          theme: nextTheme,
        },
      }));
    },
    addSettingsUser() {
      update((state) => {
        const nextIndex = (state.settings.users?.length || 0) + 1;
        return {
          ...state,
          settings: {
            ...state.settings,
            users: [
              ...(state.settings.users || []),
              {
                id: `usr_${String(Date.now()).slice(-6)}`,
                name: `Новый пользователь ${nextIndex}`,
                email: `user${nextIndex}@bahus.local`,
                role: "Менеджер",
                scope: "Мои данные",
                auth: "Google",
                status: "Приглашён",
              },
            ],
          },
        };
      });
    },
    removeSettingsUser({ userId }) {
      update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          users: (state.settings.users || []).filter((user) => user.id !== userId),
        },
      }));
    },
    cycleSettingsUserRole({ userId }) {
      const roles = ["Администратор", "Менеджер", "Оператор"];
      update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          users: (state.settings.users || []).map((user) => {
            if (user.id !== userId) return user;
            const currentIndex = Math.max(roles.indexOf(user.role), 0);
            return { ...user, role: roles[(currentIndex + 1) % roles.length] };
          }),
        },
      }));
    },
    cycleSettingsUserScope({ userId }) {
      const scopes = ["Все данные", "Мои данные", "Импорт и review"];
      update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          users: (state.settings.users || []).map((user) => {
            if (user.id !== userId) return user;
            const currentIndex = Math.max(scopes.indexOf(user.scope), 0);
            return { ...user, scope: scopes[(currentIndex + 1) % scopes.length] };
          }),
        },
      }));
    },
    toggleSettingsUserStatus({ userId }) {
      update((state) => ({
        ...state,
        settings: {
          ...state.settings,
          users: (state.settings.users || []).map((user) =>
            user.id !== userId
              ? user
              : { ...user, status: user.status === "Активен" ? "Приглашён" : "Активен" },
          ),
        },
      }));
    },
    selectImport({ importId }, value) {
      const nextImportId = importId || value;
      if (!nextImportId) return;
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          selectedImportId: nextImportId,
          selectedRowIds: [],
          selectedRowDetailId: null,
        },
      }));
      if (store.getState().runtime?.dataSource === "local-api") {
        void Promise.all([
          loadProductsResource(nextImportId),
          loadImportStatusResource(nextImportId),
        ]);
      }
    },
    setFilter({ field }, value) {
      update((state) => ({
        ...state,
        ui: { ...state.ui, filters: { ...state.ui.filters, [field]: value } },
      }));
    },
    toggleFilterChoice({ field, value }) {
      update((state) => {
        const current = new Set(state.ui.filters[field] || []);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        return {
          ...state,
          ui: {
            ...state.ui,
            filters: {
              ...state.ui.filters,
              [field]: [...current],
            },
          },
        };
      });
    },
    setSingleFilterChoice({ field, value }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          filters: {
            ...state.ui.filters,
            [field]: value ? [value] : [],
          },
        },
      }));
    },
    toggleColumnFilter({ column }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeColumnFilter: state.ui.activeColumnFilter === column ? null : column,
        },
      }));
    },
    setTableSort({ column, direction }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          sort: {
            column: column || "row_index",
            direction: direction || "asc",
          },
        },
      }));
    },
    setImportTextFilter({ field }, value) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          importFilters: {
            ...state.ui.importFilters,
            [field]: value,
          },
        },
      }));
    },
    toggleImportFilterChoice({ field, value }) {
      update((state) => {
        const current = new Set(state.ui.importFilters[field] || []);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        return {
          ...state,
          ui: {
            ...state.ui,
            importFilters: {
              ...state.ui.importFilters,
              [field]: [...current],
            },
          },
        };
      });
    },
    setSingleImportFilterChoice({ field, value }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          importFilters: {
            ...state.ui.importFilters,
            [field]: value ? [value] : [],
          },
        },
      }));
    },
    toggleImportColumnFilter({ column }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeImportColumnFilter:
            state.ui.activeImportColumnFilter === column ? null : column,
        },
      }));
    },
    setImportTableSort({ column, direction }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          importSort: {
            column: column || "import_date",
            direction: direction || "desc",
          },
        },
      }));
    },
    setQuoteListTextFilter({ field }, value) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          quoteListFilters: {
            ...state.ui.quoteListFilters,
            [field]: value,
          },
        },
      }));
    },
    toggleQuoteListFilterChoice({ field, value }) {
      update((state) => {
        const current = new Set(state.ui.quoteListFilters[field] || []);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        return {
          ...state,
          ui: {
            ...state.ui,
            quoteListFilters: {
              ...state.ui.quoteListFilters,
              [field]: [...current],
            },
          },
        };
      });
    },
    setSingleQuoteListFilterChoice({ field, value }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          quoteListFilters: {
            ...state.ui.quoteListFilters,
            [field]: value ? [value] : [],
          },
        },
      }));
    },
    toggleQuoteListColumnFilter({ column }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeQuoteListColumnFilter: state.ui.activeQuoteListColumnFilter === column ? null : column,
        },
      }));
    },
    setQuoteListSort({ column, direction }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          quoteListSort: {
            column,
            direction,
          },
        },
      }));
    },
    clearQuoteListColumnFilter({ field }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeQuoteListColumnFilter: null,
          quoteListFilters: {
            ...state.ui.quoteListFilters,
            [field]: field === "query" ? "" : [],
          },
        },
      }));
    },
    resetQuoteListFilters() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeQuoteListColumnFilter: null,
          quoteListFilters: {
            query: "",
            client: [],
            manager: [],
            status: [],
          },
        },
      }));
    },
    selectQuote({ quoteId }) {
      update((state) => {
        const record = state.entities.quotesById?.[quoteId];
        return record ? hydrateQuoteFromRecord(state, record) : state;
      });
    },
    clearImportColumnFilter({ field }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          importFilters: {
            ...state.ui.importFilters,
            [field]: field === "file" ? "" : [],
          },
        },
      }));
    },
    clearColumnFilter({ field }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          filters: {
            ...state.ui.filters,
            [field]: field === "name" || field === "code" ? "" : [],
          },
        },
      }));
    },
    resetFilters() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          filters: {
            name: "",
            code: "",
            promo: [],
            country: [],
            category: [],
            issues: [],
            review_status: [],
          },
          activeColumnFilter: null,
        },
      }));
    },
    resetImportFilters() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          importFilters: {
            file: "",
            supplier: [],
            format: [],
            type: [],
            status: [],
          },
          activeImportColumnFilter: null,
        },
      }));
    },
    toggleOverviewDensity() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          overviewDensity: state.ui.overviewDensity === "full" ? "compact" : "full",
        },
      }));
    },
    toggleRowSelection({ productId }) {
      update((state) => {
        const selected = new Set(state.ui.selectedRowIds);
        if (selected.has(productId)) selected.delete(productId);
        else selected.add(productId);
        return {
          ...state,
          ui: { ...state.ui, selectedRowIds: [...selected] },
        };
      });
    },
    selectAllVisibleRows() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          selectedRowIds: unique(getVisibleProducts(state).map((product) => product.id)),
        },
      }));
    },
    clearSelectedRows() {
      update((state) => ({
        ...state,
        ui: { ...state.ui, selectedRowIds: [], selectedRowDetailId: null },
      }));
    },
    openIssuesModal() {
      update((state) => ({ ...state, ui: { ...state.ui, modal: "issues" } }));
    },
    openQuotePreview() {
      update((state) => ({ ...state, ui: { ...state.ui, modal: "quote-preview" } }));
    },
    openNewQuoteModal() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          modal: "new-quote",
          newQuoteDraft: {
            clientId: state.quote.meta.clientId || "",
            title: "",
            note: "",
            requestFiles: [],
          },
        },
      }));
    },
    openExportModal() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          modal: "export",
          exportDraft: {
            format: state.ui.exportDraft?.format || "csv",
          },
        },
      }));
    },
    setExportFormat({ format }) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          exportDraft: {
            ...state.ui.exportDraft,
            format: format || "csv",
          },
        },
      }));
    },
    setNewQuoteDraftField({ field }, value) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          newQuoteDraft: {
            ...state.ui.newQuoteDraft,
            [field]: value,
          },
        },
      }));
    },
    setNewQuoteRequestFiles(_dataset, _value, event) {
      const files = Array.from(event?.target?.files || []).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
      }));
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          newQuoteDraft: {
            ...state.ui.newQuoteDraft,
            requestFiles: files,
          },
        },
      }));
    },
    createNewQuote() {
      update((state) => {
        const draft = state.ui.newQuoteDraft;
        const client = state.entities.clientsById?.[draft.clientId] || null;
        const quoteId = makeId("qt");
        const nextQuote = {
          itemOrder: [],
          itemsById: {},
          meta: {
            ...state.quote.meta,
            clientId: client?.id || "",
            clientName: client?.name || "",
            requestTitle: draft.title || "",
            requestFiles: draft.requestFiles || [],
            quoteNumber: "",
            quoteDate: toInputDate(),
            note: draft.note || "",
            mode: "internal",
          },
        };
        const draftState = {
          ...state,
          quote: nextQuote,
        };
        const quoteRecord = createQuoteRecordFromState(
          {
            ...draftState,
            ui: { ...draftState.ui, selectedQuoteId: quoteId },
          },
          { id: quoteId, linkedImportId: state.ui.selectedImportId, status: "draft" },
        );
        return {
          ...state,
          entities: {
            ...state.entities,
            quoteOrder: [quoteId, ...state.entities.quoteOrder],
            quotesById: {
              ...state.entities.quotesById,
              [quoteId]: quoteRecord,
            },
          },
          quote: {
            ...nextQuote,
          },
          ui: {
            ...state.ui,
            activeView: "quote",
            selectedQuoteId: quoteId,
            modal: null,
            selectedRowIds: [],
            selectedRowDetailId: null,
            clientPickerOpen: false,
            clientPickerQuery: "",
            newQuoteDraft: {
              clientId: "",
              title: "",
              note: "",
              requestFiles: [],
            },
          },
        };
      });
    },
    openUploadFilesModal() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          modal: "upload-files",
          uploadDraft: {
            supplierId: state.ui.uploadDraft?.supplierId || state.entities.importsById[state.ui.selectedImportId]?.supplier_id || "sup_nr",
            documentType: "price_list",
            requestId: state.quote.meta.quoteNumber || "",
            files: [],
            attachments: [],
            managerNote: state.ui.uploadDraft?.managerNote || "",
          },
        },
      }));
    },
    setUploadDraftField({ field }, value) {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          uploadDraft: {
            ...state.ui.uploadDraft,
            [field]: value,
          },
        },
      }));
    },
    setUploadDraftFiles(_dataset, _value, event) {
      const files = Array.from(event?.target?.files || []).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
      }));
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          uploadDraft: {
            ...state.ui.uploadDraft,
            files,
          },
        },
      }));
    },
    setUploadDraftAttachments(_dataset, _value, event) {
      const attachments = Array.from(event?.target?.files || []).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
      }));
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          uploadDraft: {
            ...state.ui.uploadDraft,
            attachments,
          },
        },
      }));
    },
    async createImportsFromUpload() {
      const currentState = store.getState();
      const draft = currentState.ui.uploadDraft;
      const supplierId = draft.supplierId || "sup_nr";
      const supplier = currentState.entities.suppliersById[supplierId];
      const files = draft.files || [];

      if (!files.length || !supplier) {
        update((state) => ({
          ...state,
          ui: { ...state.ui, modal: null },
        }));
        return;
      }

      if (backend && currentState.runtime?.dataSource === "local-api") {
        setResourceState("imports", { status: "saving", error: null });
        try {
          const createdImports = [];
          for (const file of files) {
            const payload = {
              supplier_id: supplierId,
              supplier_name: supplier.name,
              document_type: draft.documentType || "price_list",
              request_ref: draft.requestId || "",
              request_title: draft.requestId ? `Запрос ${draft.requestId}` : "",
              manager_note: draft.managerNote || "",
              files: [
                {
                  file_name: file.name,
                  mime_type: file.type || "application/octet-stream",
                  size_bytes: file.size,
                  file_kind: "price",
                },
              ],
              attachments: (draft.attachments || []).map((attachment) => ({
                file_name: attachment.name,
                mime_type: attachment.type || "application/octet-stream",
                size_bytes: attachment.size,
                file_kind: "attachment",
              })),
            };
            const response = await backend.createImport(payload);
            const createdImportId = response.item?.id;
            if (!createdImportId) continue;
            await backend.dispatchImport(createdImportId, { source: "ui" });
            createdImports.push(createdImportId);
          }

          await loadImportsResource();
          await loadJobsResource();

          const selectedImportId = createdImports.at(-1) || store.getState().ui.selectedImportId;
          if (selectedImportId) {
            update((state) => ({
              ...state,
              ui: {
                ...state.ui,
                activeView: "overview",
                selectedImportId,
                modal: null,
                uploadDraft: {
                  supplierId,
                  documentType: "price_list",
                  requestId: "",
                  files: [],
                  attachments: [],
                  managerNote: "",
                },
              },
            }));
            await Promise.all([
              loadImportStatusResource(selectedImportId),
              loadProductsResource(selectedImportId),
            ]);
          }
          return;
        } catch (error) {
          setResourceState("imports", { status: "error", error: error.message });
          return;
        }
      }

      update((state) => {
        const importsById = { ...state.entities.importsById };
        const importOrder = [...state.entities.importOrder];
        let selectedImportId = state.ui.selectedImportId;

        files.forEach((file, index) => {
          const importId = makeId("imp");
          importsById[importId] = {
            id: importId,
            supplier_id: supplierId,
            created_by: "manager@bakhus",
            owner: "manager@bakhus",
            source: draft.requestId ? `Запрос ${draft.requestId}` : "UI upload",
            status: "uploaded",
            meta: {
              source_file: file.name,
              source_format: (file.name.split(".").pop() || "file").toLowerCase(),
              import_date: toInputDate(),
              currency: "RUB",
              document_type: draft.documentType || "price_list",
              period: toInputDate().slice(0, 7),
              sheet_name: null,
              attachments: draft.attachments || [],
              manager_note: draft.managerNote || "",
            },
            product_ids: [],
            issue_ids: [],
          };
          importOrder.unshift(importId);
          if (index === files.length - 1) selectedImportId = importId;
        });

        return {
          ...state,
          entities: {
            ...state.entities,
            importsById,
            importOrder,
          },
          ui: {
            ...state.ui,
            modal: null,
            activeView: "overview",
            selectedImportId,
            uploadDraft: {
              supplierId,
              documentType: "price_list",
              requestId: "",
              files: [],
              attachments: [],
              managerNote: "",
            },
          },
        };
      });
    },
    closeModal() {
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          modal: null,
          selectedRowDetailId: state.ui.modal === "row-details" ? null : state.ui.selectedRowDetailId,
        },
      }));
    },
    openRowDetails({ productId }) {
      update((state) => ({
        ...state,
        ui: { ...state.ui, selectedRowDetailId: productId, modal: "row-details" },
      }));
    },
    async markSelectedChecked() {
      const selected = getSelectedProducts(store.getState());
      update((state) => {
        const nextProducts = { ...state.entities.productsById };
        selected.forEach((product) => {
          nextProducts[product.id] = { ...product, review_status: "checked" };
        });
        return { ...state, entities: { ...state.entities, productsById: nextProducts } };
      });
      if (backend && selected.length) {
        try {
          await backend.updateReviewRows({
            updates: selected.map((product) => ({
              import_id: product.import_id,
              row_index: product.row_index,
              review_status: "checked",
              excluded: false,
            })),
          });
        } catch {}
      }
    },
    async excludeSelectedRows() {
      const selected = getSelectedProducts(store.getState());
      update((state) => {
        const nextProducts = { ...state.entities.productsById };
        selected.forEach((product) => {
          nextProducts[product.id] = { ...product, excluded: true, review_status: "excluded" };
        });
        return {
          ...state,
          entities: { ...state.entities, productsById: nextProducts },
          ui: { ...state.ui, selectedRowIds: [] },
        };
      });
      if (backend && selected.length) {
        try {
          await backend.updateReviewRows({
            updates: selected.map((product) => ({
              import_id: product.import_id,
              row_index: product.row_index,
              review_status: "excluded",
              excluded: true,
            })),
          });
        } catch {}
      }
    },
    addSelectionToQuote() {
      update((state) => addProductsToQuote(state, getSelectedProducts(state)));
    },
    buildQuote() {
      update((state) => {
        const nextState = addProductsToQuote(state, getSelectedProducts(state));
        return {
          ...nextState,
          ui: { ...nextState.ui, activeView: "quote" },
        };
      });
    },
    fillQuoteFromVisibleReview() {
      update((state) => addProductsToQuote(state, getVisibleProducts(state)));
    },
    removeQuoteItem({ itemId }) {
      update((state) => {
        const nextItems = { ...state.quote.itemsById };
        delete nextItems[itemId];
        return syncSelectedQuoteRecord({
          ...state,
          quote: {
            ...state.quote,
            itemOrder: state.quote.itemOrder.filter((id) => id !== itemId),
            itemsById: nextItems,
          },
        });
      });
    },
    clearQuote() {
      update((state) => syncSelectedQuoteRecord({
        ...state,
        quote: {
          ...state.quote,
          itemOrder: [],
          itemsById: {},
        },
      }));
    },
    async refreshRemoteData() {
      const currentState = store.getState();
      if (currentState.runtime?.dataSource !== "local-api") return;
      await Promise.all([
        loadImportsResource(),
        loadProductsResource(currentState.ui.selectedImportId),
        loadCatalogResource(),
        loadQuoteDraftResource(),
        loadJobsResource(),
      ]);
      await loadImportStatusResource(store.getState().ui.selectedImportId);
    },
    async refreshSelectedImportStatus() {
      const currentState = store.getState();
      if (currentState.runtime?.dataSource !== "local-api") return null;
      const importId = currentState.ui.selectedImportId;
      if (!importId) return null;

      const beforeStatus = currentState.entities.importsById[importId]?.status;
      const status = await loadImportStatusResource(importId);
      const nextStatus = status?.status;

      if (!nextStatus) return null;

      if (nextStatus !== beforeStatus || !isImportProcessing(nextStatus)) {
        await Promise.all([
          loadImportsResource(),
          loadProductsResource(importId),
          loadJobsResource(),
        ]);
      }

      return nextStatus;
    },
    async loadQuoteDraft() {
      await loadQuoteDraftResource();
    },
    async saveQuoteDraft() {
      if (!backend) return;
      const currentState = store.getState();
      const items = currentState.quote.itemOrder
        .map((id) => currentState.quote.itemsById[id])
        .filter(Boolean)
        .map((item) => ({
          source_product_id: item.source_product_id,
          name: item.name,
          qty: item.qty,
          purchase_price: item.purchase_price,
          sale_price: item.sale_price,
          supplier_id: item.supplier_id,
        }));

      const payload = {
        meta: currentState.quote.meta,
        items,
      };

      setResourceState("quoteDraft", { status: "saving", error: null });
      try {
        const response = await backend.saveQuoteDraft(payload);
        setResourceState("quoteDraft", {
          status: "ready",
          item: response,
          error: null,
          lastSavedAt: response?.saved_at || null,
        });
      } catch (error) {
        setResourceState("quoteDraft", { status: "error", error: error.message });
      }
    },
    async saveManualNormalization({ productId }) {
      const state = store.getState();
      const product = state.entities.productsById[productId];
      if (!product || !backend) return;
      const normalizedName = product.manual_normalized_name || product.normalized_name || product.raw_name;
      const note = product.normalization_note || "";

      update((current) => ({
        ...current,
        entities: {
          ...current.entities,
          productsById: {
            ...current.entities.productsById,
            [productId]: {
              ...current.entities.productsById[productId],
              normalized_name: normalizedName,
              review_status: "checked",
            },
          },
        },
      }));

      try {
        const response = await backend.saveManualNormalization({
          import_id: product.import_id,
          row_index: product.row_index,
          manual_normalized_name: normalizedName,
          normalization_note: note,
        });
        update((current) => ({
          ...current,
          entities: {
            ...current.entities,
            productsById: {
              ...current.entities.productsById,
              [productId]: {
                ...current.entities.productsById[productId],
                normalized_name: response.item.manual_normalized_name,
                manual_normalized_name: response.item.manual_normalized_name,
                normalization_note: response.item.normalization_note,
                review_status: response.item.review_status || "checked",
              },
            },
          },
        }));
      } catch {}
    },
    async saveManualMatch({ productId }) {
      const state = store.getState();
      const product = state.entities.productsById[productId];
      if (!product || !backend || !product.manual_match_id) return;

      try {
        const response = await backend.saveManualMatch({
          import_id: product.import_id,
          row_index: product.row_index,
          manual_match_id: product.manual_match_id,
        });
        update((current) => ({
          ...current,
          entities: {
            ...current.entities,
            productsById: {
              ...current.entities.productsById,
              [productId]: {
                ...current.entities.productsById[productId],
                manual_match_id: response.item.manual_match_id,
                manual_match_result: response.item.manual_match_result || null,
                review_status: response.item.review_status || current.entities.productsById[productId].review_status,
              },
            },
          },
        }));
      } catch {}
    },
    async triggerJob({ jobType, target }) {
      if (!backend) return;
      try {
        await backend.triggerJob({
          type: jobType,
          target: target || store.getState().ui.selectedImportId || "workspace",
        });
        await loadJobsResource();
      } catch {}
    },
    setProductField({ productId, field }, value) {
      update((state) => ({
        ...state,
        entities: {
          ...state.entities,
          productsById: {
            ...state.entities.productsById,
            [productId]: {
              ...state.entities.productsById[productId],
              [field]: value,
            },
          },
        },
      }));
    },
    setQuoteItemQty({ itemId }, value) {
      update((state) => withQuoteItem(state, itemId, (item) => ({ ...item, qty: Math.max(1, asNumber(value, 1)) })));
    },
    setQuoteItemSale({ itemId }, value) {
      update((state) => withQuoteItem(state, itemId, (item) => ({ ...item, sale_price: Math.max(0, asNumber(value, 0)) })));
    },
    setQuoteColumnWidth({ columnKey }, value) {
      const nextWidth = Math.max(64, Math.round(Number(value) || 0));
      update((state) => ({
        ...state,
        ui: {
          ...state.ui,
          quoteTableColumns: {
            ...state.ui.quoteTableColumns,
            [columnKey]: nextWidth,
          },
        },
      }));
    },
    toggleAlternativeBlock({ itemId }) {
      update((state) =>
        withQuoteItem(state, itemId, (item) => ({ ...item, alternative_open: !item.alternative_open })),
      );
    },
    applyAlternative({ itemId, alternativeId }) {
      update((state) => {
        const alternative = state.entities.productsById[alternativeId];
        if (!alternative) return state;
        return withQuoteItem(state, itemId, (item) => ({
          ...item,
          selected_alternative_id: alternativeId,
          source_product_id: alternativeId,
          source_import_id: alternative.import_id,
          supplier_id: alternative.supplier_id,
          row_index: alternative.row_index,
          name: alternative.raw_name,
          normalized_name: alternative.normalized_name,
          category: alternative.category,
          country: alternative.country,
          volume_l: alternative.volume_l,
          purchase_price: alternative.purchase_price,
          rrc_min: alternative.rrc_min,
          sale_price:
            typeof alternative.rrc_min === "number"
              ? alternative.rrc_min
              : typeof alternative.purchase_price === "number"
                ? alternative.purchase_price
                : item.sale_price,
        }));
      });
    },
    setQuoteMeta({ field }, value) {
      update((state) => syncSelectedQuoteRecord({
        ...state,
        quote: {
          ...state.quote,
          meta: {
            ...getQuoteMeta(state),
            [field]: value,
            ...(field === "clientName" ? { clientId: "" } : {}),
          },
        },
      }));
    },
    toggleQuoteMode({ mode }) {
      update((state) => syncSelectedQuoteRecord({
        ...state,
        quote: {
          ...state.quote,
          meta: {
            ...getQuoteMeta(state),
            mode,
          },
        },
      }));
    },
    openCurrentImportInFiles() {
      update((state) => ({ ...state, ui: { ...state.ui, activeView: "overview" } }));
    },
    seedQuoteFromReview() {
      update((state) => {
        const currentImport = getCurrentImport(state);
        const products = getCurrentImportProducts(state).filter((product) => !product.excluded);
        const nextState = addProductsToQuote(state, products.slice(0, 4));
        return {
          ...nextState,
          ui: { ...nextState.ui, activeView: "quote", selectedImportId: currentImport.id },
          quote: {
            ...nextState.quote,
            meta: {
              ...nextState.quote.meta,
              requestTitle: nextState.quote.meta.requestTitle || `Подбор по ${currentImport.meta.source_file}`,
            },
          },
        };
      });
    },
    seedQuoteFromImport({ importId }) {
      update((state) => {
        const targetImportId = importId || state.ui.selectedImportId;
        const currentImport = state.entities.importsById[targetImportId];
        if (!currentImport) return state;
        const products = currentImport.product_ids
          .map((id) => state.entities.productsById[id])
          .filter((product) => product && !product.excluded);
        const nextState = addProductsToQuote(state, products.slice(0, 4));
        return {
          ...nextState,
          ui: { ...nextState.ui, activeView: "quote", selectedImportId: currentImport.id },
          quote: {
            ...nextState.quote,
            meta: {
              ...nextState.quote.meta,
              requestTitle:
                nextState.quote.meta.requestTitle ||
                `Подбор по ${currentImport.meta.source_file}`,
            },
          },
        };
      });
    },
    useBestAlternative({ itemId }) {
      update((state) => {
        const [firstAlternative] = findAlternatives(state, itemId);
        if (!firstAlternative) return state;
        return withQuoteItem(state, itemId, (item) => ({
          ...item,
          selected_alternative_id: firstAlternative.id,
          source_product_id: firstAlternative.id,
          source_import_id: firstAlternative.import_id,
          supplier_id: firstAlternative.supplier_id,
          row_index: firstAlternative.row_index,
          name: firstAlternative.raw_name,
          normalized_name: firstAlternative.normalized_name,
          category: firstAlternative.category,
          country: firstAlternative.country,
          volume_l: firstAlternative.volume_l,
          purchase_price: firstAlternative.purchase_price,
          rrc_min: firstAlternative.rrc_min,
          sale_price:
            typeof firstAlternative.rrc_min === "number"
              ? firstAlternative.rrc_min
              : item.sale_price,
        }));
      });
    },
  };
}
