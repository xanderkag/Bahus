import { formatPercent, toInputDate } from "../utils/format.js";

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCurrentImport(state) {
  return state.entities.importsById[state.ui.selectedImportId];
}

export function getCurrentSupplier(state) {
  const currentImport = getCurrentImport(state);
  return currentImport ? state.entities.suppliersById[currentImport.supplier_id] : null;
}

export function getCurrentImportProducts(state) {
  const currentImport = getCurrentImport(state);
  return currentImport ? currentImport.product_ids.map((id) => state.entities.productsById[id]) : [];
}

export function getProductsByScope(state) {
  const all = state.entities.productOrder.map((id) => state.entities.productsById[id]);
  return all;
}

const searchIndexCache = new WeakMap();

export function getVisibleProducts(state) {
  const filterBase =
    state.ui.activeView === "items" ? getProductsByScope(state) : getCurrentImportProducts(state);
  const currentImport = getCurrentImport(state);
  const nameQuery = normalizeText(state.ui.filters.name);
  const codeQuery = normalizeText(state.ui.filters.code);
  const selectedCountries = new Set(state.ui.filters.country || []);
  const selectedCategories = new Set(state.ui.filters.category || []);
  const selectedPromo = new Set(state.ui.filters.promo || []);
  const selectedIssues = new Set(state.ui.filters.issues || []);
  const selectedReview = new Set(state.ui.filters.review_status || []);
  const selectedSuppliers = new Set(state.ui.filters.supplier || []);
  const selectedDocumentTypes = new Set(state.ui.filters.document_type || []);
  const validityQuery = normalizeText(state.ui.filters.validity);
  const articleQuery = normalizeText(state.ui.filters.article);
  
  const productSearchQuery = normalizeText(state.ui.productSearchQuery || "");
  const searchTokens = productSearchQuery ? productSearchQuery.split(" ").filter(Boolean) : [];

  return filterBase
    .filter((product) => {
      if (product.excluded && state.ui.activeView !== "items") {
        return false;
      }
      
      if (searchTokens.length > 0) {
        let index = searchIndexCache.get(product);
        if (!index) {
          const supplierName = state.entities.suppliersById[state.entities.importsById[product.import_id]?.supplier_id]?.name || "";
          index = normalizeText(
            `${product.raw_name || ""} ${product.normalized_name || ""} ${product.product_id || ""} ${product.temp_id || ""} ${product.ids?.internal_code || ""} ${product.article || ""} ${product.category || ""} ${product.country || ""} ${supplierName}`
          );
          searchIndexCache.set(product, index);
        }
        if (!searchTokens.every((token) => index.includes(token))) {
          return false;
        }
      }

      if (
        nameQuery &&
        !normalizeText(`${product.raw_name || ""} ${product.normalized_name || ""}`).includes(nameQuery)
      ) {
        return false;
      }
      if (
        codeQuery &&
        !normalizeText(`${product.product_id || ""} ${product.temp_id || ""} ${product.ids?.internal_code || ""} ${product.article || ""}`).includes(codeQuery)
      ) {
        return false;
      }
      if (selectedPromo.size && !selectedPromo.has(String(Boolean(product.promo)))) return false;
      if (selectedCountries.size && !selectedCountries.has(product.country)) return false;
      if (selectedCategories.size && !selectedCategories.has(product.category)) return false;
      if (selectedReview.size && !selectedReview.has(product.review_status)) return false;

      const issues = getIssuesForProduct(state, product.id);
      const hasErrors = issues.some((issue) => issue.severity === "error");
      const hasWarnings = issues.some((issue) => issue.severity === "warning");
      const issueToken = hasErrors ? "errors" : hasWarnings ? "warnings" : "clean";
      if (selectedIssues.size && !selectedIssues.has(issueToken)) return false;

      if (
        articleQuery &&
        !normalizeText(product.article).includes(articleQuery)
      ) {
        return false;
      }

      const supplierName = state.entities.suppliersById[state.entities.importsById[product.import_id]?.supplier_id]?.name;
      if (selectedSuppliers.size && !selectedSuppliers.has(supplierName)) return false;

      const docType = state.entities.importsById[product.import_id]?.meta?.document_type;
      if (selectedDocumentTypes.size && !selectedDocumentTypes.has(docType)) return false;

      if (validityQuery) {
        const importDate = state.entities.importsById[product.import_id]?.meta?.import_date;
        const periodStr = state.entities.importsById[product.import_id]?.meta?.period;
        if (!normalizeText(importDate).includes(validityQuery) && !normalizeText(periodStr).includes(validityQuery)) return false;
      }

      if (
        state.ui.activeView !== "items" &&
        currentImport &&
        product.import_id !== currentImport.id
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const column = state.ui.sort?.column || "row_index";
      const direction = state.ui.sort?.direction === "desc" ? -1 : 1;

      const getSortValue = (product) => {
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
        switch (column) {
          case "name":
            return normalizeText(product.normalized_name || product.raw_name);
          case "code":
            return normalizeText(product.product_id || product.temp_id || product.ids?.internal_code || "");
          case "country":
            return normalizeText(product.country);
          case "category":
            return normalizeText(product.category);
          case "supplier":
            return normalizeText(state.entities.suppliersById[state.entities.importsById[product.import_id]?.supplier_id]?.name);
          case "validity":
            return normalizeText(state.entities.importsById[product.import_id]?.meta?.import_date);
          case "document_type":
            return normalizeText(state.entities.importsById[product.import_id]?.meta?.document_type);
          case "article":
            return normalizeText(product.article);
          case "promo":
            return product.promo ? 1 : 0;
          case "volume_l":
            return product.volume_l ?? -1;
          case "purchase_price":
            return product.purchase_price ?? -1;
          case "rrc_min":
            return product.rrc_min ?? -1;
          case "client_price":
            return clientPrice ?? -1;
          case "margin_rub":
            return marginRub ?? -1;
          case "margin_pct":
            return marginPct ?? -1;
          case "issues": {
            const summary = getRowIssueSummary(state, product.id);
            if (summary.kind === "bad") return 2;
            if (summary.kind === "warn") return 1;
            return 0;
          }
          case "review_status":
            return normalizeText(product.review_status);
          default:
            return product.row_index || 0;
        }
      };

      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);

      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
}

export function getIssuesForProduct(state, productId) {
  return state.entities.issueOrder
    .map((id) => state.entities.issuesById[id])
    .filter((issue) => issue.product_id === productId);
}

export function getCurrentImportIssues(state) {
  const currentImport = getCurrentImport(state);
  return currentImport
    ? currentImport.issue_ids.map((id) => state.entities.issuesById[id])
    : [];
}

export function getRowIssueSummary(state, productId) {
  const issues = getIssuesForProduct(state, productId);
  const hasError = issues.some((issue) => issue.severity === "error");
  const hasWarning = issues.some((issue) => issue.severity === "warning");
  if (hasError) return { kind: "bad", label: "Ошибка", count: issues.length };
  if (hasWarning) return { kind: "warn", label: "Предупр.", count: issues.length };
  return { kind: "good", label: "OK", count: 0 };
}

export function getSelectedProducts(state) {
  return state.ui.selectedRowIds.map((id) => state.entities.productsById[id]).filter(Boolean);
}

export function getSelectedProductDetail(state) {
  return state.ui.selectedRowDetailId
    ? state.entities.productsById[state.ui.selectedRowDetailId]
    : getSelectedProducts(state)[0] || null;
}

export function getRuntimeJobs(state) {
  return state.runtime?.resources?.jobs?.items || [];
}

export function getFilterOptions(state) {
  const base =
    state.ui.activeView === "items" ? getProductsByScope(state) : getCurrentImportProducts(state);

  return {
    countries: [...new Set(base.map((product) => product.country).filter(Boolean))].sort(),
    categories: [...new Set(base.map((product) => product.category).filter(Boolean))].sort(),
    suppliers: [...new Set(base.map((product) => state.entities.suppliersById[state.entities.importsById[product.import_id]?.supplier_id]?.name).filter(Boolean))].sort(),
    documentTypes: [...new Set(base.map((product) => state.entities.importsById[product.import_id]?.meta?.document_type).filter(Boolean))].sort(),
    promo: [
      { value: "true", label: "Акция" },
      { value: "false", label: "Обычный" },
    ],
    issues: [
      { value: "errors", label: "С ошибками" },
      { value: "warnings", label: "С предупреждениями" },
      { value: "clean", label: "Без проблем" },
    ],
    reviewStatus: [
      { value: "pending", label: "Ждёт проверки" },
      { value: "checked", label: "Проверено" },
      { value: "excluded", label: "Исключено" },
    ],
  };
}

export function getOverviewStats(state) {
  const currentImport = getCurrentImport(state);
  const products = getCurrentImportProducts(state);
  const issues = getCurrentImportIssues(state);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const checked = products.filter((product) => product.review_status === "checked").length;
  const excluded = products.filter((product) => product.excluded).length;
  return {
    totalRows: products.length,
    errors,
    warnings,
    selected: state.ui.selectedRowIds.length,
    checked,
    excluded,
    currentImport,
  };
}

export function getQuoteItems(state) {
  return state.quote.itemOrder.map((id) => state.quote.itemsById[id]).filter(Boolean);
}

export function enrichQuoteItems(state) {
  return getQuoteItems(state).map((item) => {
    const purchase = item.purchase_price;
    const sale = item.sale_price;
    const qty = Number(item.qty || 0);
    const marginRub = typeof purchase === "number" && typeof sale === "number" ? sale - purchase : null;
    const marginPct = marginRub !== null && purchase ? (marginRub / purchase) * 100 : null;
    const lineSum = typeof sale === "number" ? sale * qty : null;
    return { ...item, marginRub, marginPct, lineSum };
  });
}

export function getQuoteSummary(state) {
  const items = enrichQuoteItems(state);
  const summary = items.reduce(
    (acc, item) => {
      const purchase = typeof item.purchase_price === "number" ? item.purchase_price * item.qty : 0;
      const sale = typeof item.sale_price === "number" ? item.sale_price * item.qty : 0;
      const margin = typeof item.marginRub === "number" ? item.marginRub * item.qty : 0;
      acc.positions += 1;
      acc.qty += Number(item.qty || 0);
      acc.purchase += purchase;
      acc.sale += sale;
      acc.margin += margin;
      return acc;
    },
    { positions: 0, qty: 0, purchase: 0, sale: 0, margin: 0 },
  );

  return {
    ...summary,
    marginPct: summary.purchase > 0 ? (summary.margin / summary.purchase) * 100 : null,
  };
}

export function getQuoteAlerts(state) {
  const items = enrichQuoteItems(state);
  const missingSale = items.filter(
    (item) => typeof item.sale_price !== "number" || item.sale_price <= 0,
  );
  const missingRrc = items.filter((item) => typeof item.rrc_min !== "number");
  const negativeMargin = items.filter(
    (item) => typeof item.marginRub === "number" && item.marginRub < 0,
  );
  const zeroQty = items.filter((item) => Number(item.qty || 0) <= 0);

  return {
    missingSale,
    missingRrc,
    negativeMargin,
    zeroQty,
    total: missingSale.length + missingRrc.length + negativeMargin.length + zeroQty.length,
  };
}

export function getQuoteClients(state) {
  const query = normalizeText(state.ui.clientPickerQuery);
  return (state.entities.clientOrder || [])
    .map((id) => state.entities.clientsById?.[id])
    .filter(Boolean)
    .filter((client) => {
      if (!query) return true;
      return normalizeText(`${client.name} ${client.inn || ""} ${client.city || ""}`).includes(query);
    });
}

export function getSelectedClient(state) {
  const clientId = state.quote.meta.clientId;
  return clientId ? state.entities.clientsById?.[clientId] || null : null;
}

export function getQuoteMeta(state) {
  const selectedClient = getSelectedClient(state);
  return {
    ...state.quote.meta,
    clientId: state.quote.meta.clientId || "",
    clientName: selectedClient?.name || state.quote.meta.clientName || "",
    quoteDate: state.quote.meta.quoteDate || toInputDate(),
    quoteNumber: state.quote.meta.quoteNumber || `КП-${toInputDate().replaceAll("-", "")}`,
  };
}

export function getCurrentQuoteRecord(state) {
  const quoteId = state.ui.selectedQuoteId;
  return quoteId ? state.entities.quotesById?.[quoteId] || null : null;
}

export function getQuoteListOptions(state) {
  const quotes = (state.entities.quoteOrder || [])
    .map((id) => state.entities.quotesById?.[id])
    .filter(Boolean);

  return {
    clients: [...new Set(quotes.map((quote) => quote.meta?.clientName).filter(Boolean))].sort(),
    managers: [...new Set(quotes.map((quote) => quote.meta?.managerName).filter(Boolean))].sort(),
    statuses: [
      { value: "draft", label: "Черновик" },
      { value: "review", label: "На проверке" },
      { value: "ready", label: "Готово" },
    ],
  };
}

const quoteSearchIndexCache = new WeakMap();

export function getVisibleQuotes(state) {
  const query = normalizeText(state.ui.quoteListFilters?.query || "");
  const searchTokens = query ? query.split(" ").filter(Boolean) : [];
  const selectedClients = new Set(state.ui.quoteListFilters?.client || []);
  const selectedManagers = new Set(state.ui.quoteListFilters?.manager || []);
  const selectedStatuses = new Set(state.ui.quoteListFilters?.status || []);

  return (state.entities.quoteOrder || [])
    .map((id) => state.entities.quotesById?.[id])
    .filter(Boolean)
    .filter((quote) => {
      if (searchTokens.length > 0) {
        let index = quoteSearchIndexCache.get(quote);
        if (!index) {
          index = normalizeText(
            `${quote.meta?.quoteNumber || ""} ${quote.meta?.requestTitle || ""} ${quote.meta?.clientName || ""} ${quote.meta?.managerName || ""} ${quote.status || ""}`
          );
          quoteSearchIndexCache.set(quote, index);
        }
        if (!searchTokens.every((token) => index.includes(token))) {
          return false;
        }
      }
      
      if (selectedClients.size && !selectedClients.has(quote.meta?.clientName || "")) return false;
      if (selectedManagers.size && !selectedManagers.has(quote.meta?.managerName || "")) return false;
      if (selectedStatuses.size && !selectedStatuses.has(quote.status || "draft")) return false;
      return true;
    })
    .sort((left, right) => {
      const direction = state.ui.quoteListSort?.direction === "asc" ? 1 : -1;
      const column = state.ui.quoteListSort?.column || "quoteDate";

      const getValue = (quote) => {
        switch (column) {
          case "quoteNumber":
            return normalizeText(quote.meta?.quoteNumber || "");
          case "client":
            return normalizeText(quote.meta?.clientName || "");
          case "requestTitle":
            return normalizeText(quote.meta?.requestTitle || "");
          case "manager":
            return normalizeText(quote.meta?.managerName || "");
          case "status":
            return normalizeText(quote.status || "");
          case "positions":
            return quote.items?.length || 0;
          default:
            return quote.meta?.quoteDate || "";
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
}

export function getQuotePreviewRows(state) {
  const mode = getQuoteMeta(state).mode;
  return enrichQuoteItems(state).map((item, index) => ({
    index: index + 1,
    name: item.name,
    volume: item.volume_l,
    qty: item.qty,
    sale: item.sale_price,
    lineSum: item.lineSum,
    purchase: item.purchase_price,
    marginPctLabel: formatPercent(item.marginPct),
    mode,
  }));
}

export function findAlternatives(state, quoteItemId) {
  const quoteItem = state.quote.itemsById[quoteItemId];
  if (!quoteItem) return [];
  const baseName = normalizeText(quoteItem.normalized_name || quoteItem.name);
  const baseTokens = new Set(baseName.split(" ").filter((token) => token.length > 2));

  return state.entities.productOrder
    .map((id) => state.entities.productsById[id])
    .filter((product) => product.id !== quoteItem.source_product_id && !product.excluded)
    .map((product) => {
      let score = 0;
      if (quoteItem.category && product.category === quoteItem.category) score += 4;
      if (quoteItem.country && product.country === quoteItem.country) score += 2;
      if (quoteItem.volume_l && product.volume_l && Math.abs(quoteItem.volume_l - product.volume_l) < 0.001) {
        score += 3;
      }
      normalizeText(product.normalized_name || product.raw_name)
        .split(" ")
        .forEach((token) => {
          if (baseTokens.has(token)) score += 1;
        });

      const importRecord = state.entities.importsById[product.import_id];
      const supplier = state.entities.suppliersById[product.supplier_id];
      return { ...product, score, importRecord, supplier };
    })
    .filter((candidate) => candidate.score >= 4)
    .sort((left, right) => right.score - left.score || (left.purchase_price || 999999) - (right.purchase_price || 999999))
    .slice(0, 5);
}

export function getItemsGroups(state) {
  const visible = getProductsByScope(state).filter((product) => !product.excluded);
  const groups = new Map();

  visible.forEach((product) => {
    const key = normalizeText(product.normalized_name || product.raw_name);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: product.normalized_name || product.raw_name,
        category: product.category,
        countries: new Set(),
        supplierIds: new Set(),
        variants: [],
      });
    }
    const group = groups.get(key);
    group.countries.add(product.country || "—");
    group.supplierIds.add(product.supplier_id);
    group.variants.push(product);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      countries: [...group.countries].join(", "),
      suppliers: [...group.supplierIds].map((id) => state.entities.suppliersById[id]?.name || "—"),
      minPrice: Math.min(...group.variants.map((variant) => variant.purchase_price || Infinity)),
      maxPrice: Math.max(...group.variants.map((variant) => variant.purchase_price || 0)),
    }))
    .sort((left, right) => right.variants.length - left.variants.length || left.title.localeCompare(right.title, "ru"));
}
