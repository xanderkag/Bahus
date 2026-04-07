import { toInputDate } from "../utils/format.js";

export const demoImports = [
  {
    id: "imp_001",
    meta: {
      source_file: "НР_Сетка_цен_Февраль.xlsx",
      source_format: "excel",
      import_date: "2026-03-02",
      currency: "RUB",
      document_type: "net_price",
      period: "2026-02",
      sheet_name: "ФЕВРАЛЬ",
    },
    supplier: { id: "sup_nr", name: "НР", contract_type: "net_price", vat_included: true },
    created_by: "manager@bakhus",
    source: "Telegram-бот",
    owner: "manager@bakhus",
    status: "partial",
    errors: [
      { row_index: 27, field: "purchase_price", message: "Цена закупки не распознана", raw_value: "—" },
    ],
    warnings: [
      { row_index: 22, field: "volume_l", message: "Объём выведен из названия — проверьте." },
    ],
    products: [
      { row_index: 15, product_id: "s147415", raw_name: "Бруни Кюве Розе, розовое сладкое, 0.75", normalized_name: "Бруни Кюве Розе", category: "Игристое", country: "Италия", volume_l: 0.75, purchase_price: 750.32, rrc_min: 1109, promo: false, ids: { internal_code: "s147415" } },
      { row_index: 18, product_id: "s200010", raw_name: "Просекко DOC Экстра Драй 0.75", normalized_name: "Просекко DOC Экстра Драй", category: "Игристое", country: "Италия", volume_l: 0.75, purchase_price: 680.0, rrc_min: 999, promo: false, ids: {} },
      { row_index: 22, product_id: null, temp_id: "tmp_7aa2f", raw_name: "Вино белое сладкое 1 л", normalized_name: null, category: "Вино", country: "Франция", volume_l: 1.0, purchase_price: 405.0, rrc_min: 620, promo: true, ids: {} },
      { row_index: 24, product_id: "s310020", raw_name: "Виски ирландский купажированный 0.7", normalized_name: "Виски ирландский купажированный", category: "Виски", country: "Ирландия", volume_l: 0.7, purchase_price: 1890.0, rrc_min: 2699, promo: false, ids: {} },
      { row_index: 25, product_id: "s410055", raw_name: "Аперитив апельсиновый 1 л", normalized_name: "Аперитив апельсиновый", category: "Аперитив", country: "Италия", volume_l: 1.0, purchase_price: 1320.0, rrc_min: 1899, promo: true, ids: {} },
      { row_index: 27, product_id: "s500777", raw_name: "Джин лондонский сухой 0.7", normalized_name: null, category: "Джин", country: "Великобритания", volume_l: 0.7, purchase_price: null, rrc_min: 1599, promo: false, ids: {} },
      { row_index: 29, product_id: "s600101", raw_name: "Шардоне сухое 0.75", normalized_name: "Шардоне", category: "Вино", country: "Чили", volume_l: 0.75, purchase_price: 520.0, rrc_min: 799, promo: false, ids: {} },
      { row_index: 31, product_id: "s700909", raw_name: "Игристое брют 0.75 (акция)", normalized_name: null, category: "Игристое", country: "Испания", volume_l: 0.75, purchase_price: 610.0, rrc_min: null, promo: true, ids: {} },
    ],
  },
  {
    id: "imp_002",
    meta: {
      source_file: "Поставщик_А_Акции_Март.pdf",
      source_format: "pdf",
      import_date: "2026-03-05",
      currency: "RUB",
      document_type: "promo",
      period: "2026-03",
      sheet_name: null,
    },
    supplier: { id: "sup_a", name: "Поставщик А", contract_type: "promo", vat_included: true },
    created_by: "admin@bakhus",
    source: "Telegram-бот",
    owner: "admin@bakhus",
    status: "success",
    errors: [],
    warnings: [
      { row_index: 7, field: "rrc_min", message: "RRC отсутствует — используйте цену продажи вручную в КП." },
    ],
    products: [
      { row_index: 1, product_id: "a-1001", raw_name: "Аперитив горький 1 л (акция -15%)", normalized_name: "Аперитив горький", category: "Аперитив", country: "Италия", volume_l: 1.0, purchase_price: 1550.0, rrc_min: 2290, promo: true, ids: {} },
      { row_index: 2, product_id: "a-1002", raw_name: "Вермут белый 1 л (акция)", normalized_name: "Вермут белый", category: "Вермут", country: "Италия", volume_l: 1.0, purchase_price: 790.0, rrc_min: 1190, promo: true, ids: {} },
      { row_index: 3, product_id: "a-1003", raw_name: "Виски теннессийский 0.7", normalized_name: "Виски теннессийский", category: "Виски", country: "США", volume_l: 0.7, purchase_price: 2050.0, rrc_min: 2990, promo: false, ids: {} },
      { row_index: 5, product_id: "a-1004", raw_name: "Ликёр сливочный 0.7", normalized_name: "Ликёр сливочный", category: "Ликёр", country: "Ирландия", volume_l: 0.7, purchase_price: 1480.0, rrc_min: 2190, promo: true, ids: {} },
      { row_index: 7, product_id: "a-1005", raw_name: "Просекко розовое 0.75", normalized_name: "Просекко розовое", category: "Игристое", country: "Италия", volume_l: 0.75, purchase_price: 640.0, rrc_min: null, promo: true, ids: {} },
      { row_index: 9, product_id: "a-1006", raw_name: "Совиньон Блан 0.75", normalized_name: "Совиньон Блан", category: "Вино", country: "Новая Зеландия", volume_l: 0.75, purchase_price: 980.0, rrc_min: 1490, promo: false, ids: {} },
      { row_index: 10, product_id: "a-1007", raw_name: "Шотландский виски 12 лет 0.7", normalized_name: "Шотландский виски 12 лет", category: "Виски", country: "Шотландия", volume_l: 0.7, purchase_price: 2650.0, rrc_min: 3890, promo: false, ids: {} },
      { row_index: 11, product_id: "a-1008", raw_name: "Кава брют 0.75", normalized_name: "Кава брют", category: "Игристое", country: "Испания", volume_l: 0.75, purchase_price: 590.0, rrc_min: 890, promo: true, ids: {} },
    ],
  },
  {
    id: "imp_003",
    meta: {
      source_file: "Поставщик_Б_Прайс_Март.pdf",
      source_format: "pdf",
      import_date: "2026-03-07",
      currency: "RUB",
      document_type: "price_list",
      period: "2026-03",
      sheet_name: null,
    },
    supplier: { id: "sup_b", name: "Поставщик Б", contract_type: "price_list", vat_included: false },
    created_by: "manager@bakhus",
    source: "Telegram-бот",
    owner: "manager@bakhus",
    status: "partial",
    errors: [
      { row_index: 4, field: "volume_l", message: "Объём не найден", raw_value: "—" },
    ],
    warnings: [],
    products: [
      { row_index: 1, product_id: "b-2001", raw_name: "Водка премиальная 0.5", normalized_name: null, category: "Водка", country: "Россия", volume_l: 0.5, purchase_price: 320.0, rrc_min: 499, promo: false, ids: {} },
      { row_index: 2, product_id: "b-2002", raw_name: "Водка премиальная 0.7", normalized_name: null, category: "Водка", country: "Россия", volume_l: 0.7, purchase_price: 410.0, rrc_min: 649, promo: false, ids: {} },
      { row_index: 3, product_id: "b-2003", raw_name: "Коньяк VS 0.5", normalized_name: null, category: "Коньяк", country: "Франция", volume_l: 0.5, purchase_price: 990.0, rrc_min: 1490, promo: false, ids: {} },
      { row_index: 4, product_id: "b-2004", raw_name: "Коньяк VS (объём не указан)", normalized_name: null, category: "Коньяк", country: "Франция", volume_l: null, purchase_price: 1100.0, rrc_min: 1690, promo: false, ids: {} },
      { row_index: 5, product_id: "b-2005", raw_name: "Ром пряный 0.7", normalized_name: null, category: "Ром", country: "Барбадос", volume_l: 0.7, purchase_price: 870.0, rrc_min: 1290, promo: false, ids: {} },
      { row_index: 6, product_id: "b-2006", raw_name: "Текила бланко 0.7", normalized_name: null, category: "Текила", country: "Мексика", volume_l: 0.7, purchase_price: 1140.0, rrc_min: 1690, promo: false, ids: {} },
      { row_index: 7, product_id: "b-2007", raw_name: "Виски односолодовый 0.7", normalized_name: null, category: "Виски", country: "Шотландия", volume_l: 0.7, purchase_price: 3100.0, rrc_min: 4590, promo: false, ids: {} },
      { row_index: 8, product_id: "b-2008", raw_name: "Игристое вино брют 0.75", normalized_name: null, category: "Игристое", country: "Италия", volume_l: 0.75, purchase_price: 560.0, rrc_min: 850, promo: false, ids: {} },
    ],
  },
];

