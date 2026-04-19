export const defaultQuoteTableColumns = {
  alternatives: 74,
  row: 64,
  product: 280,
  volume: 78,
  qty: 96,
  purchase: 108,
  rrc: 96,
  sale: 132,
  marginRub: 110,
  marginPct: 92,
  lineSum: 112,
  status: 104,
  alternativesAction: 104,
  removeAction: 104,
};

export const defaultOverviewTableColumns = [
  { id: "row_index", label: "Строка", visible: true },
  { id: "name", label: "Наименование", visible: true },
  { id: "article", label: "Артикул", visible: true },
  { id: "code", label: "Код", visible: true },
  { id: "supplier", label: "Поставщик", visible: true },
  { id: "validity", label: "Актуальность", visible: true },
  { id: "country", label: "Страна", visible: true },
  { id: "category", label: "Категория", visible: true },
  { id: "volume_l", label: "Объём", visible: true },
  { id: "purchase_price", label: "Закупка", visible: true },
  { id: "rrc_min", label: "РРЦ", visible: true },
  { id: "client_price", label: "Цена клиенту", visible: true },
  { id: "margin_rub", label: "Маржа", visible: true },
  { id: "margin_pct", label: "Маржа %", visible: true },
  { id: "promo", label: "Акция", visible: true },
  { id: "issues", label: "Проблемы", visible: true },
  { id: "review_status", label: "Проверка", visible: true },
];

export const defaultItemsTableColumns = [
  { id: "import", label: "Импорт", visible: true },
  { id: "row_index", label: "Строка", visible: true },
  { id: "name", label: "Наименование", visible: true },
  { id: "article", label: "Артикул", visible: true },
  { id: "code", label: "Код", visible: true },
  { id: "supplier", label: "Поставщик", visible: true },
  { id: "validity", label: "Актуальность", visible: true },
  { id: "country", label: "Страна", visible: true },
  { id: "category", label: "Категория", visible: true },
  { id: "document_type", label: "Тип", visible: true },
  { id: "volume_l", label: "Объём", visible: true },
  { id: "purchase_price", label: "Закупка", visible: true },
  { id: "rrc_min", label: "РРЦ", visible: true },
  { id: "promo", label: "Акция", visible: true },
  { id: "issues", label: "Проблемы", visible: true },
  { id: "review_status", label: "Проверка", visible: true },
];

export function createProductKey(importId, product) {
  return `${importId}:${product.product_id || product.temp_id || `row_${product.row_index}`}`;
}

export function createInitialState(payload = {}, options = {}) {
  const {
    dataSource = "local-api",
    dataSourceLabel = "backend configuration",
    bootstrapMode = "api",
    bootstrapError = null,
  } = options;

  const imports = payload.imports || [];
  const clients = payload.clients || [];
  const suppliers = payload.suppliers || [];

  const suppliersById = Object.fromEntries(suppliers.map(s => [s.id, s]));
  const importsById = {};
  const productsById = {};
  const issuesById = {};
  const clientsById = Object.fromEntries(clients.map(client => [client.id, client]));
  
  const quotesById = {};
  const importOrder = [];
  const productOrder = [];
  const issueOrder = [];
  const clientOrder = clients.map(client => client.id);
  const quoteOrder = [];

  imports.forEach((item) => {
    importOrder.push(item.id);
    
    if (item.supplier && item.supplier.id) {
       suppliersById[item.supplier.id] = {
         ...item.supplier,
         import_ids: [...(suppliersById[item.supplier.id]?.import_ids || []), item.id],
       };
    }

    const productIds = [];
    const issueIds = [];

    (item.products || []).forEach((product) => {
      const productId = createProductKey(item.id, product);
      productIds.push(productId);
      productOrder.push(productId);
      productsById[productId] = {
        ...product,
        id: productId,
        import_id: item.id,
        supplier_id: item.supplier?.id,
        review_status: "pending",
        excluded: false,
        manual_match_id: null,
      };
    });

    ["errors", "warnings"].forEach((kind) => {
      (item[kind] || []).forEach((issue, index) => {
        const issueId = `${item.id}:${kind}:${index}`;
        issueIds.push(issueId);
        issueOrder.push(issueId);
        const productId = Object.values(productsById).find(
          (product) => product.import_id === item.id && product.row_index === issue.row_index,
        )?.id;

        issuesById[issueId] = {
          id: issueId,
          import_id: item.id,
          product_id: productId || null,
          severity: kind === "errors" ? "error" : "warning",
          ...issue,
        };
      });
    });

    importsById[item.id] = {
      id: item.id,
      supplier_id: item.supplier?.id,
      created_by: item.created_by,
      owner: item.owner,
      source: item.source,
      status: item.status,
      meta: item.meta,
      product_ids: productIds,
      issue_ids: issueIds,
    };
  });

  return {
    entities: {
      suppliersById,
      importsById,
      productsById,
      issuesById,
      clientsById,
      importOrder,
      productOrder,
      issueOrder,
      clientOrder,
      quotesById,
      quoteOrder,
    },
    ui: {
      activeView: "overview",
      selectedImportId: importOrder[0] || null,
      selectedQuoteId: null,
      selectedRowIds: [],
      selectedRowDetailId: null,
      rowDetailEditMode: false,
      sidebarCollapsed: false,
      clientPickerOpen: false,
      clientPickerQuery: "",
      productSearchQuery: "",
      scope: "my",
      role: "manager",
      overviewDensity: "compact",
      modal: null,
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
      sort: {
        column: "row_index",
        direction: "asc",
      },
      importFilters: {
        file: "",
        supplier: [],
        format: [],
        type: [],
        status: [],
      },
      activeImportColumnFilter: null,
      importSort: {
        column: "import_date",
        direction: "desc",
      },
      quoteListFilters: {
        query: "",
        client: [],
        manager: [],
        status: [],
      },
      activeQuoteListColumnFilter: null,
      quoteListSort: {
        column: "quoteDate",
        direction: "desc",
      },
      quoteTableColumns: { ...defaultQuoteTableColumns },
      overviewTableColumns: [...defaultOverviewTableColumns.map(c => ({...c}))],
      itemsTableColumns: [...defaultItemsTableColumns.map(c => ({...c}))],
      newQuoteDraft: {
        clientId: "",
        title: "",
        note: "",
        requestFiles: [],
        uploadStatus: "idle",
        uploadProgress: 0,
        uploadStage: "",
        uploadLog: [],
        uploadError: null,
      },
      uploadDraft: {
        supplierId: null,
        documentType: "price_list",
        requestId: "",
        files: [],
        attachments: [],
        managerNote: "",
      },
      loginDraft: {
        username: "",
        password: "",
      },
      exportDraft: {
        format: "csv",
      },
    },
    quote: {
      itemOrder: [],
      itemsById: {},
      meta: {
        clientId: "",
        clientName: "",
        requestTitle: "",
        requestFiles: [],
        quoteNumber: "",
        quoteDate: new Date().toISOString().split("T")[0],
        managerName: "Александр",
        note: "",
        mode: "internal",
        aiProcessingStatus: "idle",
        aiProcessingNote: "",
        aiLastRunAt: null,
      },
    },
    runtime: {
      dataSource,
      dataSourceLabel,
      bootstrapMode,
      bootstrapError,
      resources: {
        imports: { status: "idle", items: [], error: null },
      },
    },
    settings: {},
  };
}
