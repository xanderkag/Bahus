import { loadStateFromApi } from "./api.js";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function createBackend(apiBaseUrl) {
  return {
    apiBaseUrl,
    loadBootstrap() {
      return loadStateFromApi(apiBaseUrl);
    },
    loadImports() {
      return fetchJson(`${apiBaseUrl}/imports`);
    },
    createImport(payload) {
      return fetchJson(`${apiBaseUrl}/imports`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    dispatchImport(importId, payload = {}) {
      return fetchJson(`${apiBaseUrl}/imports/${encodeURIComponent(importId)}/dispatch`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    loadImportStatus(importId) {
      return fetchJson(`${apiBaseUrl}/imports/${encodeURIComponent(importId)}/status`);
    },
    loadCatalog() {
      return fetchJson(`${apiBaseUrl}/catalog`);
    },
    loadProducts(importId = "") {
      const suffix = importId ? `?import_id=${encodeURIComponent(importId)}` : "";
      return fetchJson(`${apiBaseUrl}/products${suffix}`);
    },
    loadJobs() {
      return fetchJson(`${apiBaseUrl}/jobs`);
    },
    triggerJob(payload) {
      return fetchJson(`${apiBaseUrl}/jobs/trigger`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateReviewRows(payload) {
      return fetchJson(`${apiBaseUrl}/review/rows`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    saveManualNormalization(payload) {
      return fetchJson(`${apiBaseUrl}/review/normalize`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    saveManualMatch(payload) {
      return fetchJson(`${apiBaseUrl}/review/match`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    loadQuoteDraft() {
      return fetchJson(`${apiBaseUrl}/quote-draft`);
    },
    saveQuoteDraft(payload) {
      return fetchJson(`${apiBaseUrl}/quote-draft`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  };
}