export const demoClients = [
  { id: "cl_001", name: 'ООО "Гастроном на Петровке"', inn: "7704123456", city: "Москва" },
  { id: "cl_002", name: 'Ресторанный холдинг "Северный Берег"', inn: "7812456789", city: "Санкт-Петербург" },
  { id: "cl_003", name: 'Группа HoReCa "Винная Карта"', inn: "5403987654", city: "Новосибирск" },
  { id: "cl_004", name: 'Бутик-бар "Солод и Дуб"', inn: "6678123490", city: "Екатеринбург" },
  { id: "cl_005", name: 'ООО "Торговый дом Демо клиент с очень длинным названием для проверки селектора"', inn: "7722334455", city: "Москва" },
];

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

export function createProductKey(importId, product) {
  return `${importId}:${product.product_id || product.temp_id || `row_${product.row_index}`}`;
}

export const demoQuotes = [
  {
    id: "qt_001",
    linkedImportId: "imp_003",
    status: "draft",
    meta: {
      clientId: "cl_001",
      clientName: 'ООО "Гастроном на Петровке"',
      requestTitle: "Подбор по Поставщик_Б_Прайс_Март.pdf",
      requestFiles: [],
      quoteNumber: "КП-20260406",
      quoteDate: "2026-04-06",
      managerName: "Александр",
      note: "Базовая версия для внутренней проверки цен и маржи.",
      mode: "internal",
    },
    items: [
      { source_product_id: "imp_003:b-2001", sale_price: 499, qty: 1 },
      { source_product_id: "imp_003:b-2002", sale_price: 649, qty: 1 },
      { source_product_id: "imp_003:b-2003", sale_price: 1490, qty: 1 },
      { source_product_id: "imp_003:b-2005", sale_price: 1290, qty: 1 },
    ],
  },
  {
    id: "qt_002",
    linkedImportId: "imp_002",
    status: "ready",
    meta: {
      clientId: "cl_002",
      clientName: 'Ресторанный холдинг "Северный Берег"',
      requestTitle: "Весеннее промо по Поставщик_А_Акции_Март.pdf",
      requestFiles: [],
      quoteNumber: "КП-20260402",
      quoteDate: "2026-04-02",
      managerName: "Александр",
      note: "Клиентская версия с промо-позициями и быстрым циклом согласования.",
      mode: "client",
    },
    items: [
      { source_product_id: "imp_002:a-1001", sale_price: 2290, qty: 2 },
      { source_product_id: "imp_002:a-1002", sale_price: 1190, qty: 3 },
      { source_product_id: "imp_002:a-1005", sale_price: 990, qty: 2 },
    ],
  },
  {
    id: "qt_003",
    linkedImportId: "imp_001",
    status: "review",
    meta: {
      clientId: "",
      clientName: "",
      requestTitle: "Черновик по НР_Сетка_цен_Февраль.xlsx",
      requestFiles: [],
      quoteNumber: "КП-20260329",
      quoteDate: "2026-03-29",
      managerName: "Александр",
      note: "Нужно добрать клиента и проверить проблемные строки перед отправкой.",
      mode: "internal",
    },
    items: [
      { source_product_id: "imp_001:s147415", sale_price: 1109, qty: 1 },
      { source_product_id: "imp_001:s200010", sale_price: 999, qty: 1 },
      { source_product_id: "imp_001:tmp_7aa2f", sale_price: 620, qty: 1 },
    ],
  },
];

export function normalizeImportsToState(imports, options = {}) {
  const {
    dataSource = "demo",
    dataSourceLabel = "embedded demo",
    bootstrapMode = "demo",
    bootstrapError = null,
  } = options;
  const suppliersById = {};
  const importsById = {};
  const productsById = {};
  const issuesById = {};
  const clientsById = Object.fromEntries(demoClients.map((client) => [client.id, client]));
  const quotesById = {};
  const importOrder = [];
  const productOrder = [];
  const issueOrder = [];
  const clientOrder = demoClients.map((client) => client.id);
  const quoteOrder = [];

  imports.forEach((item) => {
    importOrder.push(item.id);
    suppliersById[item.supplier.id] = {
      ...item.supplier,
      import_ids: [...(suppliersById[item.supplier.id]?.import_ids || []), item.id],
    };

    const productIds = [];
    const issueIds = [];

    item.products.forEach((product) => {
      const productId = createProductKey(item.id, product);
      productIds.push(productId);
      productOrder.push(productId);
      productsById[productId] = {
        ...product,
        id: productId,
        import_id: item.id,
        supplier_id: item.supplier.id,
        review_status: "pending",
        excluded: false,
        manual_match_id: null,
      };
    });

    ["errors", "warnings"].forEach((kind) => {
      item[kind].forEach((issue, index) => {
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
      supplier_id: item.supplier.id,
      created_by: item.created_by,
      owner: item.owner,
      source: item.source,
      status: item.status,
      meta: item.meta,
      product_ids: productIds,
      issue_ids: issueIds,
    };
  });

  demoQuotes.forEach((quote) => {
    const hydratedItems = (quote.items || [])
      .map((item, index) => {
        const product = productsById[item.source_product_id];
        if (!product) return null;
        return {
          id: item.source_product_id || `quote_item_${index + 1}`,
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
          sale_price: item.sale_price ?? product.rrc_min ?? product.purchase_price ?? 0,
          qty: item.qty ?? 1,
          alternative_open: false,
          selected_alternative_id: null,
        };
      })
      .filter(Boolean);

    quoteOrder.push(quote.id);
    quotesById[quote.id] = {
      id: quote.id,
      linkedImportId: quote.linkedImportId || null,
      status: quote.status || "draft",
      updatedAt: quote.meta?.quoteDate || toInputDate(),
      meta: {
        clientId: quote.meta?.clientId || "",
        clientName: quote.meta?.clientName || "",
        requestTitle: quote.meta?.requestTitle || "",
        requestFiles: quote.meta?.requestFiles || [],
        quoteNumber: quote.meta?.quoteNumber || "",
        quoteDate: quote.meta?.quoteDate || toInputDate(),
        managerName: quote.meta?.managerName || "Александр",
        note: quote.meta?.note || "",
        mode: quote.meta?.mode || "internal",
      },
      items: hydratedItems,
    };
  });

  const initialQuoteId = quoteOrder[0] || null;
  const initialQuote = initialQuoteId ? quotesById[initialQuoteId] : null;
  const initialQuoteItems = initialQuote?.items || [];

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
      selectedImportId: "imp_001",
      selectedQuoteId: initialQuoteId,
      selectedRowIds: [],
      selectedRowDetailId: null,
      sidebarCollapsed: false,
      clientPickerOpen: false,
      clientPickerQuery: "",
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
      newQuoteDraft: {
        clientId: "",
        title: "",
        note: "",
        requestFiles: [],
      },
      uploadDraft: {
        supplierId: "sup_nr",
        documentType: "price_list",
        requestId: "",
        files: [],
        attachments: [],
        managerNote: "",
      },
      exportDraft: {
        format: "csv",
      },
    },
    quote: {
      itemOrder: initialQuoteItems.map((item) => item.id),
      itemsById: Object.fromEntries(initialQuoteItems.map((item) => [item.id, item])),
      meta: {
        clientId: initialQuote?.meta?.clientId || "",
        clientName: initialQuote?.meta?.clientName || "",
        requestTitle: initialQuote?.meta?.requestTitle || "",
        requestFiles: initialQuote?.meta?.requestFiles || [],
        quoteNumber: initialQuote?.meta?.quoteNumber || "",
        quoteDate: initialQuote?.meta?.quoteDate || "",
        managerName: initialQuote?.meta?.managerName || "Александр",
        note: initialQuote?.meta?.note || "",
        mode: initialQuote?.meta?.mode || "internal",
      },
    },
    settings: {
      workflow_endpoint: "n8n://price-import-orchestrator",
      catalog_source: dataSource,
      export_format: "pdf",
      theme: "dark",
      users_enabled: false,
      live_upload_enabled: false,
      users: [
        {
          id: "usr_001",
          name: "Александр Ляпустин",
          email: "liapsutin@gmail.com",
          role: "Администратор",
          scope: "Все данные",
          auth: "Google",
          status: "Активен",
        },
        {
          id: "usr_002",
          name: "Менеджер Bahus",
          email: "manager@bahus.local",
          role: "Менеджер",
          scope: "Мои данные",
          auth: "Google",
          status: "Приглашён",
        },
        {
          id: "usr_003",
          name: "Оператор импорта",
          email: "review@bahus.local",
          role: "Оператор",
          scope: "Импорт и review",
          auth: "Google",
          status: "Активен",
        },
      ],
    },
    runtime: {
      dataSource,
      dataSourceLabel,
      bootstrapMode,
      bootstrapError,
      apiBaseUrl: null,
      resources: {
        imports: { status: "idle", error: null, items: [] },
        catalog: { status: "idle", error: null, items: [] },
        quoteDraft: { status: "idle", error: null, item: null, lastSavedAt: null },
      },
    },
  };
}

export function createDemoState() {
  return normalizeImportsToState(demoImports, {
    dataSource: "demo",
    dataSourceLabel: "embedded demo",
    bootstrapMode: "demo",
  });
}
